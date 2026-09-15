/**
 * 入库**审计数据**的文案契约 —— 恒为 `zh-CN`，**刻意不做本地化**（设计 §13 D3）。
 *
 * 这里的两条字符串会**写进后端**：
 * - {@link PICKUP_FALLBACK_NOTE} → `POST /aed/:id/pickups` 的 `notes`；
 * - {@link auditCheckinComment} → `aedStore.checkInAed()` 的 `comment`。
 *
 * 它们是**数据契约**而非 UI 文案：若随界面语言本地化，英文用户会把英文写进库，
 * 破坏数据的语言一致性（按语言过滤 / 统计 / 对账都会失效）。因此**永远 `zh-CN`**。
 *
 * ⚠️ 为什么把它们放在本模块、而不是留在 `pages/aed/detail.vue`：
 * 「裸 CJK 源码守卫」（`src/__tests__/i18n-scope.ts`）只扫描**页面文件**。
 * 把数据**移出**被扫描的 page 文件即可让守卫保持纯净，**无需**为页面开白名单
 * —— 白名单会削弱守卫（"这个文件允许有中文"是一句迟早会失控的许可）。
 *
 * ⚠️ 约束：本模块**不得**依赖 i18n（禁止 import `@/i18n` / `@/locales`）—— 它属于语言无关的数据层。
 */

/** 取用登记兜底路径的 `notes`（责任人不可达时「先取用后留痕」，不阻断急救）。 */
export const PICKUP_FALLBACK_NOTE = '现场取用（责任人联动兜底）'

/**
 * 打卡状态 → 入库 `comment`。
 *
 * @param status 打卡结果（`ok` = 设备完好；`issue` = 存在问题需维护）。
 * @returns 恒为中文的入库备注（见文件头「数据契约」说明）。
 */
export function auditCheckinComment(status: 'ok' | 'issue'): string {
  return status === 'ok' ? '设备完好，功能正常' : '设备存在问题，需要维护'
}
