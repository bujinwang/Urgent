<template>
  <view v-if="visible" class="bottom-sheet-overlay" @click.self="close">
    <view class="bottom-sheet" :class="{ active: visible, 'sheet-dark': dark }">
      <view class="sheet-handle" />
      <view v-if="title" class="sheet-header">
        <text class="sheet-title">{{ title }}</text>
        <text class="sheet-close" @click="close">✕</text>
      </view>
      <scroll-view class="sheet-body" scroll-y>
        <slot />
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean
  title?: string
  dark?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

function close() {
  emit('close')
}
</script>

<style lang="scss" scoped>
.bottom-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12rpx);
  z-index: 1100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bottom-sheet {
  width: 100%;
  max-width: 480px;
  background: var(--paper);
  border-radius: 56rpx 56rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.32s cubic-bezier(0.4, 0, 0.2, 1);

  &.sheet-dark {
    background: #1A0907;
    border-top: 1px solid rgba(255, 255, 255, 0.1);

    .sheet-title {
      color: #fff;
    }

    .sheet-close {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
    }

    .sheet-handle {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}

.sheet-handle {
  width: 72rpx;
  height: 8rpx;
  background: var(--line);
  border-radius: 4rpx;
  margin: 24rpx auto 0;
  flex-shrink: 0;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 48rpx 16rpx;
  flex-shrink: 0;
}

.sheet-title {
  font-family: var(--serif);
  font-size: 36rpx;
  font-weight: 700;
}

.sheet-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: var(--paper-warm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: var(--ink-soft);
}

.sheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 16rpx 48rpx 48rpx;
}
</style>
