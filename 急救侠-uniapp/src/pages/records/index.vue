<template>
  <view class="page-records">
    <!-- 顶栏 -->
    <view class="records-topbar">
      <view class="records-back" @click="goBack">‹</view>
      <text class="records-title">救援记录</text>
      <text class="records-count">{{ store.totalRescues }} 次</text>
    </view>

    <!-- 统计卡片 -->
    <view class="records-stats">
      <view class="records-stat">
        <text class="records-stat-num">{{ store.totalRescues }}</text>
        <text class="records-stat-label">参与救援</text>
      </view>
      <view class="records-stat">
        <text class="records-stat-num">{{ store.successCount }}</text>
        <text class="records-stat-label">救援成功</text>
      </view>
      <view class="records-stat">
        <text class="records-stat-num">{{ store.aedUsageCount }}</text>
        <text class="records-stat-label">使用 AED</text>
      </view>
    </view>

    <!-- 角色分布条 -->
    <view class="records-role-strip">
      <view
        v-for="(count, role) in store.roleStats"
        :key="role"
        class="records-role-chip"
        :class="role"
      >
        <text class="records-role-chip-label">{{ roleLabel(role) }}</text>
        <text class="records-role-chip-count">{{ count }}次</text>
      </view>
    </view>

    <!-- 记录列表 -->
    <view class="records-list">
      <view
        v-for="record in store.records"
        :key="record.id"
        class="records-item"
        @click="toggleExpand(record.id)"
      >
        <!-- 列表行 -->
        <view class="records-item-header">
          <view class="records-item-outcome" :class="record.outcome">
            <text>{{ outcomeEmoji(record.outcome) }}</text>
          </view>
          <view class="records-item-body">
            <text class="records-item-title">{{ record.title }}</text>
            <view class="records-item-meta">
              <text>{{ record.date }}</text>
              <text>·</text>
              <text>{{ record.duration }}</text>
              <text>·</text>
              <text>{{ record.roleLabel }}</text>
            </view>
          </view>
          <view class="records-item-chevron" :class="{ expanded: expandedId === record.id }">▾</view>
        </view>

        <!-- 展开详情 -->
        <view v-if="expandedId === record.id" class="records-item-detail">
          <!-- 结果条 -->
          <view class="records-detail-outcome" :class="record.outcome">
            <text>{{ record.outcomeLabel }}</text>
          </view>

          <!-- 地址 & AED -->
          <view class="records-detail-meta">
            <text>📍 {{ record.address }}</text>
            <text v-if="record.aedUsed">⚡ 使用 AED</text>
            <text v-else>🫁 无 AED</text>
          </view>

          <!-- 小队 -->
          <view class="records-detail-section">
            <text class="records-detail-section-title">救援小队 ({{ record.squad.length }}人)</text>
            <view class="records-detail-squad">
              <view v-for="m in record.squad" :key="m.name" class="records-squad-member">
                <view class="records-squad-avatar" :style="{ background: m.color }">{{ m.avatar }}</view>
                <view class="records-squad-info">
                  <text class="records-squad-name">{{ m.name }}</text>
                  <text class="records-squad-role">{{ m.role }}</text>
                </view>
              </view>
            </view>
          </view>

          <!-- 时间线 -->
          <view class="records-detail-section">
            <text class="records-detail-section-title">事件时间线</text>
            <view class="records-detail-timeline">
              <view v-for="(item, i) in record.timeline" :key="i" class="records-timeline-item">
                <view class="records-timeline-dot" :class="{ last: i === record.timeline.length - 1 }" />
                <view class="records-timeline-line" v-if="i < record.timeline.length - 1" />
                <view class="records-timeline-body">
                  <text class="records-timeline-time">{{ item.time }}</text>
                  <text class="records-timeline-text">{{ item.text }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="store.records.length === 0" class="records-empty">
      <text class="records-empty-icon">📋</text>
      <text class="records-empty-text">暂无救援记录</text>
      <text class="records-empty-sub">完成一次紧急救援后，记录将显示在这里</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRecordsStore } from '@/stores/records'

const store = useRecordsStore()
const expandedId = ref<string | null>(null)

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function outcomeEmoji(outcome: string): string {
  return outcome === 'success' ? '💚' : outcome === 'partial' ? '💛' : '🔵'
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    cpr: '按压手',
    aed: 'AED手',
    assist: '辅助',
  }
  return map[role] || role
}

function goBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.page-records {
  min-height: 100vh;
  background: #FAFAF7;
  padding-bottom: 60rpx;
}

/* 顶栏 */
.records-topbar {
  display: flex;
  align-items: center;
  padding: 28rpx 40rpx;
  gap: 20rpx;
}
.records-back {
  font-size: 48rpx;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
}
.records-title {
  flex: 1;
  font-family: var(--serif);
  font-weight: 700;
  font-size: 36rpx;
  color: var(--ink);
}
.records-count {
  font-family: var(--mono);
  font-size: 22rpx;
  color: var(--ink-mute);
  background: #F0F0F0;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

/* 统计卡片 */
.records-stats {
  display: flex;
  margin: 0 40rpx 24rpx;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 28rpx;
  padding: 32rpx 0;
}
.records-stat {
  flex: 1;
  text-align: center;
}
.records-stat-num {
  font-family: var(--mono);
  font-size: 48rpx;
  font-weight: 700;
  color: var(--ink);
  display: block;
  line-height: 1;
}
.records-stat-label {
  font-size: 22rpx;
  color: var(--ink-mute);
  display: block;
  margin-top: 8rpx;
}

/* 角色标签条 */
.records-role-strip {
  display: flex;
  gap: 16rpx;
  padding: 0 40rpx 28rpx;
  flex-wrap: wrap;
}
.records-role-chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 20rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: 600;
  &.cpr { background: rgba(192, 57, 43, 0.08); color: var(--rescue-red); }
  &.aed { background: rgba(245, 158, 11, 0.08); color: #D97706; }
  &.assist { background: rgba(74, 144, 226, 0.08); color: #4A90E2; }
}
.records-role-chip-label {
  font-family: var(--serif);
}
.records-role-chip-count {
  font-family: var(--mono);
  font-size: 20rpx;
  opacity: 0.7;
}

/* 列表 */
.records-list {
  padding: 0 40rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.records-item {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 24rpx;
  overflow: hidden;
}
.records-item-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 28rpx;
}
.records-item-outcome {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  flex-shrink: 0;
  &.success { background: rgba(31, 138, 91, 0.1); }
  &.partial { background: rgba(245, 158, 11, 0.1); }
  &.transferred { background: rgba(74, 144, 226, 0.1); }
}
.records-item-body {
  flex: 1;
  min-width: 0;
}
.records-item-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--ink);
  display: block;
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.records-item-meta {
  font-size: 22rpx;
  color: var(--ink-mute);
  display: flex;
  gap: 8rpx;
}
.records-item-chevron {
  font-size: 28rpx;
  color: var(--ink-mute);
  transition: transform 0.25s;
  flex-shrink: 0;
  &.expanded {
    transform: rotate(180deg);
  }
}

/* 展开详情 */
.records-item-detail {
  padding: 0 28rpx 28rpx;
  border-top: 1px solid #F0F0F0;
  animation: expandIn 0.25s ease;
}
.records-detail-outcome {
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
  font-weight: 700;
  text-align: center;
  margin: 24rpx 0 20rpx;
  &.success { background: rgba(31, 138, 91, 0.08); color: var(--green); }
  &.partial { background: rgba(245, 158, 11, 0.08); color: #D97706; }
  &.transferred { background: rgba(74, 144, 226, 0.08); color: #4A90E2; }
}
.records-detail-meta {
  display: flex;
  gap: 24rpx;
  font-size: 22rpx;
  color: var(--ink-mute);
  margin-bottom: 24rpx;
}

/* 小队 & 时间线 共用 */
.records-detail-section {
  margin-bottom: 24rpx;
}
.records-detail-section-title {
  font-family: var(--serif);
  font-size: 24rpx;
  font-weight: 700;
  color: var(--ink-soft);
  display: block;
  margin-bottom: 16rpx;
}

/* 小队 */
.records-detail-squad {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}
.records-squad-member {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 20rpx;
  background: #F8F8F8;
  border-radius: 16rpx;
}
.records-squad-avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
  font-family: var(--serif);
}
.records-squad-info {
  display: flex;
  flex-direction: column;
}
.records-squad-name {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--ink);
}
.records-squad-role {
  font-size: 18rpx;
  color: var(--ink-mute);
}

/* 时间线 */
.records-detail-timeline {
  padding-left: 4rpx;
}
.records-timeline-item {
  display: flex;
  position: relative;
  padding-bottom: 20rpx;
  &:last-child {
    padding-bottom: 0;
  }
}
.records-timeline-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--rescue-red);
  flex-shrink: 0;
  margin-top: 6rpx;
  margin-right: 20rpx;
  position: relative;
  z-index: 1;
  border: 3rpx solid #fff;
  box-shadow: 0 0 0 3rpx var(--rescue-red);
  &.last {
    background: var(--green);
    box-shadow: 0 0 0 3rpx var(--green);
  }
}
.records-timeline-line {
  position: absolute;
  left: 6rpx;
  top: 24rpx;
  bottom: 0;
  width: 2rpx;
  background: var(--line);
}
.records-timeline-body {
  flex: 1;
  min-width: 0;
}
.records-timeline-time {
  font-family: var(--mono);
  font-size: 20rpx;
  color: var(--ink-mute);
  display: block;
  margin-bottom: 4rpx;
}
.records-timeline-text {
  font-size: 24rpx;
  color: var(--ink-soft);
  line-height: 1.6;
  display: block;
}

/* 空状态 */
.records-empty {
  text-align: center;
  padding: 120rpx 40rpx;
}
.records-empty-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 24rpx;
}
.records-empty-text {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--ink-soft);
  display: block;
  margin-bottom: 8rpx;
}
.records-empty-sub {
  font-size: 24rpx;
  color: var(--ink-mute);
  display: block;
}

@keyframes expandIn {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 2000rpx; }
}
</style>
