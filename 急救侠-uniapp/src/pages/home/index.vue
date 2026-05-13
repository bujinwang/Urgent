<template>
  <view class="page-home">
    <!-- 顶部导航栏 -->
    <view class="home-topbar">
      <view class="home-topbar-left" @click="goCert">
        <view class="home-avatar-sm">{{ user.avatar }}</view>
        <view>
          <view class="home-user-name-sm">
            <text>{{ user.name }}</text>
            <text class="home-tier-badge">{{ tierLabel }}</text>
            <text class="home-vid-badge">{{ user.volunteerId }}</text>
          </view>
          <view class="home-user-sub">{{ user.points.toLocaleString() }} 积分 · {{ user.city }}</view>
        </view>
      </view>
      <view class="home-logo">
        <LifeSparkLogo :size="48" />
        <text class="home-logo-text">急救侠</text>
      </view>
      <view class="home-notif-btn" @click="goNews">🔔</view>
    </view>

    <!-- 在线状态栏 -->
    <view class="home-status-bar">
      <view class="home-status-live">
        <view class="home-status-green-dot" />
        <text>附近 {{ stats.onlineVolunteers }} 名志愿者在线</text>
      </view>
      <text class="home-status-aed">⚡ 1km 内 {{ stats.aedsWithin1km }} 台 AED</text>
    </view>

    <!-- SOS 按钮（组件） -->
    <view class="home-sos-wrap">
      <SosButton
        title="紧急处理"
        subtitle="语音引导 · 召唤志愿者 · 联动 120"
        @click="goRescue"
      />
    </view>

    <!-- 一键图片视频报警 -->
    <view class="home-media-alert" @click="goMediaAlert">
      <view class="home-media-pulse" />
      <view class="home-media-content">
        <text class="home-media-icon">📸</text>
        <view class="home-media-body">
          <text class="home-media-title">一键图片视频报警</text>
          <text class="home-media-sub">拍照/录像 · 发送现场给 120</text>
        </view>
        <text class="home-media-arrow">→</text>
      </view>
    </view>

    <!-- 紧急任务 Banner（组件） -->
    <MissionBanner
      v-if="activeTask"
      :distance="activeTask.distance"
      :volunteers="activeTask.volunteersNeeded"
      @click="goMission"
    />

    <!-- 数据概览 -->
    <view class="home-stats-strip">
      <view class="home-strip-item">
        <text class="home-strip-num">{{ animatedStats.certifiedRescuers }}</text>
        <text class="home-strip-lbl">认证急救侠</text>
      </view>
      <view class="home-strip-divider" />
      <view class="home-strip-item">
        <text class="home-strip-num">{{ animatedStats.networkedAeds }}</text>
        <text class="home-strip-lbl">联网 AED</text>
      </view>
      <view class="home-strip-divider" />
      <view class="home-strip-item">
        <text class="home-strip-num">{{ animatedStats.monthlyRescues }}</text>
        <text class="home-strip-lbl">本月救援</text>
      </view>
    </view>

    <!-- 功能模块（横向滑动） -->
    <view class="home-section-header">功能</view>
    <scroll-view class="home-modules-scroll" scroll-x :show-scrollbar="false">
      <view v-for="mod in modules" :key="mod.id" class="home-module-btn" @click="goPage(mod.route)">
        <view class="home-module-inner">
          <view class="home-module-icon" :style="{ background: mod.bg }">
            <svg width="26" height="26" viewBox="0 0 24 24" :fill="mod.color">
              <path :d="mod.path" />
            </svg>
          </view>
          <text class="home-module-name">{{ mod.name }}</text>
        </view>
      </view>
      <view class="home-module-btn" @click="goMediaAlert">
        <view class="home-module-inner">
          <view class="home-module-icon" style="background:#FFEBEE;">
            <text style="font-size:28rpx;">📸</text>
          </view>
          <text class="home-module-name">图片报警</text>
        </view>
      </view>
      <view class="home-module-btn" @click="goNews">
        <view class="home-module-inner">
          <view class="home-module-icon" style="background:#FFE8E5;">📰</view>
          <text class="home-module-name">救援动态</text>
        </view>
      </view>
    </scroll-view>

    <!-- 动物救援模块 — 仅选了 pet/wildlife 兴趣的用户可见 -->
    <view v-if="hasAnimalInterest" class="home-section-header" style="margin-top:8rpx;">🐾 动物救援</view>
    <scroll-view v-if="hasAnimalInterest" class="home-modules-scroll" scroll-x :show-scrollbar="false">
      <view class="home-module-btn" @click="goPage('/pages/wildlife/index')"><view class="home-module-inner"><view class="home-module-icon" style="background:#E8F5E9;">🦅</view><text class="home-module-name">动物上报</text></view></view>
      <view class="home-module-btn" @click="goPage('/pages/animals/index')"><view class="home-module-inner"><view class="home-module-icon" style="background:#FFF3E0;">🐾</view><text class="home-module-name">动物档案</text></view></view>
      <view class="home-module-btn" @click="goPage('/pages/drill/index')"><view class="home-module-inner"><view class="home-module-icon" style="background:#FFF8E0;">📋</view><text class="home-module-name">急救演习</text></view></view>
      <view class="home-module-btn" @click="goPage('/pages/trail/index')"><view class="home-module-inner"><view class="home-module-icon" style="background:#EBF5FB;">🥾</view><text class="home-module-name">徒友社区</text></view></view>
      <view class="home-module-btn" @click="goPage('/pages/rescue/mobilize')"><view class="home-module-inner"><view class="home-module-icon" style="background:#FFEBEE;">🚨</view><text class="home-module-name">救援动员</text></view></view>
      <view class="home-module-btn" @click="goPage('/pages/community/index')"><view class="home-module-inner"><view class="home-module-icon" style="background:#E8F5E9;">💬</view><text class="home-module-name">社区</text></view></view>
    </scroll-view>

    <!-- 最近动态 -->
    <view class="home-section-header">最近动态</view>
    <view class="home-activity-list">
      <view v-for="item in activities" :key="item.id" class="home-activity-item" @click="goNewsDetail(item.id)">
        <view class="home-activity-icon" :style="{ background: item.bg }">{{ item.icon }}</view>
        <view class="home-activity-body">
          <text class="home-activity-title">{{ item.title }}</text>
          <text class="home-activity-meta">{{ item.meta }}</text>
        </view>
      </view>
    </view>

    <view class="home-view-all" @click="goNews">
      <text>查看全部救援动态 →</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import LifeSparkLogo from '@/components/LifeSparkLogo/index.vue'
import SosButton from '@/components/SosButton/index.vue'
import MissionBanner from '@/components/MissionBanner/index.vue'
import { useUserStore } from '@/stores/user'
import { useTaskStore } from '@/stores/task'
import { useNewsStore } from '@/stores/news'
import { voice } from '@/utils/voice'
import { playAlertSound } from '@/utils/audio'

// --- stores ---
const userStore = useUserStore()
const taskStore = useTaskStore()
const newsStore = useNewsStore()

const user = userStore.profile
const stats = userStore.stats
const activeTask = taskStore.activeTask

// 数字滚动动画
const animatedStats = reactive({
  certifiedRescuers: '0',
  networkedAeds: '0',
  monthlyRescues: '0',
})

function animateNumber(key: keyof typeof animatedStats, target: number) {
  const duration = 1200
  const start = Date.now()
  const timer = setInterval(() => {
    const elapsed = Date.now() - start
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = Math.floor(target * eased)
    ;(animatedStats as any)[key] = current.toLocaleString()
    if (progress >= 1) {
      ;(animatedStats as any)[key] = target.toLocaleString()
      clearInterval(timer)
    }
  }, 16)
}

onMounted(() => {
  // 预加载机构角色，避免「我的」页闪烁
  userStore.loadOrgRoles()

  // 数字滚动入场 — 使用 store 真实数据
  // #ifndef MP-WEIXIN
  requestAnimationFrame(() => {
    animateNumber('certifiedRescuers', stats.certifiedRescuers)
    animateNumber('networkedAeds', stats.networkedAeds)
    animateNumber('monthlyRescues', stats.monthlyRescues)
  })
  // #endif
  // #ifdef MP-WEIXIN
  setTimeout(() => {
    animateNumber('certifiedRescuers', stats.certifiedRescuers)
    animateNumber('networkedAeds', stats.networkedAeds)
    animateNumber('monthlyRescues', stats.monthlyRescues)
  }, 0)
  // #endif


  // 紧急任务语音告警
  watch(() => taskStore.activeTask, (task) => {
    if (task) {
      setTimeout(() => {
        playAlertSound(); voice.command('紧急任务！' + task.distance + '米外需要 C P R 协作！')
        setTimeout(() => voice.command('系统正在呼叫三人小队，请查看任务'), 2500)
      }, 500)
    }
  })
})

// --- 常量 ---
const tierLabel = userStore.tierLabel
const hasAnimalInterest = computed(() => {
  const t = (user as any).volunteer_type || ''
  return t.includes('pet') || t.includes('wildlife')
})

interface Module {
  id: string
  name: string
  route: string
  bg: string
  color: string
  path: string
}

const modules: Module[] = [
  {
    id: 'aed', name: '附近 AED', route: '/pages/aed/index',
    bg: '#FFE8E5', color: '#C0392B',
    path: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z',
  },
  {
    id: 'cpr', name: 'CPR 引导', route: '/pages/rescue/index',
    bg: '#FFEAEA', color: '#C0392B',
    path: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
  },
  {
    id: 'atlas', name: '急救图谱', route: '/pages/atlas/index',
    bg: '#FFF8E0', color: '#C8A656',
    path: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14h-4v-2h4v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  },
  {
    id: 'learn', name: '学习训练', route: '/pages/learn/index',
    bg: '#E8F5EF', color: '#1F8A5B',
    path: 'M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z',
  },
  {
    id: 'cert', name: '我的徽章', route: '/pages/cert/index',
    bg: '#EEF2FF', color: '#4A90E2',
    path: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  },
  {
    id: 'volunteer', name: '排行榜', route: '/pages/volunteer/index',
    bg: '#FEF3C7', color: '#D97706',
    path: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  },
]

/** 从新闻 store 驱动最近动态，取前 3 条 */
const categoryIcon: Record<string, string> = {
  video: '▶️', photo: '🖼️', live: '🔴', story: '📖', article: '📰', map: '🗺️',
}
const categoryBg: Record<string, string> = {
  video: '#FFF3E0', photo: '#E8F5EF', live: '#FFE8E5', story: '#EEF2FF', article: '#FFF8E0', map: '#E8F5EF',
}
const activities = computed(() =>
  newsStore.items.slice(0, 3).map((n) => ({
    id: n.id,
    icon: n.isLive ? '🔴' : (categoryIcon[n.type] || '📰'),
    bg: n.tags.includes('成功案例') ? '#E8F5EF' : (categoryBg[n.type] || '#FFF8E0'),
    title: n.title,
    meta: `${n.time} · ${n.location.name}`,
  }))
)

// --- 导航 ---
function goPage(route: string) {
  if (route.startsWith('/pages/aed') || route.startsWith('/pages/cert') || route.startsWith('/pages/learn')) {
    uni.switchTab({ url: route })
  } else {
    uni.navigateTo({ url: route })
  }
}

function goCert() {
  uni.switchTab({ url: '/pages/cert/index' })
}

function goRescue() {
  uni.navigateTo({ url: '/pages/rescue/index' })
}

function goMediaAlert() {
  uni.navigateTo({ url: '/pages/media-alert/index' })
}

function goNews() {
  uni.navigateTo({ url: '/pages/news/index' })
}

function goNewsDetail(id: string) {
  uni.navigateTo({ url: `/pages/news/detail?id=${id}` })
}

function goMission() {
  uni.navigateTo({ url: '/pages/mission/index' })
}
</script>

<style lang="scss" scoped>
/* ============================================
   首页样式 — 从 style.css 精确迁移
   ============================================ */

.page-home {
  background: var(--paper);
  padding-bottom: 120rpx;
}

/* 顶部导航 */
.home-topbar {
  display: flex;
  align-items: center;
  padding: 32rpx 40rpx 24rpx;
  gap: 16rpx;
}
.home-topbar-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.home-avatar-sm {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--rescue-red), var(--rescue-red-deep));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--serif);
  font-weight: 700;
  font-size: 32rpx;
  flex-shrink: 0;
}
.home-user-name-sm {
  font-size: 28rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.home-tier-badge {
  background: linear-gradient(135deg, var(--gold), #B8941A);
  color: #fff;
  font-size: 18rpx;
  font-family: var(--mono);
  padding: 2rpx 12rpx;
  border-radius: 12rpx;
  font-weight: 700;
  letter-spacing: 0.6rpx;
}
.home-vid-badge {
  font-family: var(--mono);
  font-size: 18rpx;
  color: var(--rescue-red);
  font-weight: 700;
  background: var(--rescue-red-soft);
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
}
.home-user-sub {
  font-size: 22rpx;
  color: var(--ink-mute);
  margin-top: 2rpx;
}
.home-logo {
  flex: 1;
  text-align: center;
  font-family: var(--serif);
  font-size: 40rpx;
  font-weight: 900;
  color: var(--rescue-red);
  letter-spacing: -1rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}
.home-logo-text {
  font-family: var(--serif);
  font-size: 40rpx;
  font-weight: 900;
  color: var(--rescue-red);
}
.home-notif-btn {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: var(--paper-warm);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
}

/* 状态栏 */
.home-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 40rpx 24rpx;
  padding: 20rpx 28rpx;
  background: var(--green-soft);
  border-radius: 28rpx;
  border: 1px solid rgba(31, 138, 91, 0.2);
}
.home-status-live {
  display: flex;
  align-items: center;
  gap: 14rpx;
  font-size: 24rpx;
  color: var(--green);
  font-weight: 600;
}
.home-status-green-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--green);
  animation: blink 1.4s ease-in-out infinite;
  flex-shrink: 0;
}
.home-status-aed {
  font-size: 22rpx;
  color: var(--ink-mute);
}

.home-sos-wrap { padding: 0 40rpx 12rpx; }

/* 一键图片视频报警 */
.home-media-alert {
  margin: 0 40rpx 20rpx;
  padding: 28rpx 32rpx;
  background: linear-gradient(135deg, #1E3A5F, #162D4A);
  border: 2px solid rgba(59, 130, 246, 0.35);
  border-radius: 28rpx;
  position: relative;
  overflow: hidden;
}
.home-media-pulse {
  position: absolute;
  inset: -2rpx;
  border-radius: 28rpx;
  border: 2px solid rgba(59, 130, 246, 0.2);
  animation: mediaPulse 2s ease-in-out infinite;
}
.home-media-content {
  display: flex;
  align-items: center;
  gap: 20rpx;
  position: relative;
  z-index: 1;
}
.home-media-icon {
  font-size: 48rpx;
  flex-shrink: 0;
}
.home-media-body {
  flex: 1;
}
.home-media-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4rpx;
}
.home-media-sub {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.55);
}
.home-media-arrow {
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.5);
}
@keyframes mediaPulse {
  0% { opacity: 0.6; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.03); }
}

/* SOS 按钮 & 使命 Banner 样式已迁移到组件 */

/* 数据条 */
.home-stats-strip {
  display: flex;
  align-items: center;
  margin: 0 40rpx 40rpx;
  padding: 28rpx 40rpx;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 32rpx;
}
.home-strip-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.home-strip-num {
  font-family: var(--mono);
  font-size: 34rpx;
  font-weight: 700;
  color: var(--ink);
  line-height: 1;
}
.home-strip-lbl {
  font-size: 20rpx;
  color: var(--ink-mute);
  letter-spacing: 0.6rpx;
}
.home-strip-divider {
  width: 2rpx;
  height: 60rpx;
  background: var(--line);
}

/* Section header */
.home-section-header {
  padding: 0 40rpx;
  font-family: var(--serif);
  font-weight: 700;
  font-size: 28rpx;
  color: var(--ink-soft);
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;

  &::before {
    content: '';
    width: 8rpx;
    height: 28rpx;
    background: var(--rescue-red);
    border-radius: 4rpx;
    flex-shrink: 0;
  }
}

/* 模块横滑 */
.home-modules-scroll {
  white-space: nowrap;
  width: 100%;
  padding-bottom: 48rpx;
}

.home-module-btn {
  display: inline-block;
  width: 152rpx;
  padding: 0 10rpx;
  white-space: normal;
  vertical-align: top;
  flex-shrink: 0;
}
.home-module-btn:first-child {
  padding-left: 40rpx;
}
.home-module-btn:last-child {
  padding-right: 40rpx;
}

.home-module-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.home-module-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  transition: transform 0.15s;
}
.home-module-btn:active .home-module-icon {
  transform: scale(0.91);
}
.home-module-name {
  font-size: 22rpx;
  color: var(--ink-soft);
  text-align: center;
  font-weight: 500;
  line-height: 1.3;
}

/* 动态列表 */
.home-activity-list {
  padding: 0 40rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.home-activity-item {
  display: flex;
  align-items: center;
  gap: 28rpx;
  padding: 28rpx 32rpx;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 28rpx;
}
.home-activity-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38rpx;
  flex-shrink: 0;
}
.home-activity-body {
  flex: 1;
}
.home-activity-title {
  font-size: 26rpx;
  font-weight: 600;
  margin-bottom: 6rpx;
  line-height: 1.4;
  color: var(--ink);
  display: block;
}
.home-activity-meta {
  font-size: 22rpx;
  color: var(--ink-mute);
  display: block;
}

.home-view-all {
  text-align: center;
  padding: 16rpx 0 48rpx;

  text {
    color: var(--rescue-red);
    font-size: 26rpx;
    font-family: var(--serif);
    font-weight: 700;
  }
}
</style>
