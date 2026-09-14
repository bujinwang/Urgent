/**
 * locale 组装与登记。**唯一的语言清单来源**（新增语言只改这里）。
 *
 * 设计依据：`deliverables/software-company/i18n-emergency-flow-design.md` §3.1–§3.4。
 */
import zhCN from './zh-CN'
import enUS from './en-US'

/**
 * `zh-CN` 是**基准语言**：其余语言的**类型**由它推导
 * ⇒ 漏了键会**在 `vue-tsc --noEmit` 阶段就报错**，不用等运行时测试。
 * （运行时测试 `i18n.test.ts` 仍保留，作为纵深防御 + 覆盖"代码用了但没定义"那一类。）
 */
export type MessageSchema = typeof zhCN

/** `en-US` 显式标注为基准语言的形状 ⇒ 结构性漏译在类型层即被拦下。 */
const enUSChecked: MessageSchema = enUS

/** 可用语言（新增语言须同时更新 {@link Locale} 与 {@link messages}）。 */
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

/**
 * 兜底语言 —— **硬契约**（设计 §3.2 / PRD D2）：
 * 急救场景下"显示中文"远好于"显示裸 key"或空白。
 * ⚠️ **绝不可改为 `en-US`**：那会让缺 key 时英文用户看到裸 key。
 */
export const FALLBACK_LOCALE: Locale = 'zh-CN'

/** 语言持久化键（测试须自行 mock，见 `__tests__/setup.ts` 只对 `jwt_token` 返回值）。 */
export const LOCALE_STORAGE_KEY = 'app_locale'

export const messages: Record<Locale, MessageSchema> = {
  'zh-CN': zhCN,
  'en-US': enUSChecked,
}

/** 运行期收窄：把任意值判为受支持语言。 */
export function isSupportedLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(v)
}

/**
 * 系统语言 → 受支持语言。
 * 只用**语言主标签**判断，容忍 `en`、`en-US`、`en_GB`、`en-US-u-hc-h12` 等形态。
 */
export function matchSystemLocale(systemLocale: unknown): Locale | null {
  if (typeof systemLocale !== 'string' || !systemLocale) return null
  const primary = systemLocale.toLowerCase().split(/[-_]/)[0]
  if (primary === 'en') return 'en-US'
  if (primary === 'zh') return 'zh-CN'
  return null
}
