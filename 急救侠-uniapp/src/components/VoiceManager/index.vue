<!-- VoiceManager -- voice broadcast component (no UI) -->
<template>
  <view style="display:none" />
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'

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

async function speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number; priority?: 'NORMAL' | 'URGENT' }) {
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

async function command(text: string) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.command(text)
  } else {
    console.log('[Voice]', text.slice(0, 50))
  }
}

async function guide(text: string) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.guide(text)
  } else {
    console.log('[Voice]', text.slice(0, 50))
  }
}

async function comfort(text: string) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.comfort(text)
  } else {
    console.log('[Voice]', text.slice(0, 50))
  }
}

async function count(text: string) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.count(text)
  } else {
    console.log('[Voice] count:', text)
  }
}

async function speakSequence(phrases: Array<string | { text: string; rate?: number; pitch?: number; pause?: number }>, callback?: () => void) {
  const vm = await getVoiceModule()
  if (vm) {
    vm.voice.speakSequence(phrases, callback)
  } else {
    console.log('[Voice] speakSequence:', phrases.length, 'phrases')
    if (callback) callback()
  }
}

onUnmounted(() => { stop() })

defineExpose({ speak, stop, command, guide, comfort, count, speakSequence })
</script>