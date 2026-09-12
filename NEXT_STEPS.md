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

### ✅ P1 部署遗留 → 已完成（2026-09-12）

**交付生产部署工程**（`8f00d0f`）：目标拓扑 `Internet → Caddy(443, 自动 HTTPS) → web:80(nginx) → server:3001`，复用 P1 已验收的 nginx 路由逻辑。

| 文件 | 作用 |
|------|------|
| `docker-compose.prod.yml`（新增） | 生产形态：三服务全用 **GHCR 镜像**（非本地 build）；**仅 caddy 暴露 80/443/443-udp**，`server`/`web` 仅 `expose` 内网端口；`caddy-data` 卷持久化证书（避免重签撞 ACME 速率限制） |
| `Caddyfile`（新增） | `{$DOMAIN}` + 自动申请/续期 Let's Encrypt；`reverse_proxy web:80` |
| `.env.example`（根级，新增） | 生产变量占位符；标注 `GOV_JWT_SECRET` **必须与** `JWT_SECRET` **不同**（P2-8 隐患的部署侧要求）、`CORS_ORIGINS` 生产必填 |
| `.github/workflows/cd.yml`（修改） | 新增 `deploy` 作业：`needs: build-and-push` → SCP 上传 compose/Caddyfile → SSH `compose pull && up -d`；**未配置 Secrets 时优雅跳过**（`::notice` 提示，不让 CI 变红）；`.env` 只存在主机、不入库不上传 |
| `docs/DEPLOY.md`（新增） | 主机前提 / 首次部署 / GitHub Secrets（4 项）/ 回滚 / 故障排查 |

**本轮验证（静态，因本机无 Docker）**：
- YAML 结构断言通过（`server`/`web` **无** `ports`、caddy 含 443、3 个 SSH step **全部**有 `env.SSH_HOST != ''` 守卫、`deploy.needs == build-and-push`）。
- **Caddyfile 用真实 `caddy v2.8.4 validate` 通过**；顺带实证工程师发现的坑：`TLS_EMAIL` 为空会让 `tls` 行解析失败（`wrong argument count ... after 'tls'`）——已在 `.env.example`、手册、故障表三处写明规避方式。
- **线上实测"无 Secrets 不红"**：CD run `34640522449` = success，`Build & Push` 1m29s ✓、`Deploy to server` 11s ✓（跳过），注释即「未配置 SSH_HOST / SSH_USER / SSH_KEY，跳过部署（配置 Secrets 后自动生效）」。

**待主机接入（唯一剩余动作，非代码工作）**：拿到服务器+域名后，按 `docs/DEPLOY.md` ① 主机建 `/opt/jiujiaxia/.env`（`openssl rand -hex 32` 生成两个不同密钥）② 仓库配 `SSH_HOST`/`SSH_USER`/`SSH_KEY`(+可选 `SSH_PORT`) ③ 域名 A 记录指向主机并放行 80/443 ④ push main 即自动部署。

### ✅ P1 部署遗留 · 本机生产同构自测（macOS/colima，已完成 2026-09-12）

**目标**：上线前在本机跑一套**与生产同构**的栈（Caddy TLS → web nginx → server），做真实端到端验证。用户要求"先充分测试再上线"，且暂无主机。

**交付文件**（均为本机专用，与生产文件隔离）：

| 文件 | 作用 |
|------|------|
| `docker-compose.local.yml`（新增） | 与 `docker-compose.prod.yml` 同构；差异仅：本机 `build:`（arm64 原生，无需 GHCR）、宿主端口 **8443**、`server-data-local`/`caddy-data-local` 卷 |
| `Caddyfile.local`（新增，`.gitignore` 例外入库） | `localhost { tls internal }` —— Caddy 内部 CA 自签，**不联网/不需域名/不需 80 端口** |
| `.env.local`（生成，chmod 600，gitignored） | 两个**不同**随机密钥 + `CORS_ORIGINS=https://localhost:8443` |
| `docs/DEPLOY.md` §9（新增） | 本机自测全流程 + 踩坑表 |
| `docs/screenshots/local-e2e-home.png` | 无头 Chrome 渲染首页截图（E2E 证据） |

**真跑暴露并修复的 1 个缺陷（重要，影响生产）**：
- **现象**：`docker compose up` 中 `web` 永远 `health: starting` → `caddy` 卡在 `Waiting` → 整个 `up` 挂死超时。
- **根因**：`急救侠-uniapp/nginx.conf` 自定义 `server{}` **覆盖**了 nginx 基础镜像的 `default.conf`，使镜像自带的 `10-listen-on-ipv6-by-default.sh` 不再生效 → nginx **只监听 IPv4**；容器内 `getent hosts localhost` 返回 `::1` 优先 → 健康检查 `wget http://localhost/` 连接被拒。
- **影响面**：`docker-compose.prod.yml` 同一处健康检查（`http://localhost/`）→ **生产部署会以完全相同的方式挂死**。属纯工程链路缺陷，静态审查与 CI（只做 type-check+test）均无法发现。
- **修复**：① `nginx.conf` 增加 `listen [::]:80;`（恢复双栈，根治）；② `docker-compose.local.yml` + `docker-compose.prod.yml` 的 web 健康检查改用 `http://127.0.0.1/`（确定性，不依赖 IPv6）。

**端到端验证结果（全部实测通过）**：

| 项 | 结果 |
|---|---|
| 三容器状态 | `server`/`web` healthy、`caddy` up（`0.0.0.0:8443->443`） |
| Caddy TLS | 内部 CA 成功签发 `localhost` 证书（日志 `certificate obtained successfully`） |
| SPA（`/`） | HTTP 200 `text/html`，`<title>急救侠</title>`；4 个静态资源 `/assets/*` 全 200 |
| 客户端渲染 | 无头 Chrome 截图确认 Vue 应用**真实挂载**（见截图，非空白壳） |
| `/api/health` | `{"code":0,"message":"急救侠 API 运行中"}` |
| 注册→登录→受保护端点 | register 200 → login 返回真实 JWT → `/api/auth/me` 200 |
| 鉴权负例 | 无令牌 `/auth/me` → 401；错误口令 → `密码错误`；`/gov/viewers` 无令牌 401 / 普通用户 403 |
| 令牌隔离（P2-8） | 业务 JWT 打 gov 端点（`govMiddleware`）→ 401「令牌无效或已过期」 |
| 口令散列 | DB 中密码为 `s1$...`（scrypt，非明文） |
| 持久化 | 重启 `server` 后用户数据完好（`server-data-local` 卷） |
| 安全加固（活体） | helmet 头齐全；CORS 白名单外 Origin **无** ACAO；1.6MB 请求体 → **413** |

**环境踩坑（已记入 DEPLOY.md §9.6）**：`~/.docker/config.json` 残留 Docker Desktop 的 `"credsStore": "desktop"` → `docker-credential-desktop not found`（删该行）；`colima start` 需 `export PATH="/opt/homebrew/bin:$PATH"`。

### ✅ E2E 冒烟脚本 `scripts/smoke.mjs`（已完成 2026-09-12）

把「本机生产同构自测」那一轮的手工验证固化为**一键可重复**的脚本，供上线前 / 每次部署后复跑。

| commit | 说明 |
|--------|------|
| `51d6cc2` | 初版：13 条断言，零依赖 Node ESM，`node scripts/smoke.mjs` 直接跑 |
| `0294bad` | 抗脆弱修补：CORS/413 移出 `/api/auth` 限流桶 + assets 计数解耦 + 汇总暴露 429 |
| `d4b4032` | `SCRIPTS.md` 限额口径同步（8 次 → 5 次） |

**13 条断言**：SPA + 全部 `/assets` 逐个 200 ｜ `/api/health` ｜ 注册→登录（**校验真 JWT 三段结构**）→`/auth/me` ｜ 无令牌 **401** ｜ 错口令 ｜ 业务令牌打 gov 端点 **401**（P2-8 令牌隔离）｜ 普通用户 `/gov/viewers` **403**（角色拆分）｜ **CORS 双向**（白名单有 ACAO / evil 无）｜ 1.6MB → **413** ｜ helmet 头。

**CLI**：`--base`（默认本机 `https://localhost:8443`，生产传域名）｜`--insecure`（仅 `localhost`/`127.0.0.1`/`::1` 自动开启，**不会误跳过生产 TLS**）｜`--phone/--password/--verbose`。幂等：固定测试号，注册遇「已注册」视为 PASS。

**验证方法论 —— 「证明脚本会红」**（本次最大的收获）：
- 冒烟脚本的验收标准不是「跑通」，而是**系统退化时会 FAIL**。用 `/tmp` 下临时 mock 做**故障注入**（只注入定向错误、其余返回正确值），确认**精确命中**对应断言，而不是「连不上所以全红」这种无差别失败。
- QA 独立复现 **12 类注入**（#1/#3/#5/#6/#8/#11 双向/#12/#13，及 #2 同源耦合、#7/#9/#10），全部精确命中；主理人另用 3 类独立复核一致。QA 源码审查结论：**无「虚假通过」路径**（`check()` 不吞异常、#11 两方向都断言、#12 真发 1.6MB、#5 真验 JWT 三段）。
- 既有测试：后端 **220** / 前端 **134** 全绿。

**主理人在 QA 判「可交付」后追加的两处修补**（理由是二者都是「假红」来源，会侵蚀门禁可信度）：
1. **限流耦合**：`authLimiter`（`app.ts:64-68`，**20 次 / 15 分钟**）挂在**整个 `/api/auth` 前缀**，脚本原每轮发 **8** 次 → 15 分钟内跑 3 轮即 429、连带 #4–#10 假红。修法：把**不依赖鉴权**的两条改打**无限流的 `/api/health`**（`express.json` 是 app 级中间件，体解析先于路由匹配，故 413 仍成立）→ 每轮 **5** 次，**连跑上限 ~2 → 4 轮**。实测：重启清桶后连跑 4 轮 13/13，第 5 轮 429。
2. **#2 硬编码「恰好 4 个 assets」** → 改为「提取全部 / 至少 1 个 / 逐个 200」，数量仅作信息打印。否则**合法前端重构建**（多/少一个 chunk）会假红 —— 而那恰是最需要冒烟通过的时刻。

**429 语义**：命中限流时汇总**首行**打印「⚠ 本轮含 N 处 429…结果未必代表真实回归；请 15 分钟后重跑」，**exit 仍为 1**（不确定时宁可红，不静默跳过）。

**用法**（见 `docs/DEPLOY.md §9.3` 与 `SCRIPTS.md`）：
```bash
node scripts/smoke.mjs                          # 本机（默认 8443 自签）
node scripts/smoke.mjs --base https://<域名>     # 生产（不跳过 TLS 校验）
```

### 其他 P1 遗留（非阻塞）
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
- **遗留（P1 / 后续）**：`district` 存量回填；覆盖率需外部人口/面积基线；SSO / IP 白名单；~~gov 前端单测~~（✅ 已补，见下）；~~CSV/PDF 导出~~（✅ 已补，见下）；省级卫健委平台对接。

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
- 定性：后端单测用 `signToken` 造 JWT，故全绿；**前端携带的却是明文 token** → 典型"单测过、端到端未必通"。
- **✅ 已修（2026-09-11）**：`7a02e45` + `c1ce051` —— ① 登录/注册改发**真 JWT**（`signToken`，payload 含 `userId`）；② `/auth/change-password` 加 `authMiddleware`、从 `req.auth.userId` 定位用户、**不再信任客户端 `phone`**（越权改他人密码 → 403）；③ `change-pwd.vue` 去掉 token 截取、改用已登录身份；④ `/user/profile` 去明文解析；⑤ `checkLogin` 清理无效令牌、demo 令牌仅 UI 演示。
- 验证：CI ✅（后端 **174** / 前端 **134**）；QA 独立回归（**自建**"注册→真 JWT→`/api/auth/me`=200"、P2-7 端点不再 401、越权改密被拒、demo 令牌仍 401、无残留截取）**0 缺陷**。

---

## ✅ 技术债收敛（2026-09-11）

| # | 原技术债（§7） | 处置 |
|---|----------------|------|
| 1 | `setup.ts` `export { server as app }` 命名误导 | `a9ad204`：测试夹具 `app→server` 正名（`http.Server` 不再误称 `app`）+ 修正 stale 注释 |
| 2 | `global.d.ts` 全局 Event 增强过宽 | `6d851d4`：**移除全局 DOM 增强**，改用项目内 `UniInputEvent`/`uniInputValue`（`src/types/uni-events.ts`）；移除后 `vue-tsc` 仍 **0 错**（类型安全真被替代而非掩盖）|
| 3 | `awardPoints(amount, _reason?)` 第二参数被静默丢弃 | `2650f7e`：`reason` 记入 `pointLog`（不再丢弃）+ 测试断言 |
| 4 | `express ^4.21.1` 与 `@types/express ^5.0.0` 主版本不一致 | `64bfcbb`：`@types/express` 对齐到 `^4.17`（与运行时同主版本）|
| 5 | `'xx_' + Date.now()` 单时间戳主键碰撞 | `a9ad204` + `4f395df` + **`d58d4bc`**：分批共补齐 28+ 处，**宽模式 grep 确认"`Date.now()` 后无后缀的主键点位已归零"**（覆盖 `tm_/om_/msg_/gm_/grp_/gmsg_/vc_/dp_/tp_/acr_/ahr_/rc_/wr_/ec_/mv_/inq_/aed_/ci_/am_/mt_/pu_/ac_/org_/cert_/wl_/te_/mob_/live_/vp_/upload_/dr_/sa_` 等）|
| 6 | `.npmrc` 的 `legacy-peer-deps=true`（P0 绕过） | `560982e` 保留 + `NEXT_STEPS` 2026-09-12 深查结论：**不可安全移除，判定为「机制」而非「绕过」**。实测：uni-app 精确锁 `vue@3.4.21`，pinia 的 peer 要 `vue@^3.5.11`，**且不止 pinia 3**（2.2.8/2.3.x 同样要求 `^3.5.11`；**仅 pinia ≤2.1.7** 允许 3.4）⇒ 同一份 Vue 不可兼得。删标志的两种后果：① 保留旧 lock → `npm ci` ERESOLVE **响亮失败**；② 重新生成 lock（开发者最易如此）→ `npm ci` **绿着**装出「根 3.5.42 + 嵌套 3.4.21」**分裂树**，运行时两套 Vue 静默错配。故：保留标志 + 新增 `npm run check:vue-singleton` 守卫（CI 在 `npm ci` 后断言「恰好一份 Vue」），并把 `.npmrc` 的错误指引（原写「pinia 降回 2.x 即兼容 vue 3.4」，**实为只有 ≤2.1.7 成立**）更正为实测版本表 |

- 门禁：CI ✅（后端 **174** / 前端 **134**）。
- 过程备注：第 5 项曾出现一次批量脚本**误吞行尾换行**（造成行合并），已 `git checkout` 回退并用带 lookahead 的脚本重做，**逐文件行数与 HEAD 一致**、diff 为 16 行一对一替换。

## ✅ 安全收敛（2026-09-12 完成）

**加固六项**（`5580676`）：A 业务用户口令 scrypt 哈希（`services/password.ts`，`s1$<salt>$<hash>` 版本化格式 + `timingSafeEqual`，零新增依赖；存量明文登录即**透明升级**）｜B `JWT_SECRET` 生产 fail-fast（未配置启动即抛错，非生产随机密钥+warn）｜C body 1mb 上限｜D helmet 安全头｜E CORS 白名单（`CORS_ORIGINS`）｜F 三个上传入口（`/api/upload`/`media-alert`/`video`）类型白名单+大小上限。

**QA 对抗式验证挖出并修复的四项既有越权缺陷**（单点加固挡不住旁路，四项均非加固引入）：
| # | 缺陷 | 修复 |
|---|------|------|
| F1 | `reset-password` 零鉴权 → 凭手机号接管任意账号 | 加 `authMiddleware`；仅本人或**同队**队长（`affiliation` 非空相等），匿名 401/越权 403 |
| F2 | 空口令账号用**任意**口令可登录（`if (!stored) return true`） | `verifyAndUpgrade` 三态 `ok\|no-password\|fail`；空口令拒绝口令登录，可凭本人令牌走 change-password **首次设口令** |
| F3 | `POST /user/points` 匿名写且 `LIMIT 1` 给首个用户加分 | 加 `authMiddleware` + 按令牌身份写入 |
| NEW-1 | **注册接口接受 `isLeader` → 自封队长 → 绕过 F1 + 进全站管理面**（`/api/admin/*`、`/api/gov/viewers`、`/push/send`、救援动员均以 `is_leader` 为门禁） | schema 移除 `isLeader`（Zod 剥离，落库恒 0）；队长重置收窄到同队 |
| 附 | `/api/upload` 匿名可写盘（无前端调用方的孤儿端点） | `14e3ee6` 加 `authMiddleware` + 匿名 401 断言 |

**角色拆分**（`cf755f1` + `ccd4736`，用户拍板）：`is_leader`（队伍队长）与 `is_platform_admin`（平台管理员）正交，迁移 `036`；`admin/gov/push` 判定改用平台管理员，`rescue` 两处保持队伍角色；**一次性回填**（保权非授权，幂等 + warn 日志留账号名单）；新字段不可自授；`public.ts` 绝不输出管理员标志（深扫断言）；`role-split.test.ts` 16 条逐判定点断言。

**产品口径沉淀**（已写入代码注释，防重复上报）：`affiliation='蓝天救援队'` 注册即得 silver/500分/3救援/3证书 —— **用户裁定保留**（可信自述），未来上线队籍核验再改审核授予；magic-bytes 内容嗅探本期不做（已有登录+白名单+限额三重防护）。

**验证方式备注**：本轮 QA 中途因额度（429）中断，角色拆分复验由主理人接手完成——亲跑 `role-split.test.ts`（220 全绿）+ 三组只读探针（双重身份并集行为 / 回填语义边界 / QA 遗留探针 A1 定性）。其中 **QA 探针 A1 失败已定性为"场景构造不成立"而非源码缺陷**：测试 `:memory:` 新库中 `024_add_user_is_leader` 因 canonical 已含列而永不记录，DROP 列后 initDb 会自愈重跑补列；D3 探针证明在真实升级库条件下（024 已记录、列真缺失）`ccd4736` 的"after 失败报真实错误"**确实生效**（`no such column: is_leader` 被完整报出）。

**遗留（待派）**：
- ✅ **收窄工单（机制 + 工具已交付，名单待定）**：本工单把「收窄」从**注释里的规则**变成**机制**——
  新增通用元数据表 `app_meta`（迁移 `037_add_app_meta`，同时入 canonical schema 管全新库）+ `getMeta/setMeta`；
  `backfillPlatformAdmins()` **首行**据标记 `platform_admin_narrowing_done` 早退（未置位时行为不变）；
  新增运维 CLI `npm run admin:narrow -- --list | --downgrade <ids> [--force]`（`src/scripts/narrow-platform-admins.ts`，
  决策逻辑抽为纯函数 `planDowngrade`，含「未知 id 整体中止」「会清零时的自锁保护」）。
  收窄一旦执行即置位标记 → 回填**永久停用**，被降级账号**不会被静默重新提权**。
  **具体降级名单仍待业务/运营确认**（属产品决策，不在本次范围）。
  ⚠️ 历史语义边界（**现已由 `app_meta` 标记机制强制**，不再依赖人记住规则）：
  收窄落地后不得再调用 `backfillPlatformAdmins()`（其 WHERE `is_leader=1 AND is_platform_admin=0`
  会把已降级队长重新提权；生产迁移只跑一次，正常不会触发，但机制已兜底）。详见 `docs/DEPLOY.md §10`。
- 迁移机制固有特性（非缺陷，知悉即可）：canonical 已含列的迁移（001/023-028/036/037）在全新库中永不记录、每次 initDb 重跑并 skipped。

- 门禁：CI ✅（后端 **229** / 前端 **134**）；工作树干净。

## ✅ P2-8 政府看板 · 前端单测补齐（已完成）

补上 P2-8 的最大覆盖缺口：gov 前端此前**零单测**（`api/gov.ts`、`stores/gov.ts`、`pages/gov/{dashboard,login}.vue`、`components/{GovStat,GovBarChart}`）。

- commit：`00271aa`（5 个新测试文件 + `setup.ts` 补 `redirectTo` 一行，+497）→ `cd7d8da`（补 `GovStat` 合法零值用例 + 把「无未处理 rejection」升级为直接断言，仅 2 个测试文件，+28/−7）。**均未触碰生产源码、未改 vitest 配置**。
- 覆盖锁定：
  - `api/gov.ts` —— ★**令牌隔离**（仅存业务 `jwt_token` 时 `govAuthHeader()==={}`、`getGovToken()===''`）；`district` URL 编码；`callData` 的「code=0 且无 data 抛错」；管理面 `listGovViewers` 恰以 `{url:'/gov/viewers'}`（**无 gov header**，证走业务令牌）；`govLogin` 错误语义、`callVoid` 非 0 抛错。
  - `stores/gov.ts` —— `districtOptions` 四分支；`login` **只写 `gov_token`**；`loadMe` 失败吞异常置 null；`loadDashboard` 记 error 并抛、`loading` 复位；`setWindow/setDistrict` 用新值重载且失败**无未处理 rejection**；`logout` 清态。
  - `GovStat` —— ★`null` ⇒ 「数据积累中」且**不渲染 0**；★`value=0` ⇒ **渲染 0**（防判空被写成 `!value` 把合法零值误吞）。
  - `GovBarChart` —— 空态「暂无数据」；归一化；`≤0`/非有限值→0%；**正值保 ≥2% 最小可见条**。
  - `pages/gov/*` —— 未登录跳 login；登录空参**不发请求**；合法凭据跳看板。
- 门禁：`npm test` **178 passed / 37 files**（原 134，**+44**）；`type-check` **0 错**；CI `34653320342` **双绿**。
- 验证方式（**突变测试 / 证明测试会红**，非重跑绿灯）：独立 QA 对 **13 处**源码行为逐一改坏 → 对应断言**全部精确变红**（证明断言有牙，无假测试）；43 条用例**连跑 3 次 + 乱序 5 次**零偶发/串扰。主理人**回归重放**上一轮暴露缺口的 2 处突变（`GovStat` 判空改 `!value`、`setWindow` 去 `.catch`）→ 现均 **RED**，缺口确已闭环。
- 复核挖出并闭环的**真实缺口**：「合法 0 必须渲染 0」原先未被测 —— 突变证明现有 5 条全绿，补例后由 RED 证实。
- 非阻塞备注：页面测试用 `shallowMount`（子组件 stub）属**有意分工**，`GovStat`/`GovBarChart` 由独立组件测试覆盖；`[Vue warn] picker` 仅告警、不掩盖断言。

## ✅ P2-8 政府看板 · CSV / PDF 导出（已完成）

- commit：`1798e9c`（功能：`src/utils/govExport.ts` 新建 + `dashboard.vue` 加导出按钮与打印样式 + 20 条用例）→ `b7c4c86`（**安全修复 + 补覆盖**，3 文件 +153/−3，+8 用例）。
- **设计取舍（重要，勿改方向）**：**纯前端导出，不新增任何后端端点**。后端 `/api/gov/dashboard` 已返回**完整、按查看者范围裁剪、零 PII** 的聚合数据，前端 store 已持有 ⇒ 加端点只会白白扩大攻击面（与"收窄走 CLI 不加 HTTP 面"同一取向）。**零新增依赖**：CSV 手写 RFC 4180，PDF 走 H5 `window.print()`（另存为 PDF），不引入 papaparse/jspdf/file-saver。
- **CSV 规范**：UTF-8 **BOM** 开头（否则 Excel 中文乱码）+ `\r\n` 行尾；三段（元信息 / 总览 19 行指标 / 区域明细 9 列），段间空行；**null 一律空串、绝不做 0 兜底**（与看板"不显示 0"不变量一致）；`__UNASSIGNED__ → 未分区`；文件名 `gov-dashboard-YYYYMMDD.csv`（ASCII）。`生成时间` 用**确定性** `YYYY-MM-DD HH:mm:ss`（手写补零、不依赖 locale），且**取自 `meta.generatedAt`** 而非"当前时间"（保证导出物与数据自洽、可复现）。
- **安全：CSV 公式注入防护**。`district` 来自数据库、可由录入者控制；`= + - @ TAB CR` 开头的单元格会被 Excel/WPS 当**公式执行**。修法：`sanitizeCell` 仅对以 `= + - @ \t \r` 开头**且非合法数字**者前置单引号 `'`，**纯数字（含 `-1.5`）原样放行**（防过度清洗毁掉数值列）。**唯一收口在 `toLine()`**，顺序为 **先 `sanitizeCell` 再 `csvEscape`**（保证 `'` 前缀落在引号内）。
- **PDF**：`window.print()` 另存；`@media print` 强制**浅色**（看板原为深色主题，直接打印费墨且看不清）、隐藏工具栏/按钮、`break-inside: avoid`；非 H5（小程序/App）退化为 toast。
- 门禁：前端 **38 files / 206 passed**（178 → 206，新增 28）；`type-check` **0 错**；CI/CD/pages（`b7c4c86`）success。
- **验证方式（突变测试，两轮）**：第 1 轮独立 QA 13 条突变 + 8 项对抗点 → 「可接受」，挖出 **1 安全缺口（公式注入）+ 3 覆盖缺口**；第 2 轮由主理人接手（**QA 因 429 额度中断**）定向重放 **R1–R7 全 RED**：
  - R1 漏清洗（`sanitizeCell` 恒等）→ 3 用例红；R2 **过度清洗**（去掉数字放行）→ 反向用例红；
  - R3 摘掉 `toLine` 收口 → 生产路径用例红；R4 **对调顺序** → 含逗号注入串用例红；
  - R5 生成时间改 `Date.now()` → 确定性用例红；R6 删总览任一行 → 逐行比对用例红；R7 去页面空数据守卫 → 用例红。
  - `\n` 前缀边界**判定不需防护**（依据：规则与 OWASP 注入首字符集一致 `= + - @ TAB CR` **不含 LF**；实测 `\n=1+1` 经 `csvEscape` 被引号包裹、单元格首字符是 LF 而非 `=`，Excel 不判为公式）。确定性：连跑 3 次 + 乱序全绿，零偶发。
- 剩余：`AED 短信/电话降级` —— **短信与语音降级均已完成**（见下节）；待**阿里云凭证做真机联调**。
  - **渠道选型结论（2026-09-11 查价）**：**推荐阿里云** —— 验证码/通知类**按量付费 0.045 元/条**（≤10万条/月，含税、无起充门槛），低于腾讯云最便宜入口（1万条预付套餐 470 元 → 0.047/条，且 2 年有效，低频告警不划算）；云片/华为云第三方口径 0.04–0.075。**语音降级**（收不到短信的老人机）：阿里云语音通知 **0.11 元/分钟**、语音验证码 ~0.08，约为短信 **2.4 倍**，且**不足 1 分钟按 1 分钟计**。
  - **两个成本坑**：① 短信按 **70 字**计费，超出按 67 字/条**拆分多条**计费 ⇒ 文案须压在 70 字内；② 语音可能需**专属号码月租（约 35 元/月/个）**，低量场景下固定成本高于通话费，签约前须确认。
  - **月成本量级**（假设 100 次取用告警 × 3 名责任人 = 300 条 + 20% 语音降级）：约 **20 元/月**。
  - **上线摩擦**：短信需**企业实名 + 签名/模板报备**，约 1–2 个工作日审核 ⇒ 应并行提前提审，否则代码写完发不出去。

## ✅ AED 责任人联动 · 阿里云短信即时降级（已完成；语音待做）

- **触发点**：`services/pushService.ts` 里**标注已久**的「P1 短信降级点」（推送 `reason==='no_subscription'`）。
- commit：`42fdf53`（功能落地）→ `b2cd909`（**改逐人粒度** + 补齐复核指出的 5 处测试缺口）。后端 **229 → 256 passed**（+27）、`type-check` 0 错、CI/CD/pages success。
- **产品定调（用户拍板两项）**：① **仅短信 inline 降级** —— 无后台定时器、**无新增 HTTP 端点**、语音留待下期；② **号码现取现用、不落快照** —— 发送时取 `users.phone` → 空则回落设备级 `aed_devices.custodian_phone`；`aed_custodian_alerts.custodian_phone_snapshot` **保持空串**（不新增 PII 落库）。
- **粒度：逐人（用户拍板）**：**任何一位**责任人推送失败就**单独给他发短信**，不因他人已成功而跳过（避免"无 app 的 backup 在一次告警中完全不被触达"）。成本每人 **0.045 元**，可忽略。条件式：`if (failedManagers.length > 0 && isSmsConfigured())`（**与 `delivered` 无关**）。
- **`delivery_state` 优先级（精确）**：`sms_fallback`（≥1 条短信被阿里云受理 ⇒ **置顶**，便于运维/成本可见）> `delivered` > `failed` > `no_subscription`。
  ⚠️ **`'delivered'` 语义因此收窄**为「**全部**责任人推送均送达且无任何降级」；混合场景（primary 送达 + backup 走了短信）标 **`sms_fallback`**。`status = (delivered || smsSent) ? 'sent' : 'unreachable'`。
- **零新增依赖**：阿里云 RPC 签名用 Node 内置 `crypto` 手写 HMAC-SHA1（**未引 `@alicloud/*`**）；`canonicalizeQuery` 独立可测（字典序 + RFC3986），并有 golden 签名断言（nonce/timestamp 注入，确定性）。
- **迁移 `038_add_user_phone`**：`users` 原本**没有** phone 列（`db.ts:545` 的 `phone` 属 `public_inquiries`）；本次 canonical + 迁移双写新增，并让 `/auth/register` 写入。`delivery_state` **无 CHECK 约束** ⇒ 仅扩 TS 联合类型、无需迁移。
- **PII 纪律**：审计文案不含完整号码（含「推送未送达者已短信降级 N 名」）；`sendSms` 失败日志脱敏 `138****8000`；**有测试守护"降级后快照仍为空串"**。
- **配置**：`ALIYUN_SMS_ACCESS_KEY_ID` / `_SECRET` / `_SIGN_NAME` / `_TEMPLATE_CODE` / `_REGION`（默认 `cn-hangzhou`）。**任一为空即功能关闭**（dev/test 静默，行为与改动前完全一致）。
- **验证（两轮突变）**：第 1 轮独立 QA：15 处突变 + 7 项对抗点 → **源码 0 缺陷**（10 RED，5 处"看似覆盖实则未验证"的缺口）；修复后第 2 轮由**主理人**定向重放 **R1–R6 全 RED**：逐人门 / `users.phone` 优先 / 快照为空 / 注册落 `phone` / `delivery_state` 置顶 / `.sort()` 钉住。
  - 过程备注：R4 首次突变**无效**（写入的 `device.custodian_phone` 在该用例中恰为空 ⇒ 等于仍写空串，假 GREEN）；改用**字面非零号码**后精确变红 —— **突变的取值必须真的改变行为**，否则 GREEN 无意义。
  - 复核另纠正：工程师"前端 grep 0 命中"表述不准（`deliveryState` 是既有字段），实质结论成立（新值**不泄漏到 UI**）；`npm test` 输出中的 `skipped` 是**迁移器日志**（`[DB] Migration skipped`），**非**测试 skip。
- **待办**：① 模板变量现用 `{device, address}`，**报备通过后按真实模板变量名对齐**（只改一处）；② `AED 短信/电话降级` 的**语音部分已完成**（见下节）；③ 阿里云企业实名 + 签名/模板/TTS 报备（1–2 工作日）。

## ✅ AED 语音降级（已完成；真机联调待凭证）

- **触发（用户拍板）**：**阿里云短信状态报告回调** —— 短信**真实未送达**时才呼语音。
- commit：`e131f72`（功能落地，16 文件 +1006/−68）→ `db56f4e`（**日上限 TOCTOU 原子化** + 补 5 处覆盖，7 文件 +211/−19）。后端 256 → **291 passed**、`type-check` 0 错、CI/CD/pages success。**零新增依赖、无定时器**。
- **前提核实（我给的 4 条契约假设全错，工程师附官方出处顶回 —— 这次拦截避免了第一版必然返工）**：
  1. 状态报告报文是 **JSON Array**（单次可含多条），**非单对象**；
  2. 字段**两套形态须容错**：国内 `success`(Boolean)/`err_code`/`biz_id`；国际&HTTP批量推送模式 `Status`("1"成功 /"2"失败 /"6"失效)/`MessageId`；
  3. 响应体有**硬要求**：**HTTP 200 且 `{"code":<数字>}`**，否则阿里云**重推**（1/5/10 分钟，最多 3 次）；
  4. 语音主叫号 `CalledShowNumber` **可选** —— 公共模式从号码池调度、**无需购买号码**；专属模式才须用已购号且 TTS 模板的外呼模式须匹配。
  - 出处：`help.aliyun.com/zh/document_detail/101509.html`、`help.aliyun.com/document_detail/2866259.html`、`.../101867.htm`、`.../101641.htm`、`api.aliyun.com/document/Dyvmsapi/2017-05-25/SingleCallByTts`、`help.aliyun.com/document_detail/3000795.html`
- **端到端链路**：`notify-custodian` 短信成功 → 取 `BizId` 落 `aed_sms_dispatches`（**只存 `biz_id`/`alert_id`/`custodian_user_id`，无 PII**）→ 阿里云推状态报告 → 回调端点按 `biz_id` 对账 → **仅 FAIL** 才呼语音。
- **安全**：端点 `POST /api/public/aliyun-sms-report`；密钥经**请求头** + `timingSafeEqual`（**含长度守卫** —— 实测 7 种长度密钥全 404、响应体逐字节一致、不崩）；**密钥未配置 → 404**（不暴露端点存在）；限流 60/min；**回调 payload 里的号码一律不采信**（仅作脱敏日志），拨号号码**只从库里按 `custodian_user_id` 重新解析**。
- **幂等与成本护栏**：`voice_state` 落库即「**每行最多呼 1 次**」；**全局日上限**（`app_meta` 键 `voice_daily_YYYY-MM-DD`，默认 200、env 可覆盖）—— 名额**原子预留**（读+判+自增收进**同一同步事务**、在 `await` **之前**），按「**发起次数**」计、失败**不回收**；单请求最多处理 100 条。
- **响应契约（主理人定的口径）**：已处理完（含未知 `biz_id` / 非 FAIL / 重复推送）→ **200 + `{"code":0,"msg":"接收成功"}`**；**仅真正内部异常 → 500**（让阿里云重推，幂等兜底），且 500 体**不含内部错误串**。
- **零新增依赖**：签名抽到 `services/aliyunRpc.ts`，短信与语音**共用**；`resolveCustodianPhone` 抽到 `services/custodianPhone.ts` 两处同口径。
- **验证（两轮突变）**：第 1 轮独立 QA **17 突变 + 9 对抗点** → 主干 PASS（含"我点名的 `timingSafeEqual` 长度陷阱**代码已有守卫**"），**判定需返工（低危）**：① 日上限 **TOCTOU 竞态**（`LIMIT=1` 并发 3 条**实呼 3 次**）——**由我的设计口径（呼叫后自增）诱发**；② 5 处覆盖缺口（500 分支零覆盖、真实 `sendSms→bizId` 未验、限流无覆盖、100 上限无覆盖、voice 无 golden）。修复后**第 2 轮由主理人定向重放 R-a~R-f 全 RED**：预留移回 `await` → 日上限+M9 **双红**；`500→200` → 红；`aliyunRpc` 去 `.sort()` → **sms 3 + voice 1 同时红**；不返 `bizId` → 端到端红；上限 `100→10000` → 红；限流 `force` 被忽略 → 红。
- **遗留**：① **未真机联调**（无凭证）—— 签名/参数按官方文档实现 + 确定性单测覆盖，需真实凭证做端到端验证；② 短信模板变量与 **TTS 模板**报备对齐；③ 语音 `RegionId` 现**复用 `ALIYUN_SMS_REGION`**（真机若报地域错，改一行）。
- ⚠️ **环境陷阱（已写入技能）**：跑本仓库测试**不要前置 `/opt/homebrew/bin`/`/usr/local/bin`** —— `/usr/local/bin/node` 是 **v23**，而 `better_sqlite3.node` 为 **Node 22** 编译 ⇒ ABI 不匹配 ⇒ 全部 suite 加载失败，输出 `Test Files N failed` + `Tests no tests`（exit 1）。用裸 `DB_PATH=':memory:' npm test`（默认即受管 v22.22.2，与 CI 的 node 22 一致）。

## ✅ 上线前全栈演练（已完成 2026-09-12）

**动机**：本轮后端改动很大（**迁移 037/038/039** + 新增公开回调端点 + 短信/语音链路），而**全部单测都跑在 `:memory:` 上** —— canonical 建表已含全部列 ⇒ **加列类迁移在测试里一律被 skipped，真实升级路径从未在实机跑过**。这正是"上线前充分测试"最该补的洞。

**四层实机验证（全部通过）**
| 层 | 方法 | 结果 |
|---|---|---|
| ① 持久库升级路径（直连） | 复制真实库到 `/tmp`（**不碰原库**）→ 剥离 037/038/039 的产物与记录构造"旧库" → **真实服务**对其启动 | 日志 `Migration applied: 037/038/039`（**applied，非 skipped**）；`/api/health` **200**；`users.phone` 经 **ALTER 补上**、`app_meta` 与 `aed_sms_dispatches`+`idx_sms_dispatches_biz` 建出、三条迁移入账 |
| ② 公开回调端点 | 真实运行 app，逐场景打 `POST /api/public/aliyun-sms-report` | 未配置/不带/错密钥 → **404**；**长度不同的错密钥 → 404**（长度守卫实机生效、未 500）；正确密钥 → **200 `{"code":0,"msg":"接收成功"}`**（阿里云要求的契约）；**零呼叫** |
| ③ 真实配置下限流 | 连打 **62** 次 | **60× 200 + 2× 429**，第 61 次 `请求过于频繁`（测试模式豁免过限流，此为**真实挂载首次确认**）|
| ④ 整栈 + 冒烟 | `colima start` → `docker compose -f docker-compose.local.yml --env-file .env.local up -d --build`（**重建**镜像）→ `node scripts/smoke.mjs` | `server`/`web` 均 **Healthy**；**容器内 server 对 compose volume 持久库同样 applied 037/038/039**（真实部署产物上的第二次独立确认）；经 Caddy 8443 `/api/health` **200**、新端点 **404 且返回 JSON 非 SPA HTML**（路由未被前端 fallback 吞）；**冒烟 13 passed / 0 failed** |

**结论**：后端本轮全部改动在实机侧**已无未验证项**。唯一仍缺的是**真实阿里云凭证下的联调**（照 `docs/DEPLOY.md §11` 七项清单）。
本机栈保持运行（`https://localhost:8443`）；停止：`docker compose -f docker-compose.local.yml --env-file .env.local down`。

## ✅ 上线前审计：环境变量一致性 + 依赖漏洞（已完成 2026-09-12）

**1) 环境变量一致性** —— 代码读 **18** 个 `process.env.*`，`.env.example` 只覆盖 15 ⇒ 补上遗漏的 **`GOV_TOKEN_TTL`**（政府令牌有效期，默认 `12h`）与 **`ALIYUN_VOICE_DAILY_LIMIT`**（语音成本护栏日上限，默认 `200`）。两个 compose（local/prod）均用 `env_file` **整份透传** ⇒ 不存在"漏变量传不进容器"。

**2) ⚠️ `npm audit` 在本仓库**不能**直接用**：淘宝镜像 `npmmirror.com` 未实现 audit 接口（`/-/npm/v1/security/* not implemented yet`）⇒ 必须 `npm audit --registry=https://registry.npmjs.org/`。**CI 若要加依赖扫描必须单独指定官方源。**

**3) 后端生产依赖：5 个漏洞 → `found 0 vulnerabilities`**
| 包 | 原 → 新 | 说明 |
|---|---|---|
| **`multer`** | 2.1.1 → **2.3.0** | **high，且真实可达** —— 直连且用于 `routes/video.ts` + `routes/media-alert.ts` 上传端点（登录后可触达）：嵌套/超大数组下标字段名 DoS |
| **`ip-address`** | 10.2.0 → **10.7.0** | **high**，由 `express-rate-limit` 引入（信任边界绕过） |
| `express-rate-limit` | 8.5.2 → **8.7.0** | 直连升级（带上 `ip-address`） |
| `body-parser` | 1.20.5 → **1.20.8** | moderate |
| `qs` | 6.15.1 → **6.16.0** | moderate（`req.query` 解析 DoS）。**`express@4.22.2` 把 `qs` 钉在 `~6.15.1` 且已是最新 4.x ⇒ 正常升级路径拿不到补丁** → 采用 **`overrides: { "qs": "^6.16.0" }`**（**同主版本补丁级**，与当初被否的 vue **跨主版本**强推不同；若不接受该 overrides，删掉一行即回到"待 express 自升 qs"） |

lockfile **仍为纯镜像 346 条**（用镜像源升级，**未写入混源 URL**）。验证：门禁 **291 passed + type-check 0**；**容器重建走 `npm ci` 通过**、容器内实际版本为新版、**冒烟 13/13**。

**4) 前端 49 个漏洞 —— 判定为构建期/供应链，运行时暴露为零 ⇒ 不修**
分布 22 low / 15 moderate / 12 high / **0 critical**，几乎全在 uni-app 多端与 CLI 包（`@dcloudio/uni-mp-*`、`@dcloudio/uni-cli-shared`、`jimp`、`ws`）。**证据（非推测）**：`src/` 对 `vue-i18n` / `@intlify` / `@dcloudio/uni-mp*` / `uni-app-harmony` / `uni-quickapp` / `jimp` 的**引用数全为 0**；`package.json` 中 16 个 `@dcloudio/*` 是 uni-app 多端模板的固有声明，而**只构建 H5** ⇒ 不可能进 H5 产物。**不做 `npm audit fix --force`**（会破坏 uni-app 版本对齐，与 vue/pinia 同类陷阱）。
