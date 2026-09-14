/**
 * 基准语言（`zh-CN`）—— **所有其它语言必须 ⊇ 本文件的键集**。
 *
 * 纪律（改动前必读 `deliverables/software-company/i18n-emergency-flow-design.md` §3.3）：
 * 1. **键名只描述语义，不含语言**：✅ `rescue.confirm.body` ❌ `rescue.confirm.body.zh`
 * 2. **同义复用优先**：`common.*` 里有就不新造（KPI 是覆盖率，不是键数）
 * 3. **插值用具名占位**：`{n}` / `{seconds}`，不用位置参数
 * 4. **不允许把整句话拼起来**（`t('a') + name + t('b')`）—— 语序因语言而异，必须整句 + 插值
 *
 * ⚠️ 本文件是**基准**：漏了键不会"回落"，而是**两侧都缺 ⇒ 直接渲染裸 key**。
 * 防它的不是 `fallbackLocale`（那只管 en 缺、zh 有），而是
 * `src/__tests__/i18n.test.ts` 里的**静态扫描**（扫描代码里用到的每个键）。
 */
export default {
  common: {
    confirm: '确认',
    cancel: '取消',
    ok: '好的',
    retry: '重试',
    loading: '加载中…',
    networkError: '网络异常，请稍后重试',
    /** 语言名（用于切换入口；**各语言下都写自己的名字**，便于用户辨认）。 */
    languageZh: '简体中文',
    languageEn: 'English',
  },

  /**
   * 语音文本与计数词。
   *
   * `cprNumbers` 是**数组**：`wordForCpr(n)` 按索引取词，`n > 10` 时回落 `String(n)`。
   * ⚠️ 之所以把计数词放进 i18n（而不是在 `rescue/index.vue` 里写死两份数组）：
   * 这样"漏译"会被 key 完整性测试**自动覆盖**，不必为语音单独维护一套覆盖率检查。
   */
  voice: {
    cprNumbers: ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'],
    /**
     * 人工呼吸计数的**起手念法**（逐位念"一零零一"）。
     * `startBreathCount()` 第一声用它，随后 `String(1000 + n)` 直接交给 TTS 念数字。
     */
    breathStart: '一零零一',
  },
}
