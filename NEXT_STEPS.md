# 急救侠 · 下一步路线图（NEXT STEPS）

> 评估日期：2026-09-10
> 评估范围：`急救侠-server`（Express + SQLite 后端）、`急救侠-uniapp`（uni-app 多端前端）、CI、部署工程
> 评估方式：本地实跑测试 / 类型检查 / 依赖体检 / 代码走查

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
