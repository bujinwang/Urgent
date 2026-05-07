/**
 * 语音系统 — VoiceManager
 * 基于 Web Speech API，运行时检测平台
 */

interface VoiceOptions {
  rate?: number
  pitch?: number
  volume?: number
  priority?: 'NORMAL' | 'URGENT'
}

function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

class VoiceManager {
  private bestVoice: SpeechSynthesisVoice | null = null
  private voicesLoaded = false
  private currentUtterance: SpeechSynthesisUtterance | null = null

  constructor() {
    if (!isSpeechSupported()) return
    this.initVoices()
  }

  private initVoices() {
    try {
      const voices = speechSynthesis.getVoices()
      if (voices.length > 0) {
        this.bestVoice = this.pickVoice(voices)
        this.voicesLoaded = true
        return
      }
    } catch { /* ignore */ }

    speechSynthesis.onvoiceschanged = () => {
      try {
        const voices = speechSynthesis.getVoices()
        if (voices.length > 0) {
          this.bestVoice = this.pickVoice(voices)
          this.voicesLoaded = true
        }
      } catch { /* ignore */ }
    }
  }

  private ensureVoice(): SpeechSynthesisVoice | null {
    if (!this.voicesLoaded || !this.bestVoice) {
      try {
        const voices = speechSynthesis.getVoices()
        if (voices.length > 0) {
          this.bestVoice = this.pickVoice(voices)
          this.voicesLoaded = true
        }
      } catch { /* ignore */ }
    }
    return this.bestVoice
  }

  private pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    const matchers: Array<(v: SpeechSynthesisVoice) => boolean> = [
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

  /** 常规播报 — 排队播放，URGENT 优先打断 */
  speak(text: string, options: VoiceOptions = {}) {
    if (!isSpeechSupported()) return

    const { rate = 1.05, pitch = 1.0, volume = 1.0, priority = 'NORMAL' } = options
    const processed = String(text)
      .replace(/A\s*E\s*D/gi, 'AED')
      .replace(/C\s*P\s*R/gi, 'CPR')
      .replace(/!/g, '，')

    // URGENT 优先级：清空队列直接插播（用于 CPR 报数等时效性场景）
    if (priority === 'URGENT') {
      this.stop()
    }

    const u = new SpeechSynthesisUtterance(processed)
    u.voice = this.ensureVoice()
    u.lang = 'zh-CN'
    u.rate = rate
    u.pitch = pitch
    u.volume = volume

    speechSynthesis.speak(u)
  }

  /** 立即播报 — 取消所有排队，立刻说话（用于 CPR 报数） */
  speakNow(text: string, rate = 1.3, pitch = 1.1) {
    if (!isSpeechSupported()) return

    speechSynthesis.cancel()
    const processed = String(text)
    // Chrome 在 cancel() 后立即 speak() 会静默丢弃 —— 需要微任务延迟
    setTimeout(() => {
      this.currentUtterance = new SpeechSynthesisUtterance(processed)
      this.currentUtterance.voice = this.ensureVoice()
      this.currentUtterance.lang = 'zh-CN'
      this.currentUtterance.rate = rate
      this.currentUtterance.pitch = pitch
      this.currentUtterance.volume = 0.95
      speechSynthesis.speak(this.currentUtterance)
    }, 5)
  }

  /** 快速报数 — 不 cancel，直接说话（数字短，自然排队） */
  count(text: string) {
    if (!isSpeechSupported()) return
    this.currentUtterance = new SpeechSynthesisUtterance(String(text))
    this.currentUtterance.voice = this.ensureVoice()
    this.currentUtterance.lang = 'zh-CN'
    this.currentUtterance.rate = 1.4
    this.currentUtterance.pitch = 1.1
    this.currentUtterance.volume = 0.9
    speechSynthesis.speak(this.currentUtterance)
  }

  stop() {
    if (!isSpeechSupported()) return
    speechSynthesis.cancel()
  }

  command(text: string) {
    this.speak(text, { rate: 1.25, pitch: 1.1 })
  }

  guide(text: string) {
    this.speak(text, { rate: 1.05, pitch: 1.0, volume: 0.9 })
  }

  comfort(text: string) {
    this.speak(text, { rate: 0.9, pitch: 0.95, volume: 0.8 })
  }

  /** 多句连续播报（自动停顿） */
  speakSequence(phrases: Array<string | { text: string; rate?: number; pitch?: number; pause?: number }>, callback?: () => void) {
    if (!phrases || phrases.length === 0) {
      if (callback) callback()
      return
    }
    phrases.forEach((p, idx) => {
      const isLast = idx === phrases.length - 1
      const opts: any = typeof p === 'string' ? {} : { ...p }
      const text = typeof p === 'string' ? p : p.text
      delete opts.text
      if (isLast && callback) {
        const originalEnd = opts.onend
        opts.onend = () => { if (originalEnd) originalEnd(); callback() }
      }
      this.speak(text, opts)
    })
  }
}

export const voice = new VoiceManager()
