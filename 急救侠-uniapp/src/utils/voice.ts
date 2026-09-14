/**
 * 语音系统 — VoiceManager
 * 基于 Web Speech API，运行时检测平台
 *
 * F2 语音本地化（设计 `i18n-emergency-flow-design.md` §4.1，含 v1.1 修正）：
 * - 语言是**每次调用的显式参数**（`VoiceOptions.lang` / 各转发方法的尾参），默认 `'zh-CN'`。
 * - 默认值的**唯一作用**：让「不传 lang 的调用方」行为**与改动前逐字一致**。
 *   ⚠️ 本模块是**跨范围单例**：范围外的 `pages/home`、`pages/mission/running`、
 *   `pages/mission/arrived` 也直接 import 它，且文案仍是硬编码中文。
 *   因此**禁止**模块级 `setLocale`（那会让它们在 en-US 下用英文音色去念中文，比改前更差）。
 *
 * 真正的语音本地化 = 文本 + `u.lang` + 音色选择 + 标点规整，四者都按 locale 走。
 */

/** 语音合成支持的语言（与 i18n 的 `Locale` 取值一致）。 */
export type VoiceLang = 'zh-CN' | 'en-US'

/** 默认合成语言 —— 不传 `lang` 时的取值，保证范围外调用方行为不变。 */
export const DEFAULT_VOICE_LANG: VoiceLang = 'zh-CN'

interface VoiceOptions {
  rate?: number
  pitch?: number
  volume?: number
  priority?: 'NORMAL' | 'URGENT'
  /** 合成语言。默认 'zh-CN' ⇒ 范围外调用方行为逐字不变（这是默认值存在的唯一理由）。 */
  lang?: VoiceLang
}

/** 一次 `speakSequence` 中的一个短语：纯文本，或带节奏参数的文本对象。 */
export type VoicePhrase =
  | string
  | { text: string; rate?: number; pitch?: number; pause?: number }

function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** 归一化语言参数：任何非法/缺省值都回落默认语言（`zh-CN`）。 */
function normalizeLang(lang?: VoiceLang): VoiceLang {
  return lang === 'en-US' ? 'en-US' : DEFAULT_VOICE_LANG
}

export class VoiceManager {
  /**
   * 音色缓存 —— **按语言分区**（`Map<lang, voice>`）。
   *
   * ⚠️ 隐藏雷（设计 §4.1）：改造前只有单个 `bestVoice`。改成按语言取音色后，
   * 若仍用单一缓存，则「先中文后英文」会复用到先算出的中文音色（反之亦然）。
   * 用 Map 隔离即可根除；`null` 也缓存（表示该语言本次确实挑不出音色）。
   */
  private voiceCache = new Map<VoiceLang, SpeechSynthesisVoice | null>()
  private currentUtterance: SpeechSynthesisUtterance | null = null

  constructor() {
    if (!isSpeechSupported()) return
    this.initVoices()
  }

  private initVoices() {
    try {
      const voices = speechSynthesis.getVoices()
      if (voices.length > 0) return
    } catch { /* ignore */ }

    // 音色列表异步就绪 ⇒ 丢弃按语言缓存，下次调用按需重选（否则会一直复用过期音色）。
    speechSynthesis.onvoiceschanged = () => {
      this.voiceCache.clear()
    }
  }

  /**
   * 取指定语言的音色（按需解析 + **按语言缓存**）。
   *
   * 空结果**不缓存**：音色列表可能稍后才加载完成，缓存空会永久失去选中机会。
   */
  private ensureVoice(lang: VoiceLang): SpeechSynthesisVoice | null {
    if (this.voiceCache.has(lang)) return this.voiceCache.get(lang) ?? null

    let voices: SpeechSynthesisVoice[] = []
    try { voices = speechSynthesis.getVoices() || [] } catch { voices = [] }
    if (voices.length === 0) return null

    const picked = this.pickVoice(lang, voices)
    this.voiceCache.set(lang, picked)
    return picked
  }

  /**
   * 按语言选音色。
   *
   * - `zh-CN`：**保持改造前的匹配器顺序不变**（Tingting/婷婷 → Microsoft Xiaoxiao →
   *   Google Chinese → `lang === 'zh-CN'` → 兜底首个）。
   * - `en-US`：`lang === 'en-US'` → Google US English → Samantha → 兜底首个。
   */
  private pickVoice(lang: VoiceLang, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    const matchers: Array<(v: SpeechSynthesisVoice) => boolean> =
      lang === 'en-US'
        ? [
            (v) => v.lang === 'en-US',
            (v) => /Google.*US English/i.test(v.name),
            (v) => /Samantha/.test(v.name),
            () => true,
          ]
        : [
            (v) => v.name === 'Tingting' || v.name === '婷婷',
            (v) => /Microsoft.*Xiaoxiao/i.test(v.name),
            (v) => /Google.*Chinese/i.test(v.name),
            (v) => v.lang === 'zh-CN',
            () => true,
          ]
    for (const m of matchers) {
      const found = voices.find(m)
      if (found) return found
    }
    return voices[0] || null
  }

  /**
   * 文本规整。
   * - `A E D` / `C P R` ⇒ `AED` / `CPR`：两种语言下都读字母，故保留。
   * - `!` ⇒ `，`：**仅当 `lang === 'zh-CN'`**（英文必须保留 `!`，否则 `Start now!` 被破坏）。
   */
  private preprocess(text: string, lang: VoiceLang): string {
    const base = String(text)
      .replace(/A\s*E\s*D/gi, 'AED')
      .replace(/C\s*P\s*R/gi, 'CPR')
    return lang === 'zh-CN' ? base.replace(/!/g, '，') : base
  }

  speak(text: string, options: VoiceOptions = {}) {
    if (!isSpeechSupported()) return

    if (speechSynthesis.paused) speechSynthesis.resume()

    const { rate = 1.05, pitch = 1.0, volume = 1.0, priority = 'NORMAL' } = options
    const lang = normalizeLang(options.lang)
    const processed = this.preprocess(String(text), lang)

    if (priority === 'URGENT') this.stop()

    const u = new SpeechSynthesisUtterance(processed)
    u.voice = this.ensureVoice(lang)
    u.lang = lang
    u.rate = rate
    u.pitch = pitch
    u.volume = volume

    speechSynthesis.speak(u)
  }

  stop() {
    if (!isSpeechSupported()) return
    speechSynthesis.cancel()
  }

  count(text: string, lang?: VoiceLang) {
    if (!isSpeechSupported()) return
    const resolved = normalizeLang(lang)
    this.currentUtterance = new SpeechSynthesisUtterance(String(text))
    this.currentUtterance.voice = this.ensureVoice(resolved)
    this.currentUtterance.lang = resolved
    this.currentUtterance.rate = 1.4
    this.currentUtterance.pitch = 1.1
    this.currentUtterance.volume = 0.9
    speechSynthesis.speak(this.currentUtterance)
  }

  command(text: string, lang?: VoiceLang) { this.speak(text, { rate: 1.25, pitch: 1.1, lang }) }
  guide(text: string, lang?: VoiceLang) { this.speak(text, { rate: 1.05, pitch: 1.0, volume: 0.9, lang }) }
  comfort(text: string, lang?: VoiceLang) { this.speak(text, { rate: 0.9, pitch: 0.95, volume: 0.8, lang }) }


  speakSequence(
    phrases: VoicePhrase[],
    callback?: () => void,
    lang?: VoiceLang,
  ) {
    if (!phrases || phrases.length === 0) { if (callback) callback(); return }
    const resolvedLang = normalizeLang(lang)
    phrases.forEach((p, idx) => {
      const isLast = idx === phrases.length - 1
      const opts: any = typeof p === 'string' ? {} : { ...p }
      const text = typeof p === 'string' ? p : p.text
      delete opts.text
      // `lang` 按与 `speak` 相同的方式透传到每一次合成；短语自带的 lang 优先。
      opts.lang = opts.lang ?? resolvedLang
      if (isLast && callback) {
        const originalEnd = opts.onend
        opts.onend = () => { if (originalEnd) originalEnd(); callback() }
      }
      this.speak(text, opts)
    })
  }

}

export const voice = new VoiceManager()
