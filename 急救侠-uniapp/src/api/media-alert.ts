/**
 * 媒体报警上传 API — 真实接口（POST /api/media-alert/upload，multipart）
 *
 * 已移除纯模拟上传（原先 0 真实请求 + `Math.random()` 伪造成功率）。
 * 现用 `uni.uploadFile` 逐文件真实上传，进度来自 `onProgressUpdate`。
 *
 * ⚠️ 结构限制：后端 `/media-alert/upload` 当前仅记录元数据、**未持久化二进制**
 * （见交付映射表）；前端仍真实发起 multipart 上传并以后端返回为准。
 */

import { BASE_URL } from './index'

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
  /** 后端落盘后可访问的媒体 URL 列表（成功时返回） */
  urls?: string[]
  message: string
}

interface UploadResponseBody {
  code?: number
  data?: { uploadId?: string; message?: string; url?: string }
  message?: string
}

/**
 * 逐文件真实上传至 120 急救中心端点，并上报进度。
 *
 * @param files       待上传文件列表
 * @param onProgress  进度回调（0-100）
 * @param onFileDone  单文件完成回调
 */
export function uploadMedia(
  files: MediaFile[],
  onProgress: (p: UploadProgress) => void,
  onFileDone?: (index: number, ok: boolean) => void,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const total = files.length
    if (total === 0) {
      resolve({ success: true, uploadedCount: 0, failedCount: 0, message: '没有文件需要上传' })
      return
    }

    let done = 0
    let ok = 0
    let reportId: string | undefined
    let lastMessage = ''
    let uploadUrls: string[] = []

    const finish = (uploadId?: string) => {
      if (uploadId) reportId = uploadId
      done++
      if (done === total) {
        const success = ok === total
        resolve({
          success,
          uploadedCount: ok,
          failedCount: total - ok,
          reportId: success ? reportId : undefined,
          urls: success ? uploadUrls : undefined,
          message: success
            ? (lastMessage || `已成功将 ${ok} 个文件发送至 120 急救中心`)
            : `${ok}/${total} 个文件上传成功，${total - ok} 个失败`,
        })
      }
    }

    files.forEach((file, i) => {
      const task = uni.uploadFile({
        url: BASE_URL + '/media-alert/upload',
        filePath: file.path,
        name: 'file',
        formData: { type: file.type },
        success: (r) => {
          let body: UploadResponseBody = {}
          try {
            body = JSON.parse(r.data) as UploadResponseBody
          } catch {
            body = {}
          }
          const isOk = body.code === 0
          if (isOk) ok++
          if (body.data?.url) uploadUrls.push(body.data.url)
          lastMessage = body.data?.message || body.message || lastMessage
          onFileDone?.(i, isOk)
          finish(body.data?.uploadId)
        },
        fail: () => {
          onFileDone?.(i, false)
          finish()
        },
      })
      task?.onProgressUpdate?.((r) => {
        onProgress({ fileIndex: i, progress: r.progress })
      })
    })
  })
}
