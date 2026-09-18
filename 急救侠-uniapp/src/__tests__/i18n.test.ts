import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createI18n } from 'vue-i18n'
import { i18n, resolveInitialLocale, setLocale, getLocale } from '@/i18n'
import { messages, SUPPORTED_LOCALES, FALLBACK_LOCALE, LOCALE_STORAGE_KEY } from '@/locales'
import zhCN from '@/locales/zh-CN'
import enUS from '@/locales/en-US'

/**
 * F2 双语基建测试 —— 对应设计文档 §5.1/§5.2。
 *
 * 本文件守护的是**三个 KPI**（PRD §5）：
 * - 翻译完整性：`en-US` ⊇ `zh-CN` = 100%
 * - 裸 key 泄漏 = 0（⚠️ 这条**只有** §「静态扫描」能真正咬住，见下）
 * - 兜底正确性：缺 key ⇒ 显示中文，不显示 key
 */

// ---------------------------------------------------------------------------
// 工具：把 locale 消息树摊平成「点分键路径 → 叶值」
// ---------------------------------------------------------------------------

function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return prefix ? [prefix] : []
  const out: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (Array.isArray(v) || typeof v !== 'object' || v === null) out.push(p)
    else out.push(...collectKeyPaths(v, p))
  }
  return out
}

/** 按点分路径取值（支持数组）。 */
function resolveKey(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part]
    return undefined
  }, tree)
}

/**
 * 从源码中抽出 `t('...')` / `$t('...')` / `tm('...')` / `rt('...')` 的**字面量**键。
 *
 * 用负向后顾 `(?<![\w$])` 排除 `format(`、`split(` 这类同尾函数 —— 否则 `forma**t(**'x')`
 * 会被误当成 i18n 调用，产生**假的"未定义键"告警**。
 * 动态拼接（`t(prefix + '.x')`）**不在扫描范围**，因为设计 §3.3 第 4 条已禁止该用法。
 */
export function extractUsedKeys(src: string): string[] {
  const out: string[] = []
  // P1b 增补 `useLocalizedNavTitle`：它的**第 1 个实参就是 i18n 键**（`useLocalizedNavTitle('nav.drill')`）。
  // 不纳入 ⇒ `nav.*` 键写错时不会被「代码用了但没定义」这条守卫抓到，
  // 只能表现为"导航栏显示裸 key 而全绿"。
  const re = /(?<![\w$])(?:\$?t|tm|rt|useLocalizedNavTitle)\(\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1])
  return out
}

// ---------------------------------------------------------------------------
// 1) 翻译完整性（KPI 1）
// ---------------------------------------------------------------------------

describe('翻译完整性：en-US ⊇ zh-CN', () => {
  it('★ zh-CN 的每个键在 en-US 都必须存在（否则英文界面会回落中文）', () => {
    const zhKeys = collectKeyPaths(zhCN)
    const enKeys = new Set(collectKeyPaths(enUS))
    const missing = zhKeys.filter(k => !enKeys.has(k))

    expect(zhKeys.length).toBeGreaterThan(0)
    expect(missing, `en-US 缺少这些键：${missing.join(', ')}`).toEqual([])
  })

  it('★ 计数词数组长度必须一致（zh 11 个 ⇒ en 也必须 11 个，错位会导致念错数字）', () => {
    expect(enUS.voice.cprNumbers.length).toBe(zhCN.voice.cprNumbers.length)
  })

  it('每个语言的每个叶值都是非空字符串（或非空字符串数组）', () => {
    const bad: string[] = []
    for (const loc of SUPPORTED_LOCALES) {
      for (const k of collectKeyPaths(messages[loc])) {
        const v = resolveKey(messages[loc], k)
        if (Array.isArray(v)) {
          if (v.length === 0 || v.some(x => typeof x !== 'string' || x.trim() === '')) bad.push(`${loc}:${k}`)
        } else if (typeof v !== 'string' || v.trim() === '') {
          bad.push(`${loc}:${k}`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 2) 兜底正确性（KPI 3）—— 用「测试内注入的临时键」，不依赖具体文案
// ---------------------------------------------------------------------------

describe('fallbackLocale 兜底：缺 key ⇒ 中文，绝不裸 key', () => {
  it('★ 只在 zh-CN 存在的键，在 en-US 下必须解析出**中文**（而非裸 key）', () => {
    const KEY = '__test_only_zh.msg'

    // ⚠️ 为什么用「沙箱实例」而不是 `i18n.global.mergeLocaleMessage`（曾踩的坑，勿回退）：
    // `createI18n({ messages })` **不克隆** messages ⇒ 其内部 zh-CN 消息树与
    // `src/locales/index.ts` 的 `messages['zh-CN']`、进而与导入的 `zhCN` 模块对象**是同一个引用**。
    // 于是 `mergeLocaleMessage` 会把这个临时键**永久写到 `zhCN` 上**，被「en-US ⊇ zh-CN」
    // 完整性用例读到 —— 同一文件内顺序固定时看不出来，但整仓乱序（`--sequence.shuffle`）下
    // 该用例排到本用例之后即报 `en-US 缺少这些键：__test_only_zh.msg`。
    // 深拷贝把注入关进沙箱：从**结构上**杜绝泄漏，不依赖"记得清理"。
    const sandbox = createI18n({
      legacy: false,
      locale: 'en-US',
      // 兜底语言取自生产常量（其与生产单例的一致性由下面第 2 条契约用例锁定）
      fallbackLocale: FALLBACK_LOCALE,
      messages: JSON.parse(JSON.stringify(messages)) as typeof messages,
      missingWarn: false,
      fallbackWarn: false,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sandbox.global as any).mergeLocaleMessage('zh-CN', { __test_only_zh: { msg: '仅中文存在的兜底文案' } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const got = (sandbox.global as any).t(KEY)

    expect(got).toBe('仅中文存在的兜底文案')
    // 裸 key 的签名：渲染结果 === 键名本身
    expect(got).not.toBe(KEY)

    // 反向自证：沙箱注入**不得**外溢到共享的 zh-CN 模块对象。
    // 断言与"产生污染的那行"放在一起 ⇒ 一旦有人改回全局 merge，这里立刻红且信息明确
    // （否则只会在别的文件里以"en-US 缺少键"这种看不懂原因的形式炸掉）。
    expect(collectKeyPaths(zhCN)).not.toContain(KEY)
  })

  it('★ 契约：FALLBACK_LOCALE 必须是 zh-CN（改成 en-US 会让英文用户看到裸 key）', () => {
    expect(FALLBACK_LOCALE).toBe('zh-CN')
    expect(i18n.global.fallbackLocale.value).toBe('zh-CN')
  })
})

// ---------------------------------------------------------------------------
// 3) ★ 静态扫描（KPI 2「裸 key = 0」的唯一真守卫）
//
// 为什么必须有这条：`fallbackLocale` 只覆盖「en 缺、zh 有」。
// 若代码里写了 t('rescue.foo') 而 **zh-CN 也没有 foo** ⇒ 两侧都缺 ⇒ vue-i18n
// 直接渲染裸 key，而「en ⊇ zh」的完整性断言**依然全绿**（因为它只比较两个 locale 之间）。
// ---------------------------------------------------------------------------

/** 扫描器自检：喂进合成的"坏源码"，必须报出未定义键。 */
describe('静态扫描器自检', () => {
  it('能抽出字面量键', () => {
    expect(extractUsedKeys(`const a = t('rescue.title')`)).toEqual(['rescue.title'])
    expect(extractUsedKeys(`<view>{{ $t('common.ok') }}</view>`)).toEqual(['common.ok'])
    expect(extractUsedKeys(`const arr = tm('voice.cprNumbers')`)).toEqual(['voice.cprNumbers'])
    // P1b：`useLocalizedNavTitle('nav.x')` 的第 1 个实参就是 key ⇒ 必须纳入扫描，
    // 否则 nav 键写错时「代码用了但没定义」这条守卫会漏（导航栏显示裸 key 而全绿）。
    expect(extractUsedKeys(`useLocalizedNavTitle('nav.drill')`)).toEqual(['nav.drill'])
  })

  it('★ 不会把 format( / split( 误判为 i18n 调用（否则会产生假的漏译告警）', () => {
    expect(extractUsedKeys(`const s = format('yyyy-MM-dd')`)).toEqual([])
    expect(extractUsedKeys(`const p = split('x')`)).toEqual([])
    expect(extractUsedKeys(`const q = match('abc')`)).toEqual([])
  })

  it('★ 能识别出「用了但没定义」的键（返回非空 ⇒ 调用方可据此报红）', () => {
    const used = extractUsedKeys(`t('rescue.__definitely_not_defined__')`)
    const zhKeys = new Set(collectKeyPaths(zhCN))
    expect(used.filter(k => !zhKeys.has(k))).toEqual(['rescue.__definitely_not_defined__'])
  })
})

describe('静态扫描：范围清单内不得出现未定义 / 裸 key', () => {
  /** F2 范围清单（设计 §2）。**新增在范围内的文件必须加到这里**，否则扫描会漏。 */
  const SCOPE_FILES = [
    'src/pages/rescue/index.vue',
    'src/pages/guide/index.vue',
    'src/pages/aed/index.vue',
    'src/pages/aed/detail.vue',
    'src/pages/drill/index.vue',
    // P1a 补：「我的」页已双语化，全部 `mine.*` 键都必须被"用了但没定义"守卫覆盖。
    'src/pages/cert/index.vue',
    // F4 T04：两新页的 `hours.*` / `serviceCert.*` 键必须被"用了但没定义"守卫覆盖。
    'src/pages/volunteer/hours.vue',
    'src/pages/volunteer/certificates.vue',
    'src/components/SosButton/index.vue',
    'src/components/StepTimer/index.vue',
    'src/components/Metronome/index.vue',
    'src/components/BottomSheet/index.vue',
    'src/components/VoiceManager/index.vue',
    // voice.ts 当前**零** t()/tm()/rt() 调用 —— 加进来是无行为的预防：
    // 防止日后有人在语音层写 t('...') 却无人扫描（语音文本本地化是本期 KPI 之一）。
    'src/utils/voice.ts',
    // P1a：tabbar-locale.ts 的 `t(...)` 现阶段是**动态键**（`t(item.textKey)`）⇒ 静态扫描取不到，
    // 加进来同样是无行为的预防；`tabbar.*` 键的存在性由 `tabbar-locale.test.ts` 显式枚举守护。
    'src/utils/tabbar-locale.ts',
  ]

  it('★ 每个代码里用到的键，在两个 locale 中都必须能解析出非空值且 ≠ 键名', () => {
    const problems: string[] = []
    let scannedKeys = 0

    for (const rel of SCOPE_FILES) {
      const abs = path.resolve(process.cwd(), rel)
      if (!fs.existsSync(abs)) { problems.push(`范围文件不存在：${rel}`); continue }
      const src = fs.readFileSync(abs, 'utf8')

      for (const key of extractUsedKeys(src)) {
        scannedKeys++
        for (const loc of SUPPORTED_LOCALES) {
          const v = resolveKey(messages[loc], key)
          const ok = Array.isArray(v)
            ? v.length > 0 && v.every(x => typeof x === 'string' && x.trim() !== '')
            : typeof v === 'string' && v.trim() !== ''
          if (!ok) problems.push(`${rel}: 键「${key}」在 ${loc} 中缺失或为空`)
          // 裸 key 的签名
          if (typeof v === 'string' && v === key) problems.push(`${rel}: 键「${key}」在 ${loc} 中是裸 key`)
        }
      }
    }

    // ⚠️ 必须 `> 0`（原为 `>= 0`，对任何计数恒真 ⇒ 这条"扫描器是否失效"的守卫永不红）。
    // 静态扫描是「裸 key 泄漏 = 0」KPI 的**唯一真守卫**（见文件头/设计 §5.1），守卫自己也要被守住。
    expect(scannedKeys, '扫描到的键数为 0 —— 请检查范围清单 / 扫描器是否失效').toBeGreaterThan(0)
    expect(problems, problems.join('\n')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 4) 启动语言判定与持久化（设计 §3.4，PRD §6.2 的"待验证项"）
// ---------------------------------------------------------------------------

describe('resolveInitialLocale：持久化 > 系统语言 > 中文兜底', () => {
  beforeEach(() => {
    vi.mocked(uni.getStorageSync).mockReset()
    vi.mocked(uni.getStorageSync).mockImplementation((): never => '' as never)
  })

  const withStorage = (v: string) =>
    vi.mocked(uni.getStorageSync).mockImplementation(((k: string) => (k === LOCALE_STORAGE_KEY ? v : '')) as never)

  const withSystem = (locale: string | undefined) =>
    Object.assign(uni as unknown as Record<string, unknown>, {
      getLocale: locale === undefined ? undefined : vi.fn(() => locale),
    })

  it('持久化优先：存了 en-US ⇒ 返回 en-US（即使系统是中文）', () => {
    withStorage('en-US'); withSystem('zh-CN')
    expect(resolveInitialLocale()).toBe('en-US')
  })

  it('★ 持久化优先于系统语言：存了 zh-CN 的英文手机**不得**被改回英文', () => {
    withStorage('zh-CN'); withSystem('en-US')
    expect(resolveInitialLocale()).toBe('zh-CN')
  })

  it('无持久化时按系统语言判定（en / en-US / en_GB 都判为 en-US）', () => {
    for (const sys of ['en', 'en-US', 'en_GB', 'en-US-u-hc-h12']) {
      withStorage(''); withSystem(sys)
      expect(resolveInitialLocale(), `系统语言 ${sys}`).toBe('en-US')
    }
  })

  it('★ 存储里是非法值 ⇒ 忽略并要求回落（不信任存储内容）', () => {
    withStorage('klingon'); withSystem('zh-CN')
    expect(resolveInitialLocale()).toBe('zh-CN')
  })

  it('★ uni.getLocale 不存在（测试 mock / 低版本宿主）⇒ 不抛错，回落中文', () => {
    withStorage(''); withSystem(undefined)
    expect(() => resolveInitialLocale()).not.toThrow()
    expect(resolveInitialLocale()).toBe('zh-CN')
  })

  it('★ getStorageSync 抛异常 ⇒ 不崩，降级为「无持久化」并继续走第二档系统语言', () => {
    vi.mocked(uni.getStorageSync).mockImplementation((() => { throw new Error('storage boom') }) as never)
    withSystem('en-US')
    expect(() => resolveInitialLocale()).not.toThrow()
    // 注意：降级到的是**第二档**（系统语言），不是直接兜底 —— 三者是链式的，不是"出错即中文"
    expect(resolveInitialLocale()).toBe('en-US')
  })

  it('★ getStorageSync 抛异常 + 系统语言不可识别 ⇒ 走完整条链，最终回落中文', () => {
    vi.mocked(uni.getStorageSync).mockImplementation((() => { throw new Error('storage boom') }) as never)
    withSystem('fr-FR')
    expect(resolveInitialLocale()).toBe('zh-CN')
  })

  it('系统语言非中英（如 fr）⇒ 回落中文', () => {
    withStorage(''); withSystem('fr-FR')
    expect(resolveInitialLocale()).toBe('zh-CN')
  })
})

describe('setLocale / getLocale', () => {
  it('切换语言会持久化到 app_locale', () => {
    vi.mocked(uni.setStorageSync).mockClear()
    const prev = getLocale()
    setLocale('en-US')
    expect(uni.setStorageSync).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'en-US')
    expect(getLocale()).toBe('en-US')
    setLocale(prev)
  })

  it('★ 非法语言被拒绝（不写入、不改当前语言）', () => {
    const prev = getLocale()
    vi.mocked(uni.setStorageSync).mockClear()
    setLocale('klingon' as never)
    expect(getLocale()).toBe(prev)
    expect(uni.setStorageSync).not.toHaveBeenCalled()
  })
})
