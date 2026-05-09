/**
 * 媒体报警上传 API — Mock
 *
 * 模拟将图片/视频上传至 120 急救中心。
 * 支持进度回调，模拟分段上传过程。
 */

export interface MediaFile {
  type: 'image' | 'video'
  path: string
}

export interface UploadProgress {
  fileIndex: number
  progress: number // 0-100
}

export interface UploadResult {
  success: boolean
  uploadedCount: number
  failedCount: number
  reportId?: string
  message: string
}

/**
 * 模拟上传 — 逐文件上报进度
 *
 * @param files   待上传文件列表
 * @param onProgress  进度回调
 * @param onFileDone  单文件完成回调
 */
export function uploadMedia(
  files: MediaFile[],
  onProgress: (p: UploadProgress) => void,
  onFileDone?: (index: number, ok: boolean) => void,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    let doneCount = 0
    let okCount = 0
    const total = files.length

    if (total === 0) {
      resolve({ success: true, uploadedCount: 0, failedCount: 0, message: '没有文件需要上传' })
      return
    }

    files.forEach((file, i) => {
      // 每个文件的模拟上传
      let progress = 0
      const duration = file.type === 'video' ? 4000 : 2000 // 视频更慢
      const steps = file.type === 'video' ? 20 : 10
      const stepMs = duration / steps

      const timer = setInterval(() => {
        progress += 100 / steps
        if (progress >= 100) progress = 100

        onProgress({ fileIndex: i, progress: Math.round(progress) })

        if (progress >= 100) {
          clearInterval(timer)
          // 80% 成功率，模拟网络波动
          const ok = Math.random() < 0.8
          if (ok) okCount++
          onFileDone?.(i, ok)
          doneCount++

          if (doneCount === total) {
            const success = okCount === total
            resolve({
              success,
              uploadedCount: okCount,
              failedCount: total - okCount,
              reportId: success ? 'RPT-' + Date.now().toString(36).toUpperCase() : undefined,
              message: success
                ? `已成功将 ${okCount} 个文件发送至 120 急救中心`
                : `${okCount}/${total} 个文件上传成功，${total - okCount} 个失败`,
            })
          }
        }
      }, stepMs)
    })
  })
}

/** 默认导出：兼容 API 请求层 */
export default function (params?: Record<string, unknown>) {
  return {
    code: 0,
    data: { message: '演习模式 · 未真实发送' },
    message: 'ok',
  }
}
