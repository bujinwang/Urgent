/**
 * SOS 触发留痕上报（F3）—— 旁路埋点，兑现建议书 §10「恶意虚假呼救可追溯」。
 *
 * 设计依据：`deliverables/software-company/sos-telemetry-design.md` §5。
 *
 * ⚠️ 三条纪律（改动前务必先读设计文档）：
 * 1. **绝不 await、绝不弹错、绝不改跳转**：急救场景下每延误 1 分钟存活率下降 7–10%，
 *    埋点永远只能是旁路。上报失败 = 少一条记录，绝不能让施救者看到报错或被打断。
 * 2. **不做本地排队补传**（D4）：补传会把触发时间长期留在设备上，违背「最小必要」。
 * 3. **不上报任何位置**：后端表里没有位置列（D1）。不要在前端"顺手"加上经纬度——
 *    那会让 schema 的结构性承诺失效，并与建议书 §10 的删除承诺冲突。
 */

import { requestFull } from './index'
import { getPlatform } from '@/utils/platform'

/**
 * 生成一次性的幂等键。
 *
 * **每次进入 `startCpr()` 都应新生成**，不做会话级缓存：
 * 用户中止后再触发一次 = 两个不同意图的呼救 = 两条记录。
 * 本键防的是**传输层重复**（重试/重放），不是"用户连续呼救"。
 */
export function newSosEventId(): string {
  return `sos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export interface SosReportInput {
  /** 幂等键（见 {@link newSosEventId}）。 */
  clientEventId: string
  /** 是否演习模式。 */
  isDrill: boolean
}

/**
 * 上报一次 SOS 触发。**fire-and-forget**：调用方不要 `await`，也不要在其后做任何流程分支。
 *
 * 内部用 `requestFull`（`api/index.ts` 中自身 try/catch，从不 reject），外层再挂 `.catch`
 * 作纵深防御 —— 即使将来有人改了 `requestFull` 的语义引入 reject，这里也不会冒出未处理拒绝。
 * 返回值无业务含义，仅供测试与日志。
 */
export function reportSosEvent(input: SosReportInput): Promise<void> {
  return requestFull({
    url: '/public/sos-event',
    method: 'POST',
    data: {
      clientEventId: input.clientEventId,
      isDrill: input.isDrill,
      platform: getPlatform(),
    },
  })
    .then(() => undefined)
    .catch(() => undefined)
}
