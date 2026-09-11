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
| `cases.fetchCases` / `fetchCaseByIdApi` | `GET /api/cases/list`、`/api/cases/:id` | ⚠️ 结构不匹配：无 timeline/heroes/duration → 安全默认（heroes←volunteers）；**`newsId` 已接通**（可空）|
| `learn.fetchLessons` | `GET /api/learn/courses` | ⚠️ 结构不匹配：后端 id 为字符串→序号；无 students→0 |
| `learn.fetchTrainings` | （无端点）| ➖ **有意保留为前端本地配置**（导航路由表，非服务端数据）|
| `learn.updateProgress` | `POST /api/learn/progress` | ✅ 接通 |
| `media-alert.uploadMedia` | `POST /api/media-alert/upload` | ✅ 接通（后端二进制落盘 `public/uploads/media` + 类型/大小白名单，返回可访问 URL）|
| `news.fetchNewsList` | `GET /api/news/list` | ⚠️ 结构不匹配：无 excerpt/coverImage/stats/featured/caseId → 派生/置 0 |
| `news.fetchNewsByCategory` | `GET /api/news/category/:cat` | ✅ 接通（修正：原前端误调 `/news/list?category=`）|
| `news.fetchNewsById` | `GET /api/news/:id` | ⚠️ 同上结构 |
| `records.fetchRecords` | `GET /api/records/list` | ⚠️ 结构不匹配：无 duration/timeline；squad 由 string[] 派生对象数组 |
| `records.fetchRecordById` | `GET /api/records/:id` | ✅ 接通（后端已补齐该端点）|
| `task.fetchActiveTask` / `fetchTaskList` | `GET /api/task/active`、`/task/list` | ⚠️ 结构不匹配：无 title/description/sceneType → title←address、enRoute 派生 |
| `task.acceptTaskApi` / `completeTaskApi` | `POST /api/task/accept`、`/task/complete` | ✅ 接通 |
| `user.fetchProfile` / `fetchStats` / `awardPointsApi` | `GET /user/profile`、`/user/stats`、`POST /user/points` | ✅ 接通（结构对齐，无需映射）|
| `volunteer.fetchLeaderboard` | `GET /api/volunteer/rankings?type=` | ✅ 接通（后端支持 `points`/`rescue` 真实排序，新增 `position`；`volunteerId` 用后端 id 兜底）|

## 二、未接通 / 阻塞（均未臆造，未改后端接口）

1. `learn` trainings：**有意保留为前端本地配置**（`TRAININGS` 是导航路由表，非服务端业务数据；放后端无业务价值）→ 不新增端点。
2. `records` `/:id`：✅ 已补（`GET /api/records/:id`，结构同列表项；未找到 404 + 语义错误）。
3. `volunteer` 排行榜 `type`：✅ 已补（`points`/`rescue` 真实排序；既有 `rank` 字段语义不变，新增 `position`）。
4. `media-alert`：✅ 已补（multipart 二进制落盘 `public/uploads/media` + 扩展名/大小白名单，返回 `/uploads/media/<file>`）。
5. 案例↔新闻互链：✅ 已加**可空** `news_id`（迁移 `031_add_case_news_link`）并在 cases 端点暴露 `newsId`；**既有数据无可可靠推导来源，故保持 NULL**（前端在无值时降级为无互链）。

## 三、空值防护约定（CI 修复 `42aa9a6`）

- 单例取数（`cases/:id`、`news/:id`、`aed/:id` 经 `mapApiDeviceToView`）：后端返回 `null` 时**抛语义明确的 `Error`**，不泄漏 `TypeError`。
- 数组取数（`fetchXList`）：`(raw || [])` → 空响应得空数组。
- store 侧：失败**显式记 `error` 并抛出**，不做静默 mock 兜底。
