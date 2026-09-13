/**
 * 阿里云签名保活 —— **共享取数**（DB 读取），供 admin 看板与运维 CLI 复用。
 *
 * 分层：
 * - **纯决策**在 `scripts/keepalive-plan.ts`（无 IO、可单测）；
 * - **取数**在本模块（读 `aed_sms_dispatches` / `app_meta`）。
 *
 * 之所以单独成模块（而不是放进 CLI 文件）：CLI 顶层会 `initDb()` 并 `process.exit()`，
 * 若让 `routes/admin.ts` 直接 import CLI，会在导入时**误杀服务器进程**。分成无副作用的
 * 取数模块即可两处复用同一逻辑。
 *
 * **零 PII**：仅涉及时间戳与计数，不触碰任何手机号。
 */

import { get, getMeta } from '../db'
import { evaluateSignatureKeepAlive, type KeepAliveStatus } from '../scripts/keepalive-plan'

/** `app_meta` 键：最近一次**成功**发送（保活测试或人工记录）的毫秒时间戳。 */
export const SIGNATURE_LAST_SENT_META_KEY = 'aliyun_signature_last_sent_ms'

/**
 * 最近一次短信发送时间（ms）—— 取两处来源的**较晚者**：
 *
 * 1. `aed_sms_dispatches.created_at`：该列是 **UTC 文本**（`TEXT NOT NULL DEFAULT (datetime('now'))`，
 *    形如 `'YYYY-MM-DD HH:MM:SS'`）。此处采用 **parse-then-max**：
 *    先 `strftime('%s', created_at)` 把每行按 **UTC** 解析为「秒」，再 `MAX(...)` 取最大，最后 ×1000 得 ms，
 *    **与 `Date.now()`（UTC epoch ms）同基准**（若误用本地解析会引入时区偏移，如东八区差 8 小时）。
 *    ⚠️ 顺序**不可颠倒**为「先 `MAX(created_at)` 再解析」：`created_at` 是 **TEXT**，`MAX` 是**文本比较**；
 *    若表中存在**不可解析**的值（如 `'not-a-date'`，因 `'n' > '2'` 会成为文本最大值），
 *    `strftime('%s', 'not-a-date')` 返回 **NULL** ⇒ **该行会把合法行整体遮蔽**、reader 退化为 `null`。
 *    改为 parse-then-max 后，SQLite 聚合 `MAX()` **忽略 NULL** ⇒ 不可解析的行被自动跳过、不再遮蔽合法行。
 *    规范行（`'YYYY-MM-DD HH:MM:SS'`）与带 `T`/`Z` 的 ISO 串，`strftime('%s', …)` 均按 UTC 解析成同一基准的秒。
 * 2. `app_meta.aliyun_signature_last_sent_ms`（`--send-test` 成功后写入或人工记录）。
 *
 * ⚠️ **两处皆缺失 ⇒ 返回 `null`（不是 0）** —— 与项目既有「无样本不假报 0」不变量一致，
 *    使看板能区分「从未发送」（`never_sent`）与「很久以前发送过」。
 */
export function readLastSentAtMs(): number | null {
  const row = get<{ s: number | null }>(
    "SELECT MAX(CAST(strftime('%s', created_at) AS INTEGER)) AS s FROM aed_sms_dispatches"
  )
  const fromDb = row && row.s != null && Number.isFinite(Number(row.s)) ? Number(row.s) * 1000 : 0
  const fromMeta = Number(getMeta(SIGNATURE_LAST_SENT_META_KEY)) || 0
  const last = Math.max(fromDb, fromMeta)
  return last > 0 ? last : null
}

/** 组装保活状态（看板 / CLI 共用）：读取最近发送时间 + 纯判定。 */
export function getSignatureKeepAlive(nowMs: number, thresholdDays?: number): KeepAliveStatus {
  return evaluateSignatureKeepAlive({ lastSentAtMs: readLastSentAtMs(), nowMs, thresholdDays })
}
