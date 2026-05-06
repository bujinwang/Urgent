<template>
  <view class="step-timer">
    <text class="step-timer-label">{{ label }}</text>
    <view class="step-timer-bar">
      <view class="step-timer-fill" :style="{ width: progress + '%' }" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  seconds: number
  label?: string
  autoStart?: boolean
}>(), {
  label: '',
  autoStart: true,
})

const emit = defineEmits<{
  done: []
  tick: [remaining: number]
}>()

const progress = ref(0)
let timer: number | null = null
let startTime = 0

onMounted(() => {
  if (props.autoStart) start()
})

onUnmounted(() => stop())

function start() {
  startTime = Date.now()
  const total = props.seconds * 1000
  timer = setInterval(() => {
    const elapsed = Date.now() - startTime
    progress.value = Math.min((elapsed / total) * 100, 100)
    emit('tick', Math.max(0, props.seconds - Math.floor(elapsed / 1000)))
    if (elapsed >= total) {
      stop()
      emit('done')
    }
  }, 100) as unknown as number
}

function stop() {
  if (timer) { clearInterval(timer); timer = null }
}

defineExpose({ start, stop })
</script>

<style lang="scss" scoped>
.step-timer {
  margin-bottom: 48rpx;
}
.step-timer-label {
  font-family: var(--mono);
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 16rpx;
  letter-spacing: 2rpx;
  display: block;
  text-align: center;
}
.step-timer-bar {
  height: 12rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6rpx;
  overflow: hidden;
}
.step-timer-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--rescue-red), #FF6B5B);
  width: 0%;
  border-radius: 6rpx;
  transition: width 0.3s linear;
}
</style>
