<!-- VoiceManager — 语音播报组件
     从 utils/voice.ts 导入 voice 实例，暴露 speak/stop/command/guide/comfort 方法
     本身不渲染 UI -->
<template>
  <view style="display:none" />
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
// #ifdef H5 || APP-PLUS
import { voice } from '@/utils/voice'

function speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number; priority?: 'NORMAL' | 'URGENT' }) {
  voice.speak(text, opts || {})
}

function stop() {
  voice.stop()
}

function command(text: string) {
  voice.command(text)
}

function guide(text: string) {
  voice.guide(text)
}

function comfort(text: string) {
  voice.comfort(text)
}

// #endif

// #ifdef MP-WEIXIN
function speak(_text: string, _opts?: Record<string, unknown>) {
  console.log('[Voice] 小程序端语音需预录音频')
}
function stop() {}
function command(_text: string) {}
function guide(_text: string) {}
function comfort(_text: string) {}
// #endif

onUnmounted(() => stop())

defineExpose({ speak, stop, command, guide, comfort })
</script>
