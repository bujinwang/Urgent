<template>
  <view class="page-gov-dashboard">
    <!-- 筛选：区域 + 时间窗口 -->
    <view class="gov-toolbar">
      <picker :range="districtLabels" :value="districtIndex" @change="onDistrictChange">
        <view class="gov-picker">区域：{{ districtLabel }}</view>
      </picker>
      <view class="gov-windows">
        <text
          v-for="w in windows"
          :key="w"
          class="gov-window"
          :class="{ active: store.windowDays === w }"
          @click="store.setWindow(w)"
        >{{ w }}天</text>
      </view>
    </view>

    <!-- 导出（纯前端：CSV 下载 / PDF 走浏览器打印「另存为 PDF」） -->
    <view class="gov-actions">
      <view class="gov-export-btn gov-csv-btn" @click="onExportCsv">导出 CSV</view>
      <view class="gov-export-btn gov-pdf-btn" @click="onExportPdf">导出 PDF</view>
    </view>

    <view v-if="store.loading" class="gov-hint">加载中…</view>
    <view v-else-if="store.error" class="gov-hint gov-hint-error">{{ store.error }}</view>

    <template v-else-if="d">
      <!-- 指标条（null → 数据积累中，不显示 0） -->
      <view class="gov-stats">
        <GovStat label="响应 P95" :value="secs(d.responseTime.p95Ms)" unit="秒" />
        <GovStat label="SLA 达标率" :value="pct(d.responseTime.slaRate)" unit="%" />
        <GovStat label="责任人无响应率" :value="pct(d.responseTime.noResponseRate)" unit="%" />
        <GovStat label="在线志愿者" :value="d.people.onlineVolunteers" unit="人" />
        <GovStat label="持证志愿者" :value="d.people.certifiedVolunteers" unit="人" />
        <GovStat label="AED 总数" :value="d.aed.total" unit="台" />
      </view>

      <!-- 响应趋势 -->
      <view class="gov-card">
        <text class="gov-card-title">响应趋势（按日样本数）</text>
        <GovBarChart :items="trendItems" />
        <text v-if="!d.responseTime.hasData" class="gov-note">
          数据积累中：窗口内尚无责任人响应样本，P95 / SLA 暂不展示（不显示 0）
        </text>
      </view>

      <!-- AED 概览 + 覆盖率占位 -->
      <view class="gov-card">
        <text class="gov-card-title">AED 概览</text>
        <view class="gov-kv"><text>总数</text><text>{{ d.aed.total }}</text></view>
        <view class="gov-kv"><text>可用</text><text>{{ d.aed.available }}</text></view>
        <view class="gov-kv"><text>可用率</text><text>{{ rateText(d.aed.availabilityRate) }}</text></view>
        <view class="gov-kv"><text>取用次数</text><text>{{ d.aed.pickups }}</text></view>
        <view class="gov-kv"><text>未归还</text><text>{{ d.aed.activePickups }}</text></view>
        <view class="gov-kv gov-gap"><text>每万人覆盖率</text><text>待接入人口数据 ⚠️</text></view>
        <view class="gov-kv gov-gap"><text>每平方公里覆盖率</text><text>待接入面积数据 ⚠️</text></view>
      </view>

      <!-- 任务 / 救援 -->
      <view class="gov-card">
        <text class="gov-card-title">任务与救援</text>
        <view class="gov-kv"><text>任务总数</text><text>{{ d.tasks.total }}</text></view>
        <view class="gov-kv"><text>已完成</text><text>{{ d.tasks.completed }}</text></view>
        <view class="gov-kv"><text>完成率</text><text>{{ rateText(d.tasks.completionRate) }}</text></view>
        <GovBarChart :items="taskTypeItems" />
        <view class="gov-kv"><text>救援记录</text><text>{{ d.rescue.records }}</text></view>
        <view class="gov-kv"><text>救援案例</text><text>{{ d.rescue.cases }}</text></view>
      </view>

      <!-- 人员 / 机构 -->
      <view class="gov-card">
        <text class="gov-card-title">人员与机构</text>
        <view class="gov-kv"><text>持证志愿者</text><text>{{ d.people.certifiedVolunteers }}</text></view>
        <view class="gov-kv"><text>在线志愿者</text><text>{{ d.people.onlineVolunteers }}</text></view>
        <view class="gov-kv"><text>机构数</text><text>{{ d.people.organizations }}</text></view>
        <view class="gov-kv"><text>机构成员</text><text>{{ d.people.orgMembers }}</text></view>
      </view>

      <!-- 区域明细（仅区级聚合，无任何个人明细） -->
      <view class="gov-card">
        <text class="gov-card-title">区域明细（区级聚合）</text>
        <view class="gov-table">
          <view class="gov-tr gov-th">
            <text class="c1">区域</text><text class="c2">AED</text><text class="c3">覆盖</text>
            <text class="c4">P95</text><text class="c5">任务</text><text class="c6">完成率</text>
          </view>
          <view v-for="r in d.districts" :key="r.district" class="gov-tr">
            <text class="c1">{{ r.district === '__UNASSIGNED__' ? '未分区' : r.district }}</text>
            <text class="c2">{{ r.aedCount }}</text>
            <text class="c3">{{ r.coveragePer10k === null ? '—' : r.coveragePer10k }}</text>
            <text class="c4">{{ r.responseP95Ms === null ? '—' : Math.round(r.responseP95Ms / 1000) + 's' }}</text>
            <text class="c5">{{ r.taskCount }}</text>
            <text class="c6">{{ r.taskCompletionRate === null ? '—' : Math.round(r.taskCompletionRate * 100) + '%' }}</text>
          </view>
        </view>
        <text class="gov-note">覆盖率列为占位（人口/面积基线待接入，不显示 0）</text>
      </view>

      <text class="gov-foot">生成时间：{{ generatedAt }} · 数据仅至区级聚合，不含任何个人信息</text>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGovStore } from '@/stores/gov'
import GovStat from '@/components/GovStat/index.vue'
import GovBarChart from '@/components/GovBarChart/index.vue'
import { downloadText, dashboardToCsv, govCsvFilename, printGovDashboard } from '@/utils/govExport'

const store = useGovStore()
const windows = [7, 30, 90]
const districtIndex = ref(0)

const d = computed(() => store.dashboard)

function secs(ms: number | null): number | null {
  return ms === null ? null : Math.round(ms / 1000)
}
function pct(v: number | null): number | null {
  return v === null ? null : Math.round(v * 100)
}
function rateText(v: number | null): string {
  return v === null ? '—' : Math.round(v * 100) + '%'
}

const districtKeys = computed<string[]>(() => {
  const allowed = store.viewer?.scopeAll
    ? (store.dashboard?.districts.map((x) => x.district) || [])
    : (store.viewer?.districts || [])
  return ['', ...allowed]
})
const districtLabels = computed<string[]>(() =>
  districtKeys.value.map((k) => (k === '' ? '全部区域' : k === '__UNASSIGNED__' ? '未分区' : k))
)
const districtLabel = computed(() => districtLabels.value[districtIndex.value] || '全部区域')

function onDistrictChange(e: { detail: { value: number | string } }) {
  const idx = Number(e.detail.value)
  districtIndex.value = Number.isFinite(idx) ? idx : 0
  store.setDistrict(districtKeys.value[districtIndex.value] || '')
}

/** 导出 CSV（纯前端生成并下载；无数据时提示）。 */
function onExportCsv(): void {
  const cur = d.value
  if (!cur) {
    uni.showToast({ title: '暂无数据可导出', icon: 'none' })
    return
  }
  downloadText(govCsvFilename(cur), dashboardToCsv(cur), 'text/csv;charset=utf-8')
}

/** 导出 PDF（H5 浏览器打印「另存为 PDF」；非 H5 提示；无数据时提示）。 */
function onExportPdf(): void {
  if (!d.value) {
    uni.showToast({ title: '暂无数据可导出', icon: 'none' })
    return
  }
  printGovDashboard()
}

const trendItems = computed(() =>
  (d.value?.responseTime.trend || []).map((t) => ({ label: t.date.slice(5), value: t.count }))
)
const taskTypeItems = computed(() =>
  (d.value?.tasks.typeDistribution || []).map((t) => ({ label: t.type, value: t.count }))
)
const generatedAt = computed(() => {
  const ts = d.value?.meta.generatedAt
  return ts ? new Date(ts).toLocaleString() : '—'
})

onMounted(async () => {
  if (!store.isLoggedIn) {
    uni.redirectTo({ url: '/pages/gov/login' })
    return
  }
  await store.loadMe()
  try {
    await store.loadDashboard()
  } catch { /* 错误已记录于 store.error */ }
})
</script>

<style lang="scss" scoped>
.page-gov-dashboard {
  min-height: 100vh; padding: 24rpx;
  background: linear-gradient(180deg, #0b1220, #111c31); color: #fff;
}
.gov-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-bottom: 20rpx; }
.gov-picker {
  padding: 14rpx 24rpx; background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16rpx; font-size: 24rpx;
}
.gov-windows { display: flex; gap: 12rpx; }
.gov-window {
  padding: 12rpx 20rpx; font-size: 22rpx; border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.6);
}
.gov-window.active { background: rgba(37, 99, 235, 0.35); color: #fff; }
.gov-actions { display: flex; gap: 16rpx; margin-bottom: 20rpx; }
.gov-export-btn {
  padding: 12rpx 26rpx; font-size: 24rpx; border-radius: 14rpx;
  background: rgba(37, 99, 235, 0.25); border: 1px solid rgba(37, 99, 235, 0.5); color: #dbeafe;
}
.gov-hint { padding: 40rpx; text-align: center; color: rgba(255, 255, 255, 0.5); font-size: 26rpx; }
.gov-hint-error { color: #f87171; }
.gov-stats { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 20rpx; }
.gov-stats > * { width: calc(50% - 8rpx); box-sizing: border-box; }
.gov-card {
  margin-bottom: 20rpx; padding: 24rpx;
  background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 20rpx;
}
.gov-card-title { display: block; font-size: 26rpx; font-weight: 700; margin-bottom: 16rpx; }
.gov-kv { display: flex; justify-content: space-between; padding: 10rpx 0; font-size: 24rpx; color: rgba(255, 255, 255, 0.7); }
.gov-gap text:last-child { color: #f59e0b; }
.gov-note { display: block; margin-top: 14rpx; font-size: 20rpx; color: rgba(255, 255, 255, 0.35); line-height: 1.6; }
.gov-table { margin-top: 8rpx; }
.gov-tr { display: flex; padding: 10rpx 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 22rpx; }
.gov-th { color: rgba(255, 255, 255, 0.45); }
.gov-tr text { flex: 1; text-align: center; }
.c1 { flex: 1.4 !important; text-align: left !important; }
.gov-foot { display: block; margin: 20rpx 0 40rpx; font-size: 20rpx; color: rgba(255, 255, 255, 0.3); text-align: center; }

/* ---- 打印样式：看板原为深色主题，直接打印既费墨又看不清 ⇒ 强制浅色 ---- */
@media print {
  .page-gov-dashboard {
    min-height: auto;
    padding: 0;
    background: #fff !important;
    color: #000 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* 工具栏与导出按钮不参与打印 */
  .gov-toolbar,
  .gov-actions { display: none !important; }

  .gov-card {
    background: #fff !important;
    border: 1px solid #c8c8c8 !important;
    border-radius: 8rpx;
    box-shadow: none !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .gov-card-title { color: #000 !important; }
  .gov-kv { color: #222 !important; }
  .gov-gap text:last-child { color: #7a4d00 !important; }
  .gov-note { color: #555 !important; }
  .gov-foot { color: #555 !important; }
  .gov-hint { color: #333 !important; }
  .gov-hint-error { color: #b00020 !important; }
  .gov-tr { border-bottom: 1px solid #ddd !important; color: #000 !important; }
  .gov-th { color: #333 !important; }
  .gov-stats { break-inside: avoid; page-break-inside: avoid; }

  /* 子组件（scoped 样式需 :deep 穿透） */
  :deep(.gov-stat) {
    background: #fff !important;
    border: 1px solid #c8c8c8 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  :deep(.gov-stat-label),
  :deep(.gov-stat-num),
  :deep(.gov-stat-unit),
  :deep(.gov-stat-hint) { color: #000 !important; }
  :deep(.gov-stat-null) { color: #7a4d00 !important; }
  :deep(.gov-bars) {
    background: transparent !important;
    border: none !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  :deep(.gov-bar-label),
  :deep(.gov-bar-value),
  :deep(.gov-bars-empty) { color: #000 !important; }
  :deep(.gov-bar-track) { background: #e8e8e8 !important; }
}
</style>
