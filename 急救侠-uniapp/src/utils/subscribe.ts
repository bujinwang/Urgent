/**
 * 订阅消息 — 跨平台存根
 */

export function requestSubscribe(_tmplIds?: string[]): Promise<Record<string, string>> {
  console.log('[Subscribe] 平台暂不支持订阅消息')
  return Promise.resolve({})
}

export function subscribeToMissions(): Promise<Record<string, string>> {
  return requestSubscribe([])
}
