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

---

## ✅ CI 已首次全绿（2026-09-10 19:54）

推送后 CI **首次真正运行**（此前 15 个提交一直积压未推，CI 配置从未被执行验证过）。

**第一次运行（`34552300374`）**：Server job 通过，Uniapp job 在 `Install dependencies` 阶段失败。
**第二次运行（`34552420524`）**：两个 job 全部通过。

| Job | 结果 | 耗时 |
|-----|------|------|
| Server — type-check + test | ✅ | 26s |
| Uniapp — type-check + test | ✅ | 1m11s |

### 首次运行暴露的第 3 个阻塞项：uniapp 依赖安装 ERESOLVE
- **现象**：`npm ci` 失败，`ERESOLVE could not resolve`，`pinia@3.0.4` 要求 peer `vue@^3.5.11`，而 uni-app 侧锁定 `vue@^3.4.21`。
- **为什么本地从不暴露**：本地 `node_modules` 是用 **pnpm** 装的（peer 校验宽松），且 `.npmrc` 里只有 pnpm 的 `shamefully-hoist=true`；CI 用的是严格的 `npm ci`。**这个问题只可能由 CI 首次运行暴露出来** —— 又一次印证"积压 15 个提交不推"的代价。
- **修法**：`.npmrc` 增加 `legacy-peer-deps=true`（提交 `1406067`），使 npm 与 pnpm 解析行为一致。已验证 `npm ci --dry-run` 从失败转为通过。
- **遗留技术债**：这是"绕过"而非"解决"。应择机把 `vue` / `pinia` / `@vitejs/plugin-vue` 版本对齐后删掉该行（uni-app 对 vue 版本有约束，需谨慎评估）。
- **另注**：`@vitejs/plugin-vue` 在 `package.json` 中为 `^6.0.6`，而 vite 为 `5.2.8`，同样存在版本错配，建议一并评估。

---

## ✅ P1 部署链路已完成（2026-09-11 收官）

**TL;DR**：前端 H5 容器化 + `docker compose` 前后端一键拉起 + `BASE_URL` 去硬编码 + GHCR CD 自动发布，已端到端跑通并经 QA 独立验证（0 缺陷）。

### 交付的 3 个提交（`0e0e7a9..ad39c06`，已推送 origin/main）
| 提交 | 说明 |
|------|------|
| `0e0e7a9` | feat: 前端 H5 容器化 + compose web 服务 + BASE_URL 可配置 + GHCR CD |
| `7040775` | fix: 修正 server `.dockerignore` 排除 `src/`/`tsconfig.json` 导致 CD 构建失败 |
| `ad39c06` | fix: uniapp Dockerfile 显式加 `--legacy-peer-deps` 解决 Docker 构建的 pinia/vue ERESOLVE |

### 新增 / 修改文件
- **新增** `急救侠-uniapp/Dockerfile`（多阶段 node:22-alpine → nginx:alpine）、`nginx.conf`（SPA 回退 + `/api`、`/uploads` 反代 `server:3001`）、`.dockerignore`
- **修改** `docker-compose.yml`（新增 `web` 服务，`8080:80`，`depends_on server healthy`）
- **新增** `.github/workflows/cd.yml`（push main → 推 GHCR 镜像）
- **修改** `急救侠-uniapp/src/api/index.ts`（`export let BASE_URL`；H5 `/api`；非 H5 走 `process.env.API_BASE_URL`，保留占位默认）
- **修改** `急救侠-uniapp/src/pages/video/index.vue`（去掉重复的本地 `BASE_URL`，改为从 `@/api/index` import）
- **修正** `急救侠-server/.dockerignore`（删掉与 Dockerfile 矛盾的 `src/`、`tsconfig.json`）

### 门禁结果（commit `ad39c06`）
| 门禁 | 结果 |
|------|------|
| CI — Server type-check + test | ✅ 25s |
| CI — Uniapp type-check + test | ✅ 37s |
| CD — Build & Push（server + web） | ✅ 1m37s |

### 部署链被"真跑"暴露出的两个缺陷（文档级评估无法发现）
1. **server 镜像构建失败**：`急救侠-server/.dockerignore`（`06dbab2` 引入）把 `tsconfig.json` 与 `src/` 排除了，但 `Dockerfile` 需要 `COPY tsconfig.json ./` + `COPY src/ src/` 才能编译 → 上下文缺 `src` → 构建失败。此前**从未真正构建过 server 镜像**（CI 只 type-check+test；本机无 Docker），故一直潜伏。修：删掉冲突两行。
2. **web 镜像构建失败**：`RUN npm ci` 在 Docker 内复现了 P0-3 的 `pinia@3.0.4 ↔ vue@3.4.21` ERESOLVE。Dockerfile 顺序为 `COPY package.json package-lock.json` → `RUN npm ci` → `COPY . .`，`.npmrc` 到第三步才进镜像，第二步看不到 → 必然 ERESOLVE。修：`RUN npm ci --legacy-peer-deps`（显式自包含，不依赖复制顺序）。

> **教训**：`docker-compose.yml`/`Dockerfile` 存在 ≠ 能跑通。CI（type-check+test）不构建镜像、本机无 Docker，都会让部署工程"看起来完成"。**部署链必须真的在干净 runner 上构建一次** —— 这是 CD 的核心价值。P0 的 `legacy-peer-deps` 只修了 CI 的 `npm ci`，Docker 子环境需单独处理。

### QA 独立验证（严过关，0 缺陷）
- **GHCR 镜像**：用**匿名 OCI 注册表协议**绕过 token scope 限制拿到硬证据 —— 两镜像 `public`、`tags:["latest"]`、manifest HTTP 200、server config `ExposedPorts=3001/tcp`。
- **溯源**：解出 build-provenance 层，`runDetails.builder.id` = run `34555788912`，headSha = `ad39c06` → 证明 `latest` 就是本次 CD 产物（强于"步骤成功"）。
- **部署链**：`docker compose up` → `http://localhost:8080/` → `POST /api/auth/login` 逐段追通，无缺口；`.dockerignore` 复核到位；`declare const process` 为模块级局部，未污染全局（P0 技术债 #2 未扩大）。
- **回归**：本地 server 117 + uniapp 151 全绿。

### 使用方式
```bash
cp 急救侠-server/.env.example 急救侠-server/.env   # 首次
# 编辑 .env（务必更换 JWT_SECRET）
docker compose up -d
# 前端 http://localhost:8080/  →  nginx 反代 /api、/uploads 到 server:3001
```
镜像：`ghcr.io/bujinwang/jiujiaxia-server:latest`、`ghcr.io/bujinwang/jiujiaxia-web:latest`

### P1 遗留（未做，非阻塞）
- **TLS 未上**：当前仅 HTTP（决策"先 HTTP，TLS 后续"）。域名+证书就绪后可用 Caddy/certbot 前置终止 TLS。
- **CD 仅发布镜像，无服务器部署**：尚未 SSH 部署到 VPS（决策"推 GHCR"）。需时补 deploy 步骤 + 主机密钥。
- **`legacy-peer-deps` 仍是"绕过"**：应择机对齐 `vue`/`pinia`/`@vitejs/plugin-vue` 版本后移除。
- 本机 arm64/x64 原生依赖问题（见"环境备注"），根治仍是换机 `npm ci`。

---

## 🚧 P2 产品能力补全 · 进行中

### ✅ P2-7 AED 责任人实时联动 + 远程解锁（已完成，2026-09-11）

**MVP 语义 = 责任人远程「确认授权」**（不做物理开锁）：记录授权 + 通知急救者取用；接口保留 `unlock` 名以兼容未来 IoT，但契约用 `commandStatus` 表达指令生命周期。设计/PRD 见 `deliverables/software-company/aed-linkage-{prd,design}.md`（**当前未纳入 git**）。

| commit | 说明 |
|--------|------|
| `ecba302` | feat(aed): 后端（schema/迁移/类型/审计 + 定向推送 + 5 接口 + 测试） |
| `367d5ae` | feat(aed): 前端（API/状态层 + 急救者通知与确认授权 UI + 责任人确认页） |
| `973cfba` | test(aed): 主线通知用例补显式扇出断言 |

**新增接口（挂 `/api/aed`，均 `authMiddleware`）**
- `POST /:id/notify-custodian` —— 急救者通知责任人；PIPL 同意前置；设备无责任人 → `4001` 且 **HTTP 200（不阻断急救）**
- `POST /:id/unlock` —— 责任人「确认授权 / 拒绝」；**幂等**：同人重试同动作 → 200 `idempotent`，**他人 → 409 / 4004「已被他人确认」**
- `GET /custodian-alerts/pending` —— 责任人收件箱（JOIN `aed_managers`，backup 可见）
- `GET /:id/custodian-alerts/:alertId` —— 状态回读
- `POST /:id/custodian-alerts/:alertId/revoke-consent` —— PIPL 撤回首肯

**关键设计**
- 新表 `aed_custodian_alerts`（30 列 + 4 索引，迁移 `030_add_custodian_alerts`）；时间戳 **UTC epoch ms**；SLA 固定 **120s**；KPI `response_latency_ms` / `sla_met`；**读时惰性过期**（无后台调度器）。
- 推送新增**定向能力** `services/pushService.ts#sendPushToUser`（原 `push.ts` 只能广播）；模板 `aedCustodianRequest`（**需在小程序后台申请**，非代码前置）。
- **主 + 备责任人并行推送**，谁先确认谁生效（收件箱对 backup 亦可见）。
- 超时后**迟到**的确认仍受理，记 `sla_met=0`（急救安全优先）。
- PIPL：通知前强制同意 + 撤回接口 + 前端同意弹窗；只传姓名 + 位置（`users` 无 phone 列，`requester_user_phone` 留空）。

**顺带修掉的技术债**：`logAudit` 的 `al_+Date.now()` 同毫秒主键碰撞（会丢第二条审计，如 authorize 连写 `custodian_acknowledged`+`unlock_issued`）已加随机后缀 —— 即"七、技术债 #5"的一部分。

**门禁与验证**
- CI ✅（后端 **141** = 117 + 24 / 前端 **151**）；CD ✅（部署链未被破坏）。
- QA 对抗式验证：**0 源码缺陷**；9 项边界（backup 确认 / 双 manager 竞态恰为 `[200,409]` / 无责任人 200 且不落库 / 路由未被 `/:id` 遮蔽 / 迟到确认 `sla_met=0` / PIPL 4006 / 撤回 / 4 索引 / 文案纪律 0 违规）全部通过。

**P2-7 遗留（非阻塞，属 P1 范围）**：短信/电话多通道降级；IoT 开柜指令（已预留 `unlock_token` + `command_status`）；政府监管看板指标。

### ✅ P2-6 前端去 Mock / 接真实后端（已完成，2026-09-11）

把 `aed / atlas / cases / learn / media-alert / news / records / task / user / volunteer` 共 **10 个 API 模块**的 mock 兜底全部切到真实后端接口。

- commit：`43baab3`(去 mock 基座) → `af274ba/39a7e71/d35f0ff`(各模块) → `3894ab3`(页面/日志/脚手架) → `1163782/3ee1de9/d50dda6/2a17541`(测试重写) → `42aa9a6`(**空值防护修复**) → `2470820`(补真实行为测试 + 映射表入库)。
- **`MOCK_` 在 `uniapp/src` 归零**；失败路径**显式记 error 并抛出**（不静默兜底）；`api/index.ts` 的误导日志 `[API] 请求失败，使用 mock 数据` 已清理。
- **签名变化**：本质取数的同步 getter → async 或移除；stores 改为 `ref` + `refresh()/loading/error`；调用方（stores/页面）已同步更新。
- **空值防护**：8 个 `mapXxx` 加 `if (!raw) throw new Error(...)`，消除"后端空响应 → TypeError"（曾致 CI 红）。
- 门禁：CI ✅（后端 141 / 前端 **131**）；CD ✅。
- QA 对抗式验证：功能可接受（映射诚实、无静默 mock）。QA 揪出并已修复：① `fetchCaseByIdApi` 空值崩溃（曾使 CI 红）；② 重写时误删的 6 组真实行为单测（news 筛选 / task 相位机 / aed 排序·发现 / records roleStats / cases selectCase-null / learn tab）—— 已补回。
- 映射表：`急救侠-uniapp/docs/p2-6-api-mapping.md`。

**已知后端缺口（前端已诚实降级、未臆造）**：`learn /trainings` 无端点（用前端本地 UI 配置）；`records` 无 `/:id`（列表 + 客户端筛选）；`volunteer/rankings` 不支持 `type` 维度（两榜同数据）；`media-alert` 后端只记元数据、不落盘二进制；`cases↔news` 互链字段缺失。建议作为后续小项补后端。

### ✅ P2-6 后端缺口补齐（已完成，2026-09-11）

把 P2-6 暴露的 5 处后端缺口补齐，前端不再降级：

- commit：`72af14d`(后端) + `ec419b2`(前端接线) + `d914e35`(gitignore) + `50c14ac`(严格只增不改 + 测试清理)。
- **`records /:id`**：新增 `GET /api/records/:id`（未找到 404 + `救援记录不存在`），前端直连，去掉"列表+客户端筛选"。
- **`volunteer/rankings?type=`**：`points`(默认) / `rescue` 真实不同排序；`rank` 语义不变，新增 `position`（所选维度 1-based 位次）。
- **`media-alert`**：`multer.diskStorage` 落盘 `public/uploads/media` + 扩展名白名单 + 200MB 上限；响应新增 `url`/`urls[]`。**严格只增不改**：`imageCount`/`message` 保持原语义，真实上传数用新增 `uploadedCount` 表达。
- **`cases↔news`**：迁移 `031_add_case_news_link` 给 `rescue_cases` 加**可空** `news_id`；list / `:id` 暴露 `newsId`；**无可靠来源保持 NULL**（不伪造）。
- **`learn /trainings`**：判定为**导航路由配置**，**有意保留前端本地**（映射表已标注）。
- 门禁：CI ✅（后端 **150** / 前端 **134**）；QA 对抗式验证 **0 源码缺陷**（media-alert 逐字节落盘 + 白名单拒 `.exe` + 201MB 拒收均实锤）。
- 映射表：`急救侠-uniapp/docs/p2-6-api-mapping.md`（5 项均已标注 ✅ / 有意保留）。

### ✅ P2-8 政府数据监管看板（已完成，2026-09-11）

- commit：`d325d5e`(T01 数据+鉴权基座) + `199a62f`(T02 gov 路由/聚合接口) + `ff3bba1`(T03 后端测试) + `5eae8ac`(T04/T05 前端看板) + `3319e26`(**令牌隔离修复**)。
- **独立鉴权**：`gov_viewers` 白名单 + `middleware/govAuth.ts`；**gov 令牌与业务 `authMiddleware` 彻底隔离**（`GOV_JWT_SECRET` 不再回落业务密钥 + 业务层显式拒绝 `gov:true`，两层纵深防御）；口令 `crypto.scryptSync`（**零新增依赖**）。
- **13 项指标**全部落地；**覆盖率 M2/M3** 分母（人口/面积基线）缺失 → 恒 `null` + `meta.dataGaps`（只标注不实现）；**冷启动**无告警数据 → P95/SLA/无响应率返 `null`（**非 0**），前端显示"数据积累中"。
- **区域维度**：`aed_devices`/`tasks`/`rescue_records` 加**可空 `district`**（迁移 **032–035**）；未分区归一化 `__UNASSIGNED__`（不排除、数量守恒）。
- **脱敏**：仅区级聚合，响应**零 PII**。
- 接口：`POST /api/gov/login`、`GET /api/gov/me`、`GET /api/gov/dashboard`、`/api/gov/viewers`（管理员 CRUD，`is_leader`）。
- 门禁：CI ✅（后端 **167** / 前端 **134**）；QA 对抗式验证：**发现 1 个真实安全缺陷**（gov 令牌曾可穿透业务鉴权，因密钥回落）→ 已修并独立复验；其余 9 项 PASS。
- 文档：`deliverables/software-company/gov-dashboard-{prd,design}.md`（+ `gov-dashboard-{sequence,class}.mermaid`）。
- **遗留（P1 / 后续）**：`district` 存量回填；覆盖率需外部人口/面积基线；SSO / IP 白名单；gov 前端单测；CSV/PDF 导出；省级卫健委平台对接。

### ✅ P2-9 薄页面复核（已完成，2026-09-11）

实读 4 个薄页面 + 追其依赖的后端契约，**无一是空壳占位**：

| 页面 | 行数 | 判定 | 依据 |
|------|-----:|------|------|
| `auth/change-pwd.vue` | 29 | ⚠️ **能跑但脆弱** | 表单/校验/`POST /auth/change-password` 齐全，但**从 `jwt_token` 字符串截取 phone**（`replace(/^(demo_\|token_)?/,'').replace(/_.*/,'')`）；因后端登录返回**明文** `token_<phone>_<ts>`，恰好取到 phone；token 若变真 JWT 即失效 |
| `cert/interests.vue` | 30 | ✅ 轻量但完整 | 兴趣多选 + `PUT /user/interests` + 同步 store |
| `cert/upload.vue` | 35 | ✅ 轻量但完整 | 完整表单 + `POST /rescue/certification` + 记录列表/状态 |
| `atlas/index.vue` | 60 | ✅ 合法薄视图 | 纯展示（渲染 store 卡片 + 巡检入口），数据/导航在 store |

**⚠️ 复核中发现更重要的跨模块缺陷（待修）——鉴权 token 模型不一致**：
- 后端**手机号登录**返回**明文** `token_<phone>_<ts>`（`routes/auth.ts:96`），**不是 JWT**（`signToken` 只用在同文件的微信登录路径 `routes/auth.ts:40`）；
- `authMiddleware` 用 `verifyToken`（`jwt.verify`，**严格 JWT**，`middleware/auth.ts:19-21`）→ 明文 token **被 401**；
- 前端 `api/index.ts` 将该 token 作为 `Bearer` 附到**所有请求**；而 **P2-7 的 AED 联动端点（`notify-custodian`/`unlock`/`custodian-alerts/*`）都挂了 `authMiddleware`** → **手机号登录用户在真实使用中会 401**。
- 定性：后端单测用 `signToken` 造 JWT，故全绿；**前端携带的却是明文 token** → 典型"单测过、端到端未必通"。**待修**（建议手机号登录也改发 `signToken` 的 JWT；随之 `change-pwd.vue` 不能再从 token 截取 phone，应改用已登录身份）。
