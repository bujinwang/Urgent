/**
 * 音频工具 — Web Audio API 节拍器
 */

let audioCtx: AudioContext | null = null

export function initAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
  } catch (e) {
    console.warn('[Audio] 初始化失败:', e)
  }
}

export function playClick() {
  try {
    if (!audioCtx) return
    const play = () => {
      const osc = audioCtx!.createOscillator()
      const gain = audioCtx!.createGain()
      osc.connect(gain)
      gain.connect(audioCtx!.destination)
      osc.frequency.value = 880
      osc.type = 'square'
      gain.gain.setValueAtTime(0.04, audioCtx!.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + 0.04)
      osc.start()
      osc.stop(audioCtx!.currentTime + 0.04)
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(play).catch(() => {})
    } else {
      play()
    }
  } catch (e) {
    // ignore
  }
}

export function playAlertSound() {
  try {
    initAudio()
    if (!audioCtx) return
    const now = audioCtx.currentTime
    for (let i = 0; i < 3; i++) {
      const start = now + i * 0.4
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(900, start)
      osc.frequency.exponentialRampToValueAtTime(1200, start + 0.1)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.1, start + 0.05)
      gain.gain.linearRampToValueAtTime(0, start + 0.2)
      osc.start(start)
      osc.stop(start + 0.3)
    }
  } catch (e) {
    // ignore
  }
}
