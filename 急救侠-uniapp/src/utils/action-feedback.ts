/**
 * P0-1 收尾 —— 写操作的「**失败可见化**」（QA 缺陷 5.2：静默兜底）。
 *
 * 背景（为什么需要本模块）：`api/index.ts` 的 `request()` 在业务码非 0（**含 403**）时
 * **只 `console.warn` 不抛错**，且返回 `body.data`（403 时为 `undefined`）。于是页面里
 * ```ts
 * await request({ url: ... })      // 403 ⇒ 静默返回 undefined
 * uni.showToast({ title:'已批准' })  // ← 照常弹出，用户看到“成功”
 * ```
 * 会**假成功**：服务端明明 403 拒绝，前端却弹成功 toast（加固前端点直接放行，所以这个
 * bug 一直被掩盖；P0-1 加了鉴权/授权后才暴露成“点了没反应 / 点了假成功”）。
 *
 * 边界：**不改** `api/index.ts` 的通用错误语义（那是 P1 范围）。这里只在**调用点**
 * 改用 `requestFull()`（透出 `statusCode`）来判定，并统一给出本地化提示。
 */
import { i18n } from '@/i18n'
import type { FullResponse } from '@/api/index'

/** HTTP 403 Forbidden：已登录但无权限。P0-1 加固后写操作被拒的**标准**状态码。 */
export const FORBIDDEN = 403

/** 判定所需的**最小**响应形状（`FullResponse<T>` 去掉泛型，便于各调用点复用）。 */
export type WriteResult = Pick<FullResponse<unknown>, 'code' | 'message'> & { statusCode?: number }

/**
 * 全局 i18n 的 `t`（**只能**在函数体内调用；顶层取值会冻结语言，见设计 §11.1）。
 */
function t(key: string): string {
  const g = i18n.global as unknown as { t: (key: string) => string }
  return g.t(key)
}

/** 是否为「**无权限**」拒绝：HTTP 403，或业务码直接给 403。 */
export function isForbidden(res: WriteResult | null | undefined): boolean {
  if (!res) return false
  return res.statusCode === FORBIDDEN || res.code === FORBIDDEN
}

/** 弹一条**纯文案**提示（`icon:'none'`：失败类提示不带成功图标，避免误导）。 */
export function showToast(title: string): void {
  uni.showToast({ title, icon: 'none' })
}

/**
 * 判定一次写操作的结果，**失败时立刻给出可见提示**。
 *
 * @param res `requestFull()` 的返回值（`code===0` 视为成功）。
 * @returns `true` ⇒ **已提示失败**，调用方必须 `return`
 *          （不得再弹成功 toast、不得推进成功分支）；`false` ⇒ 成功。
 */
export function notifyIfFailed(res: WriteResult | null | undefined): boolean {
  if (res && res.code === 0) return false
  // ★ 区分「无权限」与「其它失败」：403 说“无权”，否则说“失败请重试”——
  //   一律说“失败”会让用户反复重试一个注定被拒的操作（误导）。
  if (isForbidden(res)) {
    showToast(t('common.noPermission'))
  } else {
    showToast(t('common.actionFailed'))
  }
  return true
}
