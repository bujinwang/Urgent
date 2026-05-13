/**
 * API 层 — 统一请求封装
 */

let BASE_URL: string
// #ifdef H5
BASE_URL = '/api'
// #endif
// #ifdef MP-WEIXIN
BASE_URL = 'https://api.jiujiaxia.com/api'
// #endif
// #ifdef APP-PLUS
BASE_URL = 'https://api.jiujiaxia.com/api'
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

export default request
