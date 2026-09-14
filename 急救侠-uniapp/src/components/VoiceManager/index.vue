<!-- VoiceManager -- voice broadcast component (no UI) -->
<template>
  <view style="display:none" />
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'

// 语音语言类型（与 `@/utils/voice` 的 `VoiceLang` 保持一致；此处不 import 值，
// 以维持本组件在微信端对 `@/utils/voice` 的**惰性加载**特性）。
type VoiceLang = 'zh-CN' | 'en-US'

// Runtime platform check: WeChat Mini Program has no Web Speech API
const isWechat = typeof wx !== 'undefined' && typeof (wx as any).createInnerAudioContext === 'function'

let voiceModule: { voice: any } | null = null

// Lazy-load voice module for H5/App only
async function getVoiceModule() {
  if (voiceModule) return voiceModule
  if (isWechat) return null
  try {
    voiceModule = await import('@/utils/voice')
  } catch {
    voiceModule = null
  }
  return voiceModule
}

// Preload on module init
getVoiceModule()

async function speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number; priority?: 'NORMAL' | 'URGENT'; lang?: VoiceLang }) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.speak(text, opts || {})
  } else {
    console.log('[Voice]', text.slice(0, 50))
  }
}

async function stop() {
  const vm = await getVoiceModule()
  vm?.voice?.stop()
}

async function command(text: string, lang?: VoiceLang) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.command(text, lang)
  } else {
    console.log('[Voice]', text.slice(0, 50))
  }
}

async function guide(text: string, lang?: VoiceLang) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.guide(text, lang)
  } else {
    console.log('[Voice]', text.slice(0, 50))
  }
}

async function comfort(text: string, lang?: VoiceLang) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.comfort(text, lang)
  } else {
    console.log('[Voice]', text.slice(0, 50))
  }
}

async function count(text: string, lang?: VoiceLang) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.count(text, lang)
  } else {
    console.log('[Voice] count:', text)
  }
}

async function speakSequence(phrases: Array<string | { text: string; rate?: number; pitch?: number; pause?: number }>, callback?: () => void, lang?: VoiceLang) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.speakSequence(phrases, callback, lang)
  } else {
    console.log('[Voice] speakSequence:', phrases.length, 'phrases')
    if (callback) callback()
  }
}

onUnmounted(() => { stop() })

defineExpose({ speak, stop, command, guide, comfort, count, speakSequence })
</script>
