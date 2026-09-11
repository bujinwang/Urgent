# 急救侠 · 下一步路线图（NEXT STEPS）

> 评估日期：2026-09-10
> 评估范围：`急救侠-server`（Express + SQLite 后端）、`急救侠-uniapp`（uni-app 多端前端）、CI、部署工程
> 评估方式：本地实跑测试 / 类型检查 / 依赖体检 / 代码走查

---

## ✅ P0 已完成（2026-09-10）

已提交，**工作区干净**：

| 提交 | 说明 |
|------|------|
| `3da99d3` | fix: 修复前后端类型检查失败并消除后端测试偶发失败（36 files, +1176/−263） |
| `a67eb47` | chore: 忽略 `.workbuddy/` 与 vitest 临时产物，补充本路线图 |

| 门禁 | 修复前 | 修复后 |
|------|-------:|-------:|
| 后端 `tsc --noEmit` | 238 错误 / 16 文件 | **0 错误** |
| 后端 `vitest run` | 117 通过（本地偶发 ~20% 失败） | **117 通过，连续 40 次全绿** |
| 前端 `vue-tsc --noEmit` | 49 错误 | **0 错误** |
| 前端 `vitest run` | 151 通过 | **151 通过** |

未新增任何 `as any` / `@ts-ignore`（反而移除了 2 处既有的）。

**P0 完成后的两项修正说明**
1. **P0-1 的修法**：没有回退那次"去 any 重构"，而是新增 `src/types/rows.ts` 按真实 DDL 推导各表行类型，
   并在 21 个路由的 `get<T>()` / `all<T>()` 调用点显式传入 —— 把重构真正做完了。
2. **P0-3 的定性要收窄**：后端测试的 ~20% 抖动经取证是**两个叠加**——① `coverage-fill` 的
   `DROP TABLE` 后恢复写在断言之后、无 `try/finally`（且手写 `CREATE TABLE users` 只有 9 列，缺 6 列）
   导致文件内级联；② `app.listen(0)` 绑通配地址，在 macOS 上被本机其它进程更具体的
   `127.0.0.1:<port>` 绑定**抢答**（实测本机 52 个 loopback 监听）。
   **这两者都属开发机条件，CI（ubuntu 干净 runner）不会发生 —— CI 红的唯一原因始终是 type-check。**
   修复仍有价值（消除环境无关的级联缺陷 + 改善本地开发体验），但不应表述为"修好了导致 CI 红的问题"。

---

## 一、项目现状快照

| 维度 | 后端 `急救侠-server` | 前端 `急救侠-uniapp` |
|------|---------------------|---------------------|
| 单元测试 | ✅ 117 通过 / 17 文件 | ✅ 151 通过 / 32 文件 |
| 类型检查 | ❌ **238 个错误 / 16 文件** | ❌ **49 个错误** |
| 业务代码规模 | 23 个路由模块 / 约 2185 行 | 23 个页面目录 / 17 个 API 模块 |
| CI（`.github/workflows/ci.yml`） | 会 **红**（type-check 失败） | 会 **红**（type-check 失败） |

**结论：测试全绿，但类型检查全线飘红 —— 一旦 push，CI 必然失败。**

---

## 二、P0 · 阻塞项（必须先修）

### 1. 后端类型检查：238 个错误
根因是最近一次提交 `be8493a`「typed DB helpers (get<T>, all<T>) eliminate 100+ as any casts」：
`src/db.ts:714` 定义 `type Row = Record<string, unknown>`，`get<T = Row>()` / `all<T = Row>()`
默认返回 `Row`，但绝大多数调用点**没有传类型参数**，于是 `row.id`、`row.name` 等一律变成 `unknown`。

| 文件 | 错误数 | | 文件 | 错误数 |
|------|-------:|-|------|-------:|
| `routes/org.ts` | 62 | | `routes/admin.ts` | 10 |
| `routes/aed.ts` | 58 | | `routes/public.ts` | 6 |
| `routes/volunteer.ts` | 22 | | `routes/trail.ts` | 2 |
| `routes/user.ts` | 18 | | `routes/records.ts` | 2 |
| `routes/news.ts` | 16 | | `routes/atlas.ts` | 2 |
| `routes/auth.ts` | 16 | | `routes/rescue.ts` | 1 |
| `routes/task.ts` | 11 | | `routes/replay.ts` | 1 |
| `routes/cases.ts` | 10 | | `routes/learn.ts` | 1 |

**修复方向（二选一）**
- **推荐**：为每张表定义 Row 接口（如 `VolunteerRow`、`AedRow`），在所有 `all<T>()` / `get<T>()` 调用点显式传类型参数 —— 真正把这次「去 any」重构做完。
- **临时**：把 `type Row` 放宽为 `Record<string, any>` 并开启索引访问，能立刻变绿，但等于回退本次重构的收益。

### 2. 前端类型检查：49 个错误
主要集中在 uni-app 事件类型上：`e.detail.value` / `e.detail` 被推断为 `Event`（如 `animals/index.vue`、`auth/login.vue`、`auth/change-pwd.vue`、`cert/upload.vue` 等）。
另有 3 处独立问题：
- `api/user.ts:27` —— 返回值含 `volunteer_type`，但 `UserProfile` 类型没有该字段；
- `__tests__/stores/user.test.ts:29` —— 调用参数个数不符；
- `__tests__/utils/voice.test.ts:23` —— 缺少 `beforeEach`（测试全局未引入）。

**修复方向**：为事件处理器补 `UniEvent` / `InputEvent` 类型注解或统一封装 `onInput` helper；补齐 `UserProfile` 字段；修正 2 处测试类型。

### 3. 15 个提交未推送 → CI 从未真正跑过
`origin/main` 落后本地 15 个提交（push 通知、测试、CI、Docker、Zod 校验、迁移系统等全在本地）。
即 CI 配置文件是这次提交里新增的，**一次都没被执行验证过**。

**动作**：修完 P0-1、P0-2 → push → 确认 CI 首次变绿。

---

## 三、P1 · 工程与可部署性

### 4. 本地环境：Apple Silicon 上装了 x64 原生依赖
实测本机 `arm64`，但 `node_modules` 里的原生二进制是 **x86_64**：
- `@rollup/rollup-darwin-x64`（应为 `-arm64`）→ 后端 `npm test` 直接崩溃；
- `better-sqlite3` 的 `.node` 编译为 x86_64 → 17 个测试套件全部无法加载。

本次评估已临时修复（重装 arm64 rollup + `npm rebuild better-sqlite3 --build-from-source`），但**根因未消除**（node_modules 疑似从 Intel 机器拷贝 / 在 Rosetta 下安装）。

**动作**：在 README/SKILLS 中写明「换机后必须删除 node_modules 重新 `npm ci`」；核对 `package-lock.json` 的平台记录。

### 5. 部署链路不完整
- `docker-compose.yml` **只容器化了后端**，前端 H5 无 Dockerfile / nginx 配置 / HTTPS；
- 前端 `api/index.ts` 中 MP-WEIXIN / APP 的 `BASE_URL` 仍指向占位域名 `https://api.jiujiaxia.com/api`；
- 只有 CI，没有 CD（构件发布、镜像推送、服务器部署）。

**动作**：补前端 Dockerfile + nginx 反代；确认正式域名与证书；增加 CD 工作流。

---

## 四、P2 · 产品能力补全（对齐《项目建议书》）

### 6. 前端仍有模块走 Mock 数据
`api/` 中不少模块保留 mock 兜底：`aed.ts`(7 处)、`news.ts`(7)、`atlas.ts`(6)、`cases.ts`(6)、`learn.ts`(6)、`records.ts`(6)、`task.ts`(5)、`user.ts`(4)；
`media-alert.ts` **0 次真实请求**，基本是占位。虽然后端路由已齐备，但前端未全部接通。

**动作**：逐个模块切换到真实接口，移除 mock 兜底（或改为显式错误处理）。

### 7. 旗舰创新「AED 责任人实时联动 + 远程解锁」未闭环 ⭐
建议书 Section 07 把这条列为**核心差异化创新**。当前实现程度：
- ✅ 数据模型：`custodian_name / custodian_phone / custodian_role` 字段与迁移齐备；
- ✅ 展示：设备详情页有责任人卡片与 `notifyOwner` 触点；
- ✅ 取用登记：`aed_pickups` 表 + 取/还接口 + 审计日志；
- ❌ **缺失**：服务端「通知责任人 → 责任人一键远程解锁」的实时链路（无 unlock/notify 接口，`notifyOwner` 疑似仅拨号）。

**动作**：设计并实现 `POST /api/aed/:id/notify-custodian` 与 `POST /api/aed/:id/unlock`，接入推送（`push` 模块已具备），并记录响应时间戳以支撑 KPI（目标 2 分钟内响应确认）。

### 8. 政府数据监管看板
建议书承诺「政府专属数据看板：响应时间、覆盖率、任务数据」。现有 `org/dashboard.vue` 面向机构，尚不构成政府监管视图。

**动作**：明确看板指标口径 → 补 `/api/admin` 或新政府路由 → 前端页面。

### 9. 薄页面复核
疑似壳页面：`auth/change-pwd.vue`(27 行)、`cert/interests.vue`(29)、`cert/upload.vue`(34)、`pages/atlas/index.vue`(60)。
**动作**：确认是「轻量实现」还是「未完成占位」。

---

## 五、建议执行顺序

```
P0-1 后端 238 类型错误  ┐
P0-2 前端 49 类型错误   ├─→ P0-3 push + CI 变绿  ─→ P1 工程/部署  ─→ P2 产品补全
                        ┘
```

**理由**：CI 是最低成本的质量护栏。在它变绿之前，任何新功能开发都缺少回归保护，且 15 个提交积压越久、合并风险越高。

---

## 六、安全与合规体检（现状良好）

- ✅ `.env` **未入库**（`git ls-files` 无匹配），`.gitignore` 已含 `.env`、`*.db`；
- ⚠️ `.env` 中 `JWT_SECRET=jiujiaxia-dev-secret` 为开发默认值，**上线前必须更换为强随机串**；
- ✅ 已有 `authMiddleware` + admin 路由鉴权 + 登录限流 + Zod 入参校验；
- ⚠️ 图片上传为 base64 直写磁盘（`/api/upload`），未见类型/大小白名单校验，建议补。

---

## 七、执行 P0 过程中新发现的技术债

以下均为**非阻塞**项，不阻碍 CI 转绿，建议择机收敛：

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| 1 | `急救侠-server/src/__tests__/setup.ts` | `export { server as app }` 把 `http.Server` 当 `app` 导出，命名误导（17 个测试文件全部只有 `request(app)` 一种用法，共 132 处，故功能安全） | 改名为 `server` 并同步 17 个文件的 import，或加显著注释 |
| 2 | `急救侠-uniapp/src/global.d.ts` | 用 12 行全局声明给 lib.dom 的 `EventTarget.value` / `Event.detail` 打上可选属性 —— 一处改动会影响全仓所有事件，今后写错 `.value` 也不再报错（注释掉该增强后实测冒出 33 个错误） | 收窄为 uni 事件类型或项目内 `UniInputEvent`，不要动全局 DOM 接口 |
| 3 | `急救侠-uniapp/src/stores/user.ts` | `awardPoints(amount, _reason?)` 第二参数被静默丢弃，但 3 个调用点（`stores/aed.ts:34`、`stores/aed.ts:63`、`__tests__/stores/user.test.ts:29`）都在传有意义的加分理由 | 二选一：真正使用 `reason`（落库/调 `awardPointsApi`），或删掉该参数并同步 3 个调用点 |
| 4 | 两个 `package.json` | 后端运行时 `express ^4.21.1` 与 `@types/express ^5.0.0` **主版本不一致**，排查时易被类型定义带偏 | 对齐到同一主版本 |
| 5 | `急救侠-server/src/routes/*.ts` | 大量 `'xx_' + Date.now()` 单时间戳主键，同毫秒内两次同前缀 INSERT 会撞 `PRIMARY KEY`。重复前缀：`'tm_'`（`rescue.ts` 4 处）、`'om_'`、`'msg_'`、`'gm_'` 各 2 处 | 统一追加随机后缀（照抄 `push.ts:44`、`video.ts:19` 的 `Date.now() + '_' + Math.random().toString(36).slice(2,6)`），或改用 `crypto.randomUUID()` |

### 环境备注（换机必看）

本机 arm64，但 `node_modules` 内的原生依赖是 **x86_64**（疑似从 Intel 机器拷贝或在 Rosetta 下安装），会直接导致测试无法运行：

```bash
cd 急救侠-server
npm install @rollup/rollup-darwin-arm64@4.60.3 --no-save   # 缺 arm64 rollup 二进制
npm rebuild better-sqlite3 --build-from-source             # better_sqlite3.node 为 x86_64（约 1.5 分钟）
```

根治：换机后删除 `node_modules` 重新 `npm ci`。
