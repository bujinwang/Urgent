<template>
  <view class="page-drill">
    <view class="drill-header"><text class="drill-title">{{ $t('drill.title') }}</text></view>
    <view class="drill-tabs">
      <view class="drill-tab" :class="{active:tab==='upcoming'}" @click="tab='upcoming'">{{ $t('drill.tab.upcoming') }}</view>
      <view class="drill-tab" :class="{active:tab==='completed'}" @click="tab='completed'">{{ $t('drill.tab.completed') }}</view>
      <view class="drill-tab" :class="{active:tab==='records'}" @click="tab='records';loadRecords()">{{ $t('drill.tab.records') }}</view>
    </view>
    <view class="drill-list" v-if="tab!=='records'">
      <view v-for="d in displayDrills" :key="d.id" class="drill-card">
        <view class="drill-card-top">
          <view class="drill-status-dot" :style="{background:statusColor(d.status)}"></view>
          <view class="drill-card-body"><text class="drill-card-title">{{d.title}}</text><text class="drill-card-scenario">{{scenarioLabel(d.scenario)}}</text></view>
          <text class="drill-card-status">{{statusLabel(d.status)}}</text>
        </view>
        <text class="drill-card-desc">{{d.description}}</text>
        <view class="drill-card-meta">
          <text>📅 {{d.date}}</text><text>📍 {{d.location}}</text><text>👤 {{d.organizerName}}</text><text>{{ $t('drill.participants', { current: d.currentParticipants, max: d.maxParticipants }) }}</text><text>{{ $t('drill.pointsReward', { points: d.pointsReward }) }}</text>
        </view>
        <view class="drill-card-actions">
          <view v-if="d.status==='upcoming'" class="drill-btn" @click="join(d)">{{ $t('drill.join') }}</view>
          <view v-if="d.status==='upcoming' && d.organizerId===userStore.profile.id" class="drill-btn complete" @click="complete(d)">{{ $t('drill.complete') }}</view>
        </view>
      </view>
      <view v-if="displayDrills.length===0" class="drill-empty">{{ tab==='completed' ? $t('drill.empty.completed') : $t('drill.empty.upcoming') }}</view>
    </view>
    <!-- Training Records -->
    <view v-if="tab==='records'" class="drill-list">
      <view v-for="r in records" :key="r.id" class="drill-card">
        <view class="drill-card-top">
          <view class="drill-status-dot" style="background:#34D277"></view>
          <view class="drill-card-body"><text class="drill-card-title">{{scenarioLabel(r.scenario)}}</text><text class="drill-card-scenario">{{ $t('drill.organizerLine', { name: r.organizerName }) }}</text></view>
          <text class="drill-card-status">{{ $t('drill.recordTrained') }}</text>
        </view>
        <text class="drill-card-desc">{{r.notes}}</text>
        <view class="drill-card-meta"><text>📅 {{r.date}}</text></view>
      </view>
      <view v-if="records.length===0" class="drill-empty">{{ $t('drill.empty.records') }}</view>
    </view>
    <view class="drill-fab" @click="showCreate=true">📋</view>

    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate=false">
    <div class="modal"><h3>{{ $t('drill.form.title') }}</h3>
      <label>{{ $t('drill.form.label.title') }}</label><input v-model="form.title">
      <label>{{ $t('drill.form.label.description') }}</label><textarea v-model="form.description"></textarea>
      <label>{{ $t('drill.form.label.scenario') }}</label><select v-model="form.scenario"><option value="cpr">{{ $t('drill.scenario.cpr') }}</option><option value="aed">{{ $t('drill.scenario.aed') }}</option><option value="trauma">{{ $t('drill.scenario.trauma') }}</option><option value="choking">{{ $t('drill.scenario.choking') }}</option><option value="mass">{{ $t('drill.scenario.mass') }}</option></select>
      <label>{{ $t('drill.form.label.date') }}</label><input type="datetime-local" v-model="form.date">
      <label>{{ $t('drill.form.label.location') }}</label><input v-model="form.location">
      <label>{{ $t('drill.form.label.maxParticipants') }}</label><input type="number" v-model="form.maxParticipants">
      <div class="modal-actions"><button class="btn btn-g" @click="showCreate=false">{{ $t('common.cancel') }}</button><button class="btn btn-p" @click="create">{{ $t('drill.form.submit') }}</button></div></div></div>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { i18n } from '@/i18n'
import { useLocalizedNavTitle } from '@/utils/nav-title-locale'

const API = '/api/drill'
const userStore = useUserStore()

/**
 * 全局组合式 i18n 实例（`t` **只能**在 computed / 函数体 / 回调里调用；
 * 顶层取值会冻结语言，见设计 §11.1）。
 */
const i18nGlobal = i18n.global as unknown as {
  locale: { value: string }
  t: (key: string, named?: Record<string, unknown>) => string
}
function t(key: string, named?: Record<string, unknown>): string {
  return i18nGlobal.t(key, named)
}

const tab = ref<'upcoming'|'completed'|'records'>('upcoming')
const drills = ref<any[]>([])
const records = ref<any[]>([])
const showCreate = ref(false)
// ⚠️ `location` 为**前端默认输入值**（D5）：setup 期求值一次 ⇒ 仅作初始值。
//    字段可被用户编辑，故**不**随语言切换覆盖已输入内容（此处的"冻结"是期望行为）。
const form = ref({ title:'', description:'', scenario:'cpr', date:'', location: t('drill.form.defaultLocation'), maxParticipants:15 })

const displayDrills = computed(() => drills.value.filter(d => d.status === tab.value))

async function load() { try{const r=await fetch(`${API}/events`).then(r=>r.json());drills.value=r.data||[]}catch(e){} }
async function loadRecords() { try{const r=await fetch(`/api/user/training-records?userId=${userStore.profile.id}`).then(r=>r.json());records.value=r.data||[]}catch(e){} }
async function join(d: any) { await fetch(`${API}/events/${d.id}/join`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:userStore.profile.id,userName:userStore.profile.name})}); uni.showToast({title:t('drill.toast.joined'),icon:'none'});load() }
async function complete(d: any) { await fetch(`${API}/events/${d.id}/complete`, {method:'PUT'}); uni.showToast({title:t('drill.toast.pointsAwarded'),icon:'none'});load() }
async function create() { const f=form.value; await fetch(`${API}/events`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,organizerId:userStore.profile.id,organizerName:userStore.profile.name,lat:22.517,lng:113.947})}); showCreate.value=false;uni.showToast({title:t('drill.toast.created'),icon:'none'});load() }
function statusColor(s:string) { return {upcoming:'#4A90E2',completed:'#8E8E8E'}[s]||'#6B7280' }
/**
 * 状态 / 场景标签是**函数**（每次渲染求值）⇒ 内部调 `t()` 即可随语言切换响应。
 * ⚠️ **禁止**把映射表提到模块级：模块级对象只在 setup 期求值一次 ⇒ 语言冻结（设计 §11.1）。
 */
function statusLabel(s:string) {
  const labels: Record<string, string> = { upcoming: t('drill.status.upcoming'), completed: t('drill.status.completed') }
  return labels[s] || s
}
function scenarioLabel(s:string) {
  const labels: Record<string, string> = {
    cpr: t('drill.scenario.cpr'),
    aed: t('drill.scenario.aed'),
    trauma: t('drill.scenario.trauma'),
    choking: t('drill.scenario.choking'),
    mass: t('drill.scenario.mass'),
  }
  return labels[s] || s
}
// 原生导航栏标题随语言切换（P1b）。本页是**标准**导航栏（非 custom ⇒ 有原生标题栏）。
useLocalizedNavTitle('nav.drill')
onMounted(load)
</script>

<style lang="scss" scoped>
.page-drill{padding-bottom:80rpx}
.drill-tabs{display:flex;gap:12rpx;padding:20rpx 40rpx}
.drill-tab{padding:14rpx 28rpx;border-radius:32rpx;font-size:24rpx;border:1px solid var(--line);color:var(--ink-mute)}
.drill-tab.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.drill-header{padding:60rpx 40rpx 24rpx;background:linear-gradient(180deg,#FFF3E0,transparent)}
.drill-title{font-family:var(--serif);font-size:44rpx;font-weight:900}
.drill-list{padding:0 40rpx;display:flex;flex-direction:column;gap:16rpx}
.drill-card{background:#fff;border:1px solid var(--line);border-radius:20rpx;padding:24rpx}
.drill-card-top{display:flex;align-items:center;gap:12rpx}
.drill-status-dot{width:12rpx;height:12rpx;border-radius:50%;flex-shrink:0}
.drill-card-body{flex:1}.drill-card-title{font-size:28rpx;font-weight:700;display:block}.drill-card-scenario{font-size:20rpx;color:var(--ink-mute)}
.drill-card-status{font-size:20rpx;font-family:var(--mono)}
.drill-card-desc{font-size:22rpx;color:var(--ink-mute);margin-top:8rpx;display:block}
.drill-card-meta{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:12rpx;padding-top:12rpx;border-top:1px solid var(--line);font-size:18rpx;color:var(--ink-mute)}
.drill-card-actions{margin-top:12rpx;display:flex;gap:12rpx}
.drill-btn{padding:12rpx 24rpx;border-radius:20rpx;font-size:22rpx;font-weight:600;background:var(--rescue-red-soft);color:var(--rescue-red);display:inline-block}
.drill-btn.complete{background:#D1FAE5;color:#065F46}
.drill-fab{position:fixed;bottom:28rpx;right:28rpx;width:52px;height:52px;border-radius:50%;background:#F59E0B;color:#fff;font-size:24rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 4rpx 16rpx rgba(245,158,11,0.4)}
.drill-empty{padding:80rpx;text-align:center;color:var(--ink-mute);font-size:22rpx}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:100}
.modal{background:#fff;border-radius:16rpx;padding:28rpx;width:90%;max-width:400rpx;box-shadow:0 8rpx 40rpx rgba(0,0,0,0.15)}
.modal h3{font-size:17px;margin-bottom:16rpx}.modal label{display:block;font-size:12px;color:#8E8E8E;margin-bottom:6rpx}
.modal input,.modal select,.modal textarea{width:100%;padding:10rpx 12rpx;border:1px solid #E5E5E0;border-radius:8rpx;font-size:13px;margin-bottom:14rpx;font-family:inherit}.modal textarea{resize:vertical;min-height:50rpx}
.modal-actions{display:flex;gap:10rpx;justify-content:flex-end}
.btn{padding:10rpx 20rpx;border-radius:8rpx;font-size:13px;cursor:pointer;border:none}.btn-p{background:#C0392B;color:#fff}.btn-g{background:transparent;color:#8E8E8E}
</style>
