/**
 * 英文（`en-US`）—— **键集必须 ⊇ `zh-CN`**，由 `src/__tests__/i18n.test.ts` 强制。
 *
 * ⚠️ 新增键时**必须同时加两个文件**：只加 `zh-CN` ⇒ 英文用户看到中文（回落，可接受）；
 * 只加 `en-US` 而不加 `zh-CN` ⇒ 两侧都缺 ⇒ **裸 key**（不可接受，测试会红）。
 *
 * ⚠️ **不要翻译的专有名词**：`AED`、`CPR`、`120`（中国急救电话，保留数字，
 * 英文语境下应写成 `120` 而非 911 —— 本项目是中国境内的急救平台）。
 * `voice.ts:83-84` 会把 `A E D` / `C P R` 规整为 `AED` / `CPR`，两种语言下读字母都对。
 */
export default {
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    ok: 'OK',
    retry: 'Retry',
    loading: 'Loading…',
    networkError: 'Network error. Please try again later.',
    languageZh: '简体中文',
    languageEn: 'English',
  },

  voice: {
    cprNumbers: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
    /** Human-rescue breath count, first utterance (zh counterpart: '一零零一'). */
    breathStart: 'one zero zero one',
  },
}
