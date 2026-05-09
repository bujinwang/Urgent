/**
 * API 层入口 — 封装请求
 *
 * 当前使用 Mock 数据。后端就绪后，切换 baseURL 即可。
 */

// #ifdef H5
var BASE_URL = '/api'
// #endif

// #ifdef MP-WEIXIN
var BASE_URL = 'https://api.jiujiaxia.com'
// #endif

// #ifdef APP-PLUS
var BASE_URL = 'https://api.jiujiaxia.com'
// #endif

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
}

async function request<T>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {} } = options

  // TODO: 接入真实后端后，替换为 uni.request
  // 当前使用 Mock 模块
  const mockModule = await import(`./mock/${url.replace(/\//g, '_')}`)
  return mockModule.default(data) as T
}

export default request
