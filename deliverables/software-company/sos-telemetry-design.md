# 设计文档：SOS 服务端埋点（F3）

> 上游：`deliverables/software-company/sos-telemetry-prd.md`（v1.0）
> 版本：v1.0 | 日期：2026-09-13 | 状态：**设计定稿，待实现**
> 主理人以「next」指令视同**接受 PRD 的 D1 / D2 / D6 设计**，本文在此基础上落定实现级细节。

---

## 1. 与 PRD 的对应关系

| PRD 决策 | 本文落点 |
|---|---|
| D1 只采事件不采位置 | §2 表 DDL（**物理上不存在经纬度列**，并由测试断言） |
| D2 匿名可呼救 | §3 端点契约（无强制鉴权，`optionalAuth` 派生身份） |
| D3 不动二次确认 | 不涉及（`rescue/index.vue:201-220` 保持原样） |
| D4 不阻塞、失败静默 | §5 前端实现（`requestFull` + `.catch`，不 await） |
| D5 匿名端点限流 | §4 限流取值（**并说明为何取值偏宽松**） |
| D6 保留期 90 天 | §6 清理机制（**选定 CLI，否决惰性**） |
| P0-4 管理侧只读查询 | §7 CLI（**不开 HTTP 端点**） |

**本次不做**：实时位置追踪、告警派发、离线补传、自动处置滥用（PRD §8 已声明）。

---

## 2. 数据层：`sos_events`

### 2.1 建表 DDL（canonical schema + 迁移 040 双写）

```sql
CREATE TABLE IF NOT EXISTS sos_events (
  id               TEXT PRIMARY KEY,
  client_event_id  TEXT NOT NULL,
  user_id          TEXT,                          -- 可空：匿名呼救（建议书 §04「无需注册」）
  is_drill         INTEGER NOT NULL DEFAULT 0,     -- 客户端声明，**非可信**，见 §8
  client_platform  TEXT NOT NULL DEFAULT '',
  created_at_ms    INTEGER NOT NULL,               -- 范围查询唯一依据（见 §2.3）
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sos_events_client ON sos_events(client_event_id);
CREATE INDEX IF NOT EXISTS idx_sos_events_user  ON sos_events(user_id, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_sos_events_real  ON sos_events(is_drill, created_at_ms);
```

**⚠️ 本表刻意不含任何位置字段。** 这不是"暂时没加"，而是 D1 的**结构性承诺**：一旦列存在，
任何后续代码都能写入；列不存在则"不采位置"由 schema 强制。测试直接断言 `PRAGMA table_info(sos_events)`
中**不存在** `lat/lng/latitude/longitude/location/geo*` 任何一列（§9 T4）。

### 2.2 为什么 `user_id` 可空而不是 `NOT NULL DEFAULT ''`

空字符串与 NULL 在 SQL 里语义不同，而本项目已经踩过这个坑（`aed_devices.linked_user_id TEXT NOT NULL DEFAULT ''`
导致"未绑定"与"绑定到空 id"无法区分）。这里明确用 **NULL = 匿名**，`''` 永不被写入。
统计时 `user_id IS NULL` 即"匿名触发"，是一个可查询的明确事实。

### 2.3 为什么同时保留 `created_at_ms INTEGER` 与 `created_at TEXT`

**这是本项目已有一次真实事故的直接对策。** `signatureKeepAlive.ts` 曾因
`MAX(CAST(strftime('%s', created_at) AS INTEGER))` 踩中 SQLite 的时区语义 ——
`strftime('%s', X)` 把 `'T...Z'` / `' ... '` / `'+08:00'` 三种写法**一律按 UTC 解析**（忽略时区后缀），
非法值返回 `null`，且 `MAX()` 作用于 TEXT 列时是**文本比较**而非时间比较。

**对策：范围查询一律走 `created_at_ms` 这个显式整数列**，`created_at` 仅供人读（`datetime('now')` 落 UTC）。
这样反滥用统计与保留期清理**完全不依赖 `strftime`**，从结构上消灭该类缺陷。

### 2.4 幂等键 `client_event_id`

- **唯一索引 + `INSERT OR IGNORE`**：同一 `client_event_id` 重复提交只落一行。
- **语义边界（重要）**：它防的是**传输层重复**（重试/重放），**不是**"用户连续两次呼救"。
  用户中止后再触发一次 = **两次不同意图的呼救 = 两行记录**。
  ⇒ 因此 `client_event_id` **每次进入 `startCpr()` 时新生成**，不做会话级缓存。
- **缺失兜底（不拒绝）**：客户端未提供 / 为空 / 超长时，**由服务端生成**并照常落库。
  理由：埋点是旁路，**因格式问题丢弃一条 SOS 记录，比丢失幂等性糟得多**。

---

## 3. 端点契约

```
POST /api/public/sos-event
```

| 项 | 约定 |
|---|---|
| 鉴权 | **无强制鉴权**（急救现场无需注册）。挂 `optionalAuth`：token 有效则派生 `user_id`，无效/缺失则为 `NULL` |
| 请求体 | `{ clientEventId?: string, isDrill?: boolean, platform?: string }` |
| 响应 | `200 { code: 0, data: { duplicate: boolean }, message: 'ok' }` |
| 失败 | 仅内部异常 → `500`。**业务上不设"错误响应"**（见下） |

### 3.1 🔒 安全要点：`user_id` **只从 token 派生，绝不读 body**

**这是本端点最重要的一条不变式。** 若允许 body 传 `userId`，任何人都能把伪造的 SOS 记到**别人名下**——
这比"没有记录"危害更大：它会污染反滥用台账，甚至被用来构陷特定账号。

⇒ 实现上**完全不读取 `req.body.userId`**。由测试 T2 断言：携带 `{ userId: 'victim' }` 但无 token 的事务，
落库后 `user_id` **必须为 NULL**。

### 3.2 `is_drill` 归一化：必须用**严格白名单**，不可用 `!!`

`!!"false" === true`、`!!"0" === true`。若前端某次把布尔值序列化成了字符串，
`!!` 会把**真实 SOS 标成演习**，让它从反滥用计数中**静默消失**（正好是 KPI 的反面）。

```ts
// 仅以下四者视为演习，其余一律为真实
const isDrill = v === true || v === 1 || v === '1' || v === 'true'
```

由测试 T3 覆盖 `'false'` / `'0'` / `0` / `null` / `undefined` 五种输入。

### 3.3 为什么没有"业务错误响应"

PRD §2.2：施救者要求上报**完全不影响**急救操作。因此端点对客户端的**唯一**有意义结局就是"已收下"。
校验失败不做 400，而是**降级处理**（生成 id / 归一化为真实）。

⚠️ **取舍声明**：这意味着"客户端传了畸形 `isDrill`"不会报错，只会被当作真实事件。
这个方向的错判（多记而非少记）是**有意选择**——宁可多留痕，不可漏留痕。

---

## 4. 限流

沿用既有 `createHourlyIpLimiter(envKey, def, force)`（`app.ts:126`），挂载位置必须在
`app.use('/api/public', publicRouter)` **之前**（与 `aliyun-sms-report` / `inquire` 同序，见 `app.ts:161-163`）。

```ts
export const ANON_LIMITS = { mediaUpload: 10, inquire: 5, sosEvent: 120 } as const
```

**取值 120 次/小时/IP 明显高于其它匿名端点，是本设计里唯一一处"故意放宽"，理由必须写清：**

1. **限流不会阻塞救援** —— 上报是旁路且失败静默（D4）。撞限流的代价是**丢一条记录**，不是"救不了人"。
   但这恰恰意味着：**限流阈值定低一点，损失的是最需要留痕的那部分记录**（共享出口 IP 的医院/学校/企业 NAT，
   以及网络抖动下的重试）。
2. 与 `inquire`（5 次/小时，骚扰咨询）不同，本端点的合法调用频率**不由客户端控制**——
   一次真实急救就是一个用户主动触发，而同一出口 IP 背后可能站着成百上千人。
3. 滥用风险有界：本端点**无任何外部调用**（不发短信、不推送、不写盘），
   即**无放大效应**，最坏情况只是磁盘增长，而 90 天保留期 + 清理脚本（§6）已兜底。

⇒ 120 是"宁可多留痕"的取值。可用 env `SOS_EVENT_HOURLY_LIMIT` 覆盖。

---

## 5. 前端实现

### 5.1 上报点：`startCpr()` 内、进入 `cpr` 分支之后

```ts
function startCpr() {
  if (!confirmed.value) return
  confirmVisible.value = false
  stage.value = 'cpr'
  cprStep.value = 1
  startTotalTimer()
  reportSos()          // ← 新增，旁路，不 await
}
```

**为什么放在 `startCpr()` 而不是 `watch(cprStep)`**：`watch` 的 `[cprStep, aedPhase]` 回调含 50ms `setTimeout`
且会在 `cprStep` 反复变化时重入（`loop → 4 → 5 → loop`）；把上报挂在 `watch` 里会产生**多条记录**，
直接污染反滥用计数。`startCpr()` 是"用户确认真实意图"的**唯一且恰好一次**的位置。

### 5.2 旁路实现（D4 的具体落法）

```ts
function reportSos() {
  void requestFull({
    url: '/public/sos-event',
    method: 'POST',
    data: { clientEventId: newSosEventId(), isDrill: isDrill.value, platform: getPlatform() },
  }).catch(() => { /* 埋点失败静默：绝不打断急救流程 */ })
}
```

- 用 `requestFull`（`api/index.ts:70`）而非 `request`：**前者内部已 try/catch，从不 reject**。
  外层再挂 `.catch` 是纵深防御，防止将来有人改了 `requestFull` 的语义而悄悄引入未处理拒绝。
- **不 await / 不弹 toast / 不改跳转 / 不做本地排队补传**（补传会把时间长期留在设备上，违背最小化，见 D4）。
- 调用发生在 `stage.value='cpr'` 之后 ⇒ 即使上报同步抛错，**流程状态已经推进**，测试 T6 据此断言。

### 5.3 文案口径统一（D2 的连带动作）

`rescue/index.vue:212` 现文案：「…系统将自动呼叫 120、通知附近志愿者、**记录您的 GPS 位置**。」

⇒ 改为：「…系统将自动呼叫 120、通知附近志愿者、**记录本次触发的时间与账号用于反滥用（不记录精确位置）**。」

**⛔ 一处范围外但必须盯住的连带项**：建议书 §10「用户位置数据仅在活跃任务期间使用，任务结束后自动删除」
与本 PRD 结论（**根本不采位置**）现在**同样不自洽**——只是从"承诺删除却记录"变成了"承诺删除但从未记录"。
修改建议书属于**对外文档变更**，且该文件可能已提交，**不在本次代码变更集内**，作为独立决策项挂起（§10）。

---

## 6. 保留期与清理（D6）

**结论：CLI 脚本，否决"启动时惰性清理"。**

| 方案 | 否决理由 |
|---|---|
| 启动时惰性清理 | ① 进程长期不重启 ⇒ **永不清理**，直接违反 PIPL「存储期限最短」，且违反是静默的；② 大表 `DELETE` 阻塞启动，与"紧急服务可用性优先"冲突 |
| **CLI（选定）** | 显式、可审计、可 `--dry-run`、与既有 `src/scripts/*` 惯例一致（`aliyun-keepalive.ts` / `narrow-plan.ts` 已在用） |

- `src/scripts/sos-purge.ts`：默认 90 天，`--days N` 可调，`--dry-run` 只报数不删。
- 删除条件用 `created_at_ms < ?`（§2.3：不碰 `strftime`）。
- npm script：`sos:purge`。
- ⚠️ **运维落点**：脚本本身**不会自己运行**，需挂 systemd timer / crontab。
  这一步在代码之外，已在 `NEXT_STEPS.md` 记为待办（与阿里云保活巡检同性质的运维项）。

---

## 7. 管理侧只读查询（P0-4）

**CLI，不开 HTTP 端点**——与本项目「管理面不开接口」的既有取向一致（`narrow-plan.ts` 先例）。

`src/scripts/sos-report.ts`，输出三行计数而非一行：

```
真实（is_drill=0）: N
演习（is_drill=1）: M
合计              : N+M
```

**为什么必须输出三行**：见 §8 —— `is_drill` 不可信，只报"真实"会让被误标/被恶意标注的记录**完全隐形**。
三行并列时，"某账号真实数很低但演习数畸高"这种模式仍然可见。这是对 §8 信任边界的**廉价缓解**。

---

## 8. ⚠️ 信任边界与已知限制（必须随代码一起传承）

**`is_drill` 是客户端声明、服务端不可验证的提示，它不是安全边界。**

端点是匿名的（D2），因此恶意用户可以发送 `isDrill: true` 把自己伪装成演习，
从而让滥用记录**不出现在"真实"计数里**。这不是实现缺陷，而是"匿名 + 客户端自证"的**结构性后果**，
**无法靠加校验消除**（客户端不可信）。

**已采取的缓解**：
1. 记录 `client_platform` 与（限流桶所用的）来源 IP ⇒ 同一来源的调用仍可聚类。
2. 统计工具**同时输出真实/演习/合计三行**（§7）⇒ 伪装不能做到"完全隐形"。
3. 本项定位是**证据（evidence）而非证明（proof）**：用于"收到举报后查证"，不足以单独作为处置依据。

**若将来需要强可信**，唯一正解是让 `is_drill` 来自服务端可控的签发凭据（如演习会话令牌），
而不是客户端布尔值。**本 PRD 明确不做**（PRD §8：不做实名认证/自动处置）。此处登记为已知限制，不做过度设计。

---

## 9. 测试计划（每条都对应一个可被突变验证的断言）

| # | 断言 | 突变它应当精确变红的方式 |
|---|---|---|
| T1 | 匿名（无 token）可上报成功，且落库 `user_id IS NULL` | 把 `user_id` 改成从 body 取 ⇒ 变红 |
| T2 | 带 token 上报 ⇒ `user_id` = token 身份；body 传 `userId:'victim'` **被忽略** | 读 body.userId ⇒ 变红 |
| T3 | `is_drill` 严格白名单：`'false'/'0'/0/null` **均落为 0**；`true/1/'1'/'true'` 落为 1 | 改成 `!!v` ⇒ `'false'` 用例变红 |
| T4 | `PRAGMA table_info(sos_events)` **不含**任何经纬度/位置列 | 加一列 `lat` ⇒ 变红 |
| T5 | 同 `client_event_id` 提交两次 ⇒ 仅 1 行；缺省/超长 id ⇒ 服务端生成且**仍落库** | 去掉 UNIQUE 索引 ⇒ 变红 |
| T6 | 前端：上报抛错 / 超时 / 返回 429 ⇒ `stage === 'cpr'` 且 `cprStep === 1` **不变** | 改成 `await` ⇒ 变红 |
| T7 | 限流：第 121 次 ⇒ 429（复用 `createHourlyIpLimiter(force=true)` 模式） | 阈值改 0 ⇒ 变红 |
| T8 | 演习污染率恒为 0：`is_drill=1` 的记录不出现在"真实"计数 | 统计漏加 `WHERE is_drill=0` ⇒ 变红 |

---

## 10. 挂起项（不在本次变更集）

| # | 事项 | 为何挂起 |
|---|---|---|
| 1 | **改建议书 §10 的位置数据表述**（§5.3） | 对外文档变更，文件可能已提交；需业务侧决定口径后再动 |
| 2 | `sos:purge` 的 systemd timer / crontab 落点 | 运维动作，在代码之外 |
| 3 | P1-6：真实 SOS 数纳入 `/api/admin/dashboard` | PRD 列为 P1，非 MVP |
| 4 | P2-7：异常模式自动提示 | PRD 列为 P2 |

---

## 11. ✅ 实现与验证记录（2026-09-14 完成）

**门禁结果**：后端 `tsc --noEmit` **0 错误**；后端 **343 通过 / 38 文件**（基线 329/37）；
前端 **218 通过 / 40 文件**（基线 213/39，净增 5 条调用点用例）。

### 11.1 突变矩阵（独立对抗性验证）

对每条不变式**主动改坏实现**，要求断言**精确变红**（而非只是"有测试通过"）：

| # | 突变（改坏什么） | 守护的不变式 | 结果 |
|---|---|---|---|
| 1 | `user_id` 改为从 `req.body.userId` 取 | 身份只来自 token | ✅ RED（T2、T2b 双红） |
| 2 | `normalizeIsDrill` 改为 `v ? 1 : 0` | 演习归一化白名单 | ✅ RED（T3） |
| 3 | canonical schema 加一列 `lat REAL` | **表无位置列**（D1） | ✅ RED（T4）※首跑假绿，见 11.3 |
| 4 | 限流器改挂到 `app.use('/api/public')` **之后** | 限流真实生效 | ✅ RED（trust-proxy 真挂载） |
| 5 | `countSosEvents` 的 real/drill 谓词互换 | 演习不污染真实计数 | ✅ RED（T8） |
| 6 | `INSERT OR IGNORE` → `INSERT OR REPLACE` | 幂等语义 | ✅ RED（T5） |
| 7 | `purgeSosEvents` 忽略 `dryRun` | dry-run 只报数不删 | ✅ RED（T9） |
| 8 | 删掉 `reportSosEvent` 的 `.catch` | 上报**绝不 reject** | ✅ RED（api/sos） |
| 9 | 载荷加 `userId` | 载荷不含身份 | ✅ RED（2 条） |
| 10 | 载荷加 `latitude/longitude` | 载荷不含位置 | ✅ RED |
| 11 | **删掉 `startCpr()` 里的上报调用** | **调用点存在** | ⚠️ **SURVIVED** → 已补测，见 11.2 |
| 12 | 硬编码 `isDrill: false` | 演习标记正确 | ✅ RED（新增用例） |

### 11.2 ⚠️ 发现 A：调用点曾完全无覆盖（已修复）

突变 11 **存活**：删掉 `pages/rescue/index.vue` 里那一行 `void reportSosEvent(...)`，
**全部 213 个用例仍全绿** —— 即"功能静默失效、无人察觉"。
原因：`api/sos.ts` 的**模块内部**不变式被测得很充分，但**页面是否真的调用它**无人守。

**已补** `急救侠-uniapp/src/__tests__/pages/rescue.test.ts`（5 条，真实 mount 走 `.sos-button → .confirm-check → .confirm-btn`）：
恰好上报一次 / 幂等键带 `sos_` 前缀 / **未勾选不上报**（不绕过二次确认）/
**上报永不 settle 时流程仍推进**（证明未 `await`）/ **演习模式 `isDrill=true`**（否则演习计入真实计数）。
补测后突变 11 与突变 12 均精确变红。

### 11.3 ⚠️ 发现 B：突变可能"假存活"——必须复跑确认

突变 3 首次运行报 **13 passed（假绿）**，同一份代码**复跑即 RED**。
怀疑是 vitest 在"编辑后立刻运行"时取到**过期的 transform 缓存**（文件 mtime 粒度未变）。

⇒ **纪律**：**任何 SURVIVED 结论都必须复跑确认**（或编辑后 `sleep 1` 再跑），
否则会把"真缺口"误判成"已覆盖"，方向恰好相反 —— 这是本轮最贵的一条教训。

### 11.4 交付物清单

| 层 | 文件 |
|---|---|
| 后端表 | `db.ts`（canonical schema + 迁移 `040_add_sos_events` + `clearAll` 纳入） |
| 后端端点 | `routes/public.ts`（`POST /sos-event`，`optionalAuth`） |
| 后端限流 | `app.ts`（`ANON_LIMITS.sosEvent = 120`，挂在公共路由**之前**） |
| 后端服务 | `services/sosTelemetry.ts`（统计/清理**唯一实现**）+ `scripts/sos-{report,purge}.ts` |
| 前端 | `api/sos.ts`（旁路封装）+ `pages/rescue/index.vue`（调用点 + `:212` 文案口径） |
| 测试 | `__tests__/sos-telemetry.test.ts`、`trust-proxy.test.ts`（真挂载）、`__tests__/api/sos.test.ts`、`__tests__/pages/rescue.test.ts` |

