/**
 * 媒体报警 Store — 管理上传状态和文件列表
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { uploadMedia, type MediaFile, type UploadProgress, type UploadResult } from '@/api/media-alert'

export type UploadPhase = 'idle' | 'ready' | 'uploading' | 'success' | 'error'

export interface MediaItem {
  type: 'image' | 'video'
  path: string
  /** 单文件上传状态 */
  uploadStatus: 'pending' | 'uploading' | 'done' | 'failed'
  uploadProgress: number
}

export const useMediaAlertStore = defineStore('media-alert', () => {
  const mediaList = ref<MediaItem[]>([])
  const phase = ref<UploadPhase>('idle')
  const overallProgress = ref(0)
  const result = ref<UploadResult | null>(null)

  const hasMedia = computed(() => mediaList.value.length > 0)
  const fileCount = computed(() => mediaList.value.length)
  const okCount = computed(() => mediaList.value.filter((m) => m.uploadStatus === 'done').length)
  const failCount = computed(() => mediaList.value.filter((m) => m.uploadStatus === 'failed').length)

  /** 添加媒体文件 */
  function addMedia(items: MediaFile[]) {
    items.forEach((item) => {
      mediaList.value.push({
        type: item.type,
        path: item.path,
        uploadStatus: 'pending',
        uploadProgress: 0,
      })
    })
    if (phase.value === 'idle' && mediaList.value.length > 0) {
      phase.value = 'ready'
    }
  }

  /** 移除单个媒体 */
  function removeMedia(index: number) {
    mediaList.value.splice(index, 1)
    if (mediaList.value.length === 0) {
      phase.value = 'idle'
    }
  }

  /** 开始上传 */
  async function startUpload() {
    if (mediaList.value.length === 0) return

    phase.value = 'uploading'
    overallProgress.value = 0
    result.value = null

    // 标记所有文件为 uploading
    mediaList.value.forEach((m) => {
      m.uploadStatus = 'uploading'
      m.uploadProgress = 0
    })

    const files: MediaFile[] = mediaList.value.map((m) => ({
      type: m.type,
      path: m.path,
    }))

    try {
      const res = await uploadMedia(
        files,
        (p: UploadProgress) => {
          // 更新单文件进度
          const item = mediaList.value[p.fileIndex]
          if (item) {
            item.uploadProgress = p.progress
          }
          // 计算总体进度
          const total = mediaList.value.length
          let sum = 0
          mediaList.value.forEach((m) => (sum += m.uploadProgress))
          overallProgress.value = Math.round(sum / total)
        },
        (index: number, ok: boolean) => {
          const item = mediaList.value[index]
          if (item) {
            item.uploadStatus = ok ? 'done' : 'failed'
            item.uploadProgress = ok ? 100 : item.uploadProgress
          }
        },
      )

      result.value = res
      phase.value = res.success ? 'success' : 'error'
      overallProgress.value = 100
    } catch {
      phase.value = 'error'
      result.value = {
        success: false,
        uploadedCount: 0,
        failedCount: mediaList.value.length,
        message: '网络异常，上传失败',
      }
    }
  }

  /** 重试失败的文件 */
  async function retryFailed() {
    // 保留成功的，仅重试失败的
    const failedItems = mediaList.value.filter((m) => m.uploadStatus === 'failed')
    if (failedItems.length === 0) return

    phase.value = 'uploading'
    overallProgress.value = 0

    failedItems.forEach((m) => {
      m.uploadStatus = 'uploading'
      m.uploadProgress = 0
    })

    const files: MediaFile[] = failedItems.map((m) => ({
      type: m.type,
      path: m.path,
    }))

    // 构建原始索引映射
    const indexMap: number[] = failedItems.map(
      (m) => mediaList.value.indexOf(m),
    )

    try {
      const res = await uploadMedia(
        files,
        (p: UploadProgress) => {
          const realIdx = indexMap[p.fileIndex]
          const item = mediaList.value[realIdx]
          if (item) item.uploadProgress = p.progress
          let sum = 0
          mediaList.value.forEach((m) => (sum += m.uploadProgress))
          overallProgress.value = Math.round(sum / mediaList.value.length)
        },
        (index: number, ok: boolean) => {
          const realIdx = indexMap[index]
          const item = mediaList.value[realIdx]
          if (item) {
            item.uploadStatus = ok ? 'done' : 'failed'
            item.uploadProgress = ok ? 100 : item.uploadProgress
          }
        },
      )

      result.value = res
      const totalOk = mediaList.value.filter((m) => m.uploadStatus === 'done').length
      const totalFail = mediaList.value.filter((m) => m.uploadStatus === 'failed').length
      phase.value = totalFail === 0 ? 'success' : 'error'
      overallProgress.value = 100

      result.value = {
        ...res,
        uploadedCount: totalOk,
        failedCount: totalFail,
        message: totalFail === 0
          ? '全部文件上传成功'
          : `${totalOk}/${mediaList.value.length} 个文件上传成功`,
      }
    } catch {
      phase.value = 'error'
    }
  }

  /** 重置所有状态 */
  function reset() {
    mediaList.value = []
    phase.value = 'idle'
    overallProgress.value = 0
    result.value = null
  }

  return {
    mediaList, phase, overallProgress, result,
    hasMedia, fileCount, okCount, failCount,
    addMedia, removeMedia, startUpload, retryFailed, reset,
  }
})
