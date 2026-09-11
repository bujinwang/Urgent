/**
 * API 层 — 统一请求封装
 */

export let BASE_URL: string
// #ifdef H5
BASE_URL = '/api'
// #endif
// #ifndef H5
// 非 H5 平台（小程序 / App）：允许在构建期用环境变量 API_BASE_URL 覆盖 API 域名；
// 未设置时回落到占位默认值，不破坏既有行为。
declare const process: { env: { API_BASE_URL?: string } }
BASE_URL = process.env.API_BASE_URL || 'https://api.jiujiaxia.com/api'
// #endif

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
}

interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

function getAuthHeader(): Record<string, string> {
  const token = uni.getStorageSync('jwt_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {} } = options

  try {
    const res = await uni.request({
      url: BASE_URL + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...header,
      },
    })

    const body = res.data as ApiResponse<T>
    if (body.code !== 0) {
      console.warn('[API] 业务错误:', body.message)
    }
    return body.data
  } catch (e: any) {
    console.warn('[API] 请求失败，使用 mock 数据:', e.errMsg || e.message)
    throw e
  }
}

export interface FullResponse<T> {
  code: number
  data?: T
  message: string
}

/**
 * 与 `request` 相同，但**返回完整响应体**（含业务 `code`），且不因业务码非 0 抛错。
 * 供页面按业务码分支使用（如 AED 联动的 4001 无责任人 / 4006 未同意 PIPL）。
 */
export async function requestFull<T>(options: RequestOptions): Promise<FullResponse<T>> {
  const { url, method = 'GET', data, header = {} } = options
  try {
    const res = await uni.request({
      url: BASE_URL + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...header,
      },
    })
    return res.data as FullResponse<T>
  } catch (e: any) {
    console.warn('[API] 请求失败:', e.errMsg || e.message)
    return { code: -1, message: (e && (e.errMsg || e.message)) || '网络错误' }
  }
}

export async function put<T>(url: string, data?: Record<string, unknown>): Promise<T> {
  return request({ url, method: 'PUT', data })
}

export default request
