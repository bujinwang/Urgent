/**
 * uni-app 跨端事件类型（**项目内明确类型**）
 *
 * 背景：此前在 `global.d.ts` 对 lib.dom 的 `EventTarget` / `Event` 做全局增强，
 * 使全仓所有事件的 `.value` / `.detail` 都能通过类型检查 —— 代价是写错也不报错。
 * 现改为显式类型 + 安全取值助手，`global.d.ts` 不再触碰 DOM 接口。
 *
 * 跨端差异：微信小程序等平台把输入值放在 `event.detail.value`，
 * H5 平台把输入值放在 `event.target.value`。
 */

/** `<input>` / `<textarea>` 的 @input / @change 事件（uni-app 跨端形态）。 */
export interface UniInputEvent {
  detail?: { value?: string }
  target?: { value?: string }
}

/** 其它 uni 事件的通用形态（detail 载荷 + 原生 target）。 */
export interface UniEvent {
  detail?: Record<string, unknown>
  target?: EventTarget
}

/**
 * 跨端安全取输入值：`detail.value` 优先，其次 `target.value`，都没有则空串。
 * 供模板内联处理器使用（形如 `@input="x = uniInputValue($event)"`）。
 */
export function uniInputValue(e: unknown): string {
  const ev = e as UniInputEvent | null | undefined
  return ev?.detail?.value ?? ev?.target?.value ?? ''
}
