<template>
  <view class="page-home">
    <!-- 顶部导航栏 -->
    <view class="home-topbar">
      <view class="home-topbar-left" @click="goCert">
        <view class="home-avatar-sm">{{ user.avatar }}</view>
        <view>
          <view class="home-user-name-sm">
            <text>{{ user.name }}</text>
            <text v-if="tierLabel" class="home-tier-badge">{{ tierLabel }}</text>
            <text v-if="user.volunteerId" class="home-vid-badge">{{ user.volunteerId }}</text>
          </view>
          <view class="home-user-sub">
            {{ user.points.toLocaleString() }} 积分 · {{ user.city }}
            <text v-if="!user.id" class="home-login-link" @click.stop="goLogin">登录</text>
          </view>
          <view v-if="user.id" class="home-interest-tags">
            <text v-for="i in interestTags" :key="i" class="home-interest-tag">{{ i }}</text>
          </view>
        </view>
      </view>
      <view class="home-logo">
        <LifeSparkLogo :size="48" />
        <text class="home-logo-text">急救侠</text>
      </view>
      <view class="home-notif-btn" @click="goNews">🔔</view>
    </view>

    <!-- 紧急任务卡片 -->
    <view v-if="currentTask" class="home-mission-card" @click="goMission">
      <view class="mc-header">
        <view class="mc-pulse" />
        <text class="mc-title">{{ currentTask.title }}</text>
        <text class="mc-count">{{ cycleIndex+1 }}/{{ taskStore?.tasks?.length || 0 }}</text>
        <text v-if="currentTask?.liveCount>0" class="mc-live">🔴 {{ currentTask.liveCount }}直播</text>
      </view>
      <text class="mc-desc">{{ currentTask.description }}</text>
      <view class="mc-details">
        <view class="mc-detail"><text class="mcd-lbl">📍</text><text class="mcd-val">{{ currentTask.address }}</text></view>
        <view class="mc-detail"><text class="mcd-lbl">📏</text><text class="mcd-val">{{ currentTask.distance }}m · {{ sceneLabel(currentTask.sceneType) }}</text></view>
        <view class="mc-detail" v-if="currentTask.patientAge"><text class="mcd-lbl">👤</text><text class="mcd-val">{{ currentTask.patientAge }}岁 {{ currentTask.patientGender }}</text></view>
      </view>
      <view class="mc-progress">
        <view class="mc-progress-bar">
          <view class="mc-progress-fill" :style="{ width: progressPct + '%' }" />
        </view>
        <text class="mc-progress-text">{{ currentTask.volunteersResponded }}/{{ currentTask.volunteersNeeded }} 已响应 · {{ currentTask.volunteersEnRoute }} 在路上</text>
      </view>
      <view class="mc-action">点击响应 →</view>
    </view>

    <view v-else-if="!currentTask && taskStore?.tasks?.length === 0" class="home-mission-card home-mission-empty">
      <text class="mce-text">🟢 当前没有紧急任务</text>
      <text class="mce-sub">附近出现求助时会自动推送</text>
    </view>

    <!-- 紧急操作行 -->
    <view class="home-emergency-row">
      <view class="home-sos-compact" @click="goRescue">
        <text class="home-sos-icon">🆘</text>
        <text class="home-sos-label">急救</text>
      </view>
      <view class="home-emergency-item" @click="goMediaAlert">
        <text class="home-emergency-icon">📸</text>
        <text class="home-emergency-label">报警</text>
      </view>
      <view class="home-emergency-stat">
        <text class="home-emergency-num">{{ animatedStats.certifiedRescuers }}</text>
        <text class="home-emergency-lbl">认证</text>
      </view>
      <view class="home-emergency-stat">
        <text class="home-emergency-num">{{ animatedStats.networkedAeds }}</text>
        <text class="home-emergency-lbl">AED</text>
      </view>
      <view class="home-emergency-stat">
        <text class="home-emergency-num">{{ animatedStats.monthlyRescues }}</text>
        <text class="home-emergency-lbl">救援</text>
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
      <view class="home-module-btn" @click="goPage('/pages/video/index')">
        <view class="home-module-inner">
          <view class="home-module-icon" style="background:#FFF0F5;">🎬</view>
          <text class="home-module-name">视频号</text>
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
      <view class="home-module-btn" @click="goPage('/pages/trail/index')"><view class="home-module-inner"><view class="home-module-icon" style="background:#EBF5FB;">🥾</view><text class="home-module-name">徒友社区</text></view></view>
      <view class="home-module-btn" @click="goPage('/pages/rescue/mobilize')"><view class="home-module-inner"><view class="home-module-icon" style="background:#FFEBEE;">🚨</view><text class="home-module-name">救援动员</text></view></view>
      <view class="home-module-btn" @click="goPage('/pages/community/index')"><view class="home-module-inner"><view class="home-module-icon" style="background:#E8F5E9;">💬</view><text class="home-module-name">社区</text></view></view>
    </scroll-view>

    <!-- 推荐流 = 远处直播 + 回放 + 讨论 + 总结 -->
    <view class="home-section-header">🔥 推荐 · 发现</view>
    <view class="home-feed">
      <view v-for="item in feedItems" :key="item.id" :class="item._isReplay?'home-replay-card-feed':'home-feed-card'" @click="item._isReplay?openReplay(item):goNewsDetail(item.id)">
        <view class="feed-cover" v-if="item.coverImage" :style="{ background: 'url('+item.coverImage+') center/cover' }">
          <text v-if="item.isLive" class="feed-live-tag">🔴 LIVE</text>
          <text class="feed-type-tag">{{ feedTypeLabel(item.type) }}</text>
        </view>
        <view class="feed-body">
          <text class="feed-title">{{ item._isReplay ? '✅ ' : '' }}{{ item.title }}</text>
          <text class="feed-excerpt">{{ item._isReplay ? item.description : item.excerpt }}</text>
          <view class="feed-meta">
            <view class="feed-author">
              <text class="feed-author-avatar">{{ item.author?.avatar || '?' }}</text>
              <text class="feed-author-name">{{ item.author?.name || '急救侠' }}</text>
            </view>
            <view class="feed-stats">
              <text>👁 {{ (item.stats?.views||0).toLocaleString() }}</text>
              <text :class="item._liked?'feed-stat-active':''" @click.stop="toggleLike(item)">{{item._liked?'❤️':'🤍'}} {{ (item.stats?.likes||0)+(item._liked?1:0) }}</text>
              <text @click.stop="openComment(item)">💬 {{ (item.stats?.comments||0) }}</text>
              <text :class="item._bookmarked?'feed-stat-active':''" @click.stop="toggleBookmark(item)">{{item._bookmarked?'🔖':'🏷️'}}</text>
            </view>
          </view>
          <view class="feed-tags">
            <text v-for="t in item.tags" :key="t" class="feed-tag">{{ t }}</text>
          </view>
        </view>
      </view>
      <view v-if="loadingMore" class="feed-loading">加载中...</view>
      <view v-if="!hasMore" class="feed-end">— 已加载全部 —</view>
    </view>


  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
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

// 任务循环滚动
const cycleIndex = ref(0)
const currentTask = computed(() => taskStore?.tasks?.[cycleIndex.value] || null)
const progressPct = computed(() => {
  const t = currentTask.value
  if (!t || t.volunteersNeeded === 0) return 0
  return Math.min(100, Math.round((t.volunteersResponded / t.volunteersNeeded) * 100))
})
function sceneLabel(s: string) { return { outdoor:'户外', office:'办公', road:'道路', home:'住宅', public:'公共' }[s] || s }
let cycleTimer: any = null
onMounted(() => {
  if ((taskStore?.tasks?.length ?? 0) > 1) {
    cycleTimer = setInterval(() => {
      cycleIndex.value = (cycleIndex.value + 1) % taskStore.tasks.length
    }, 3000)
  }
})
onUnmounted(() => { if (cycleTimer) clearInterval(cycleTimer) })
onReachBottom(() => { loadMoreFeed() })

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
  watch(() => taskStore?.activeTask, (task) => {
    if (task) {
      setTimeout(() => {
        playAlertSound(); voice.command('紧急任务！' + task.distance + '米外需要 C P R 协作！')
        setTimeout(() => voice.command('系统正在呼叫三人小队，请查看任务'), 2500)
      }, 500)
    }
  })
})

// --- 推荐流 ---
const allNewsItems = computed(() => newsStore.items)
const feedItems = ref<any[]>([])
const feedPage = ref(0), pageSize = 8
const loadingMore = ref(false), hasMore = ref(true)

function feedTypeLabel(t: string) { return { video:'🎬', photo:'🖼️', live:'🔴', story:'📖', article:'📰', map:'🗺️' }[t] || t }
function toggleLike(item: any) { item._liked = !item._liked }
function toggleBookmark(item: any) { item._bookmarked = !item._bookmarked; uni.showToast({ title: item._bookmarked ? '已收藏' : '已取消', icon: 'none' }) }
function openComment(item: any) {
  uni.showModal({ title: '评论', content: `给「${item.title}」留言：`, editable: true, placeholderText: '写下你的想法...', success: (res: any) => {
    if (res.confirm && res.content) { item.stats.comments = (item.stats.comments||0) + 1; uni.showToast({ title: '已发表', icon: 'none' }) }
  }})
}

function loadMoreFeed() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  setTimeout(() => {
    const start = feedPage.value * pageSize
    const batch = allNewsItems.value.slice(start, start + pageSize)
    if (batch.length === 0) { hasMore.value = false }
    else { feedItems.value.push(...batch); feedPage.value++ }
    loadingMore.value = false
  }, 300)
}

// 底部触底加载
function onScrollToLower() {
  loadMoreFeed()
}

loadMoreFeed()

// --- 救援回放（融入推荐流） ---
async function loadReplays() {
  try {
    const rps = await request<any[]>({ url: '/replay?limit=5' })
    // 将回放作为特殊卡片插入推荐流
    rps.forEach((rp, i) => {
      feedItems.value.splice(i * 4 + 2, 0, { ...rp, _isReplay: true })
    })
  } catch {}
}
function outcomeIcon(o: string) { return o==='成功'?'✅':o==='进行中'?'🔴':'📋' }
function openReplay(rp: any) { uni.navigateTo({ url: `/pages/rescue/replay-detail?id=${rp.id}` }) }
setTimeout(loadReplays, 1000)

// --- 常量 ---
const tierLabel = userStore.tierLabel
const interestIcons: Record<string, string> = { medical:'🩺', pet:'🐱', wildlife:'🦅', disaster:'🚨', trail:'🥾' }
const interestTags = computed(() => {
  if (!user.id) return []
  const t = (user as any).volunteer_type || ''
  return t.split(',').filter(Boolean).map(k => interestIcons[k] || '').filter(Boolean)
})
const hasAnimalInterest = computed(() => {
  if (!user.id) return true
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
  {
    id: 'drill', name: '急救演习', route: '/pages/drill/index',
    bg: '#FFF8E0', color: '#C0392B',
    path: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
  },
]

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
  const tid = currentTask.value?.id || ''
  uni.navigateTo({ url: `/pages/rescue/task-detail?id=${tid}` })
}
function goLogin() { uni.navigateTo({ url: '/pages/auth/login' }) }
</script>

<style lang="scss" scoped>
/* ============================================
   首页样式 — 从 style.css 精确迁移
   ============================================ */

.page-home {
  background: var(--paper);
  padding-bottom: 120rpx;
}

/* 紧凑布局 */
.home-topbar-compact { padding: 10rpx 20rpx 6rpx; }
.home-stat-inline { font-size: 18rpx; color: var(--ink-mute); }
.home-emergency-row { display: flex; align-items: center; gap: 8rpx; padding: 6rpx 16rpx; }
.home-sos-compact { display: flex; align-items: center; gap: 8rpx; background: #C0392B; border-radius: 24rpx; padding: 14rpx 20rpx; }
.home-sos-icon { font-size: 32rpx; }
.home-sos-label { font-size: 24rpx; color: #fff; font-weight: 700; }
.home-emergency-item { display: flex; align-items: center; gap: 6rpx; background: #FFE8E5; border-radius: 24rpx; padding: 14rpx 20rpx; }
.home-emergency-icon { font-size: 24rpx; }
.home-emergency-label { font-size: 22rpx; color: #C0392B; font-weight: 600; }
.home-emergency-stat { flex: 1; text-align: center; padding: 6rpx 4rpx; }
.home-emergency-num { font-size: 26rpx; font-weight: 900; font-family: 'SF Mono', Menlo, monospace; display: block; }
.home-emergency-lbl { font-size: 16rpx; color: var(--ink-mute); display: block; }
.home-mission-card { margin: 8rpx 16rpx; padding: 20rpx 24rpx; background: linear-gradient(135deg,#2C1810,#1A0F08); border: 1px solid rgba(192,57,43,.3); border-radius: 20rpx; overflow: hidden; position: relative; }
.home-mission-card::before { content:''; position:absolute; inset:0; background: radial-gradient(circle at 20% 30%, rgba(192,57,43,.15) 0%, transparent 70%); pointer-events:none; }
.home-mission-empty { background: #f8f8f6; border-color: #e0e0e0; padding: 32rpx 24rpx; text-align: center; }
.mce-text { font-size: 24rpx; font-weight: 600; color: #666; display: block; }
.mce-sub { font-size: 20rpx; color: #999; margin-top: 4rpx; display: block; }
.mc-header { display: flex; align-items: center; gap: 10rpx; margin-bottom: 12rpx; }
.mc-pulse { width: 14rpx; height: 14rpx; border-radius: 50%; background: #E63946; animation: missionPulse 1s infinite; flex-shrink: 0; }
@keyframes missionPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .3; transform: scale(2); } }
.mc-title { font-size: 28rpx; font-weight: 800; color: #fff; flex: 1; }
.mc-count { font-size: 18rpx; color: rgba(255,255,255,.4); background: rgba(255,255,255,.1); padding: 2rpx 10rpx; border-radius: 10rpx; }
.mc-live { font-size: 18rpx; color: #FF6B6B; background: rgba(255,107,107,.15); padding: 2rpx 8rpx; border-radius: 10rpx; animation: mcPulse 2s infinite; } @keyframes mcPulse { 0%,100% { opacity:1 } 50% { opacity:.6 } }
.mc-desc { font-size: 22rpx; color: rgba(255,255,255,.7); display: block; margin-bottom: 14rpx; line-height: 1.5; }
.mc-details { margin-bottom: 14rpx; }
.mc-detail { display: flex; align-items: center; gap: 8rpx; margin-bottom: 6rpx; }
.mcd-lbl { font-size: 22rpx; flex-shrink: 0; }
.mcd-val { font-size: 20rpx; color: rgba(255,255,255,.6); }
.mc-progress { margin-bottom: 14rpx; }
.mc-progress-bar { height: 8rpx; background: rgba(255,255,255,.1); border-radius: 4rpx; overflow: hidden; margin-bottom: 8rpx; }
.mc-progress-fill { height: 100%; background: linear-gradient(90deg,#E63946,#FF6B6B); border-radius: 4rpx; transition: width .5s; }
.mc-progress-text { font-size: 20rpx; color: rgba(255,255,255,.5); display: block; }
.mc-action { text-align: center; padding: 12rpx; background: rgba(192,57,43,.3); border-radius: 12rpx; font-size: 24rpx; color: #FF6B6B; font-weight: 700; }

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
.home-login-link { color: var(--rescue-red); font-weight: 700; margin-left: 12rpx; }
.home-interest-tags { display: flex; gap: 6rpx; margin-top: 4rpx; }
.home-interest-tag { font-size: 16rpx; opacity: 0.7; }
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

/* 推荐流 */
.home-feed { padding: 0 24rpx 40rpx; }
.home-feed-card { background: #fff; border-radius: 20rpx; overflow: hidden; margin-bottom: 24rpx; box-shadow: 0 2rpx 16rpx rgba(0,0,0,.06); }
.feed-cover { height: 320rpx; display: flex; align-items: flex-end; justify-content: space-between; padding: 16rpx; position: relative; }
.feed-live-tag { background: #E63946; color: #fff; padding: 4rpx 14rpx; border-radius: 12rpx; font-size: 20rpx; font-weight: 700; }
.feed-type-tag { background: rgba(0,0,0,.5); color: #fff; padding: 2rpx 12rpx; border-radius: 8rpx; font-size: 18rpx; }
.feed-body { padding: 20rpx; }
.feed-title { font-size: 28rpx; font-weight: 700; display: block; margin-bottom: 8rpx; }
.feed-excerpt { font-size: 22rpx; color: var(--ink-mute); display: block; margin-bottom: 12rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.feed-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10rpx; }
.feed-author { display: flex; align-items: center; gap: 8rpx; }
.feed-author-avatar { width: 36rpx; height: 36rpx; border-radius: 50%; background: var(--rescue-red); display: flex; align-items: center; justify-content: center; font-size: 20rpx; color: #fff; font-weight: 700; }
.feed-author-name { font-size: 20rpx; color: var(--ink-soft); }
.feed-stats { display: flex; gap: 16rpx; font-size: 18rpx; color: var(--ink-mute); }
.feed-stats text { cursor: pointer; padding: 4rpx; }
.feed-stat-active { color: var(--rescue-red) !important; font-weight: 600; }
.feed-tags { display: flex; gap: 8rpx; flex-wrap: wrap; }
.feed-tag { padding: 3rpx 12rpx; border-radius: 10rpx; font-size: 18rpx; background: #F0F0F0; color: var(--ink-soft); }
.feed-loading { text-align: center; padding: 24rpx; font-size: 22rpx; color: var(--ink-mute); }
.feed-end { text-align: center; padding: 32rpx 0 60rpx; font-size: 22rpx; color: var(--ink-mute); }
.feed-empty { text-align: center; padding: 40rpx 0; color: #999; font-size: 22rpx; }

/* 救援回放 */
.home-replays { padding: 0 24rpx 24rpx; }
.home-replay-card { background: linear-gradient(135deg,#1B2A1A,#0F1A0F); border: 1px solid rgba(52,210,119,.2); border-radius: 20rpx; padding: 20rpx 24rpx; margin-bottom: 16rpx; }
.rpc-top { display: flex; align-items: center; gap: 12rpx; margin-bottom: 10rpx; }
.rpc-icon { font-size: 32rpx; flex-shrink: 0; }
.rpc-info { flex: 1; }
.rpc-title { font-size: 26rpx; font-weight: 700; color: #fff; display: block; }
.rpc-addr { font-size: 20rpx; color: rgba(255,255,255,.5); margin-top: 2rpx; display: block; }
.rpc-desc { font-size: 22rpx; color: rgba(255,255,255,.6); display: block; margin-bottom: 12rpx; }
.rpc-stats { display: flex; gap: 20rpx; }
.rpc-stat { font-size: 20rpx; color: rgba(255,255,255,.4); }
</style>
