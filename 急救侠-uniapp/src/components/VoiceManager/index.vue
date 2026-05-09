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

var speak = function(text: string, opts?: { rate?: number; pitch?: number; volume?: number; priority?: 'NORMAL' | 'URGENT' }) {
  voice.speak(text, opts || {})
}

var stop = function() {
  voice.stop()
}

var command = function(text: string) {
  voice.command(text)
}

var guide = function(text: string) {
  voice.guide(text)
}

var comfort = function(text: string) {
  voice.comfort(text)
}

// #endif

// #ifdef MP-WEIXIN
var speak = function(_text: string, _opts?: { rate?: number; pitch?: number; volume?: number; priority?: 'NORMAL' | 'URGENT' }) {
  console.log('[Voice] 小程序端语音需预录音频')
}
var stop = function() {}
var command = function(_text: string) {}
var guide = function(_text: string) {}
var comfort = function(_text: string) {}
// #endif

onUnmounted(() => stop())

defineExpose({ speak, stop, command, guide, comfort })
</script>
