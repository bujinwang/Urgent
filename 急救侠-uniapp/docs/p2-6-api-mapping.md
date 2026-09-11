# P2-6 前端去 mock → 真实后端接口 · 映射表

> 对应任务：P2-6（`急救侠-uniapp/src/api/**` 由 mock 兜底切换为真实后端请求）
> 范围提交：`a0706f0..42aa9a6`（含 CI 修复） | 说明：本文即代码注释中「见交付映射表」所指文件。

## 一、逐模块映射（前端函数 → 后端 method + path → 状态）

| 前端模块.函数 | 后端端点 | 状态 |
|---|---|---|
| `aed.fetchAedList` | `GET /api/aed/nearby` | ✅ 接通（`mapApiDeviceToView` 补齐 photo/discovered/verified）|
| `aed.fetchAedById` | `GET /api/aed/:id` | ✅ 接通 |
| `aed.createAedPickup` | `POST /api/aed/:id/pickups` | ✅ 接通 |
| `atlas.fetchAtlasCards` | `GET /api/atlas/cards` | ✅ 接通（`description→desc`、`num←序号`、`featured←cpr`、`route←UI 配置表`）|
| `cases.fetchCases` / `fetchCaseByIdApi` | `GET /api/cases/list`、`/api/cases/:id` | ⚠️ 结构不匹配：后端无 timeline/heroes/duration/newsId → 安全默认（heroes←volunteers）|
| `learn.fetchLessons` | `GET /api/learn/courses` | ⚠️ 结构不匹配：后端 id 为字符串→序号；无 students→0 |
| `learn.fetchTrainings` | —（无端点）| ❌ 后端端点缺失 |
| `learn.updateProgress` | `POST /api/learn/progress` | ✅ 接通 |
| `media-alert.uploadMedia` | `POST /api/media-alert/upload` | ⚠️ 已接真实 multipart 上传；后端仅记元数据、未持久化二进制 |
| `news.fetchNewsList` | `GET /api/news/list` | ⚠️ 结构不匹配：无 excerpt/coverImage/stats/featured/caseId → 派生/置 0 |
| `news.fetchNewsByCategory` | `GET /api/news/category/:cat` | ✅ 接通（修正：原前端误调 `/news/list?category=`）|
| `news.fetchNewsById` | `GET /api/news/:id` | ⚠️ 同上结构 |
| `records.fetchRecords` | `GET /api/records/list` | ⚠️ 结构不匹配：无 duration/timeline；squad 由 string[] 派生对象数组 |
| `records.fetchRecordById` | —（无 `/:id`）| ⚠️ 端点缺失 → 列表 + 客户端筛选 |
| `task.fetchActiveTask` / `fetchTaskList` | `GET /api/task/active`、`/task/list` | ⚠️ 结构不匹配：无 title/description/sceneType → title←address、enRoute 派生 |
| `task.acceptTaskApi` / `completeTaskApi` | `POST /api/task/accept`、`/task/complete` | ✅ 接通 |
| `user.fetchProfile` / `fetchStats` / `awardPointsApi` | `GET /user/profile`、`/user/stats`、`POST /user/points` | ✅ 接通（结构对齐，无需映射）|
| `volunteer.fetchLeaderboard` | `GET /api/volunteer/rankings?type=` | ⚠️ 接通但后端不支持 `type` 维度（两榜同数据）；无 volunteerId → 用后端 id 兜底 |

## 二、未接通 / 阻塞（均未臆造，未改后端接口）

1. `learn` trainings：后端无 `/learn/trainings` → 保留前端 `TRAININGS`（纯本地路由配置）。
2. `records` `/:id`：后端无端点 → 列表接口 + 客户端筛选。
3. `volunteer` 排行榜 `type` 排序：后端 rankings 不支持 → 功能降级。
4. `media-alert`：后端只记元数据，文件不持久化。
5. 案例↔新闻互链：后端无 `newsId`/`caseId` → 互跳失效。

## 三、空值防护约定（CI 修复 `42aa9a6`）

- 单例取数（`cases/:id`、`news/:id`、`aed/:id` 经 `mapApiDeviceToView`）：后端返回 `null` 时**抛语义明确的 `Error`**，不泄漏 `TypeError`。
- 数组取数（`fetchXList`）：`(raw || [])` → 空响应得空数组。
- store 侧：失败**显式记 `error` 并抛出**，不做静默 mock 兜底。
