/**
 * i18n 单例与语言读写 —— 急救主链路双语（F2）的**唯一入口**。
 *
 * 设计依据：`deliverables/software-company/i18n-emergency-flow-design.md` §3.2/§3.4。
 *
 * 三条硬契约（改动前必读设计 §3.2）：
 * 1. `legacy: false` —— v9 默认 `legacy: true` 是 Options API 形态，与 `<script setup>` + `useI18n()` 不兼容。
 * 2. `fallbackLocale` 恒为 `zh-CN` 且**不可改成 `en-US`**：缺 key 时宁可显示中文，绝不显示裸 key。
 * 3. 语言切换入口**不得放进 SOS 主流程**（PRD §8）。
 */
import { createI18n } from 'vue-i18n'
import {
  messages, SUPPORTED_LOCALES, FALLBACK_LOCALE, LOCALE_STORAGE_KEY,
  isSupportedLocale, matchSystemLocale,
  type Locale,
} from './locales'

const isDev = (() => {
  try {
    return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)
  } catch {
    return false
  }
})()

/** 安全读本地存储：非 uni 环境（纯单测/SSR）返回 `''` 而非抛错。 */
function safeGetStorage(key: string): string {
  try {
    if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return ''
    const v = uni.getStorageSync(key)
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

/** 安全写本地存储；失败静默（语言切换不该因存储异常而崩）。 */
function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') return
    uni.setStorageSync(key, value)
  } catch { /* ignore */ }
}

/**
 * 读取系统语言。
 *
 * ⚠️ **必须做 `typeof` 守卫**：`uni.getLocale` 在真机/浏览器存在，但
 * `__tests__/setup.ts` 的 `uni` mock **没有实现它** ⇒ 直接调用会在测试里抛 `undefined is not a function`。
 * （设计 §3.4 已把这条"待验证项"验掉。）
 */
function readSystemLocale(): string {
  try {
    if (typeof uni === 'undefined' || typeof uni.getLocale !== 'function') return ''
    const v = uni.getLocale()
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

/**
 * 启动语言判定：**持久化优先 → 系统语言 → 中文兜底**（设计 §3.4 的三段式）。
 *
 * 注意顺序不可颠倒：用户显式选择过的语言**永远**优先于系统语言，
 * 否则"切到中文"的英文手机用户每次启动都会被改回英文。
 */
export function resolveInitialLocale(): Locale {
  const saved = safeGetStorage(LOCALE_STORAGE_KEY)
  if (isSupportedLocale(saved)) return saved

  const matched = matchSystemLocale(readSystemLocale())
  if (matched) return matched

  return FALLBACK_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: FALLBACK_LOCALE,
  messages,
  // 生产环境不刷警告；dev/测试保留，便于发现漏译。
  missingWarn: isDev,
  fallbackWarn: isDev,
})

/**
 * 切换语言并持久化。
 *
 * ⚠️ 调用方（设置页）负责**不得**把它接进 SOS 主流程；
 * 且切换后**不要**重新 `createI18n` —— 直接改 `global.locale` 触发响应式更新。
 */
export function setLocale(locale: Locale): void {
  if (!isSupportedLocale(locale)) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(i18n.global.locale as unknown as { value: Locale }).value = locale
  safeSetStorage(LOCALE_STORAGE_KEY, locale)
}

/** 当前语言。 */
export function getLocale(): Locale {
  const cur = (i18n.global.locale as unknown as { value: Locale }).value
  return isSupportedLocale(cur) ? cur : FALLBACK_LOCALE
}

export { SUPPORTED_LOCALES, FALLBACK_LOCALE, LOCALE_STORAGE_KEY, isSupportedLocale }
export type { Locale }
