# Task: Write Comprehensive Test Suites (97% Coverage)

对 急救侠 项目写完整的测试套件，覆盖率达到 97%+. 后端和前端的测试都需要写。

## 1. 后端测试 (急救侠-server)

**安装测试依赖:**
```bash
cd ~/Documents/Projects/Urgent/急救侠-server
npm install -D vitest supertest @types/supertest
```

**测试配置:** `vitest.config.ts` — 使用 node 环境, 内存 SQLite 数据库

**需覆盖的测试:**

### Database (db.ts)
- 数据库初始化正常创建表
- 在内存数据库中创建所有表
- 种子数据插入

### Auth Routes (/api/auth)
- POST /api/auth/register — 正常注册、重复注册、无效数据
- POST /api/auth/login — 正常登录、错误密码、不存在用户
- 返回 JWT token

### User Routes (/api/user)
- GET /api/user/profile — 需认证、返回正确的用户信息
- PUT /api/user/profile — 更新用户信息
- 缺少 token 返回 401

### Task Routes (/api/task)
- CRUD 全操作
- 列表、详情、创建、更新、删除
- 分页、筛选

### AED Routes (/api/aed)
- 列表、详情、搜索
- 附近设备查询（地理坐标）

### News Routes (/api/news)
- 列表、详情
- 分页

### Learn Routes (/api/learn)
- 知识库内容、培训课程
- 分类筛选

### Volunteer Routes (/api/volunteer)
- 排行榜（积分、救援次数）
- 志愿者详情

### Records Routes (/api/records)
- 救援历史记录
- 时间线

### Cases Routes (/api/cases)
- 案例列表、详情
- 新闻关联案例

### Atlas Routes (/api/atlas)
- 急救图谱数据

### Media Alert Routes (/api/media-alert)
- 媒体报警上传流程状态机
- 上传、进度查询、重试

### Push Routes (/api/push)
- 推送订阅

### Health Check
- GET /api/health 返回正确状态

## 2. 前端测试 (急救侠-uniapp)

**安装测试依赖:**
```bash
cd ~/Documents/Projects/Urgent/急救侠-uniapp
npm install -D vitest @vue/test-utils happy-dom
```

**测试配置:** `vitest.config.ts` — 使用 happy-dom 环境

**需覆盖的测试:**

### Stores (Pinia)
每个 store 需要测试:
- 初始状态正确
- getters 计算正确
- actions 正确修改状态
- API 调用成功/失败场景

Stores: auth, user, aed, atlas, cases, learn, media-alert, news, records, task, volunteer

### API Clients
测试每个 API 模块:
- 正确构建请求 URL
- 正确处理响应
- 错误处理

### Utility Functions
- utils/location.ts — 位置获取
- utils/subscribe.ts — 消息订阅
- utils/audio.ts — 音频播放
- utils/voice.ts — 语音功能

### Components
- BottomSheet — 打开/关闭、内容渲染
- LifeSparkLogo — 动画
- Metronome — 节奏器功能
- MissionBanner — 任务横幅
- SosButton — SOS 按钮状态
- StepTimer — 计时器
- VoiceManager — 语音管理

## 要求

1. 使用 vitest (不是 jest)
2. 后端使用 `supertest` 做 HTTP 集成测试
3. 前端使用 `@vue/test-utils` 做组件测试
4. 每个路由/store 的 success 和 error 路径都要测
5. 提交 commit `feat: add comprehensive test suites with 97%+ coverage`
6. 每个测试文件放在 `__tests__/` 目录下或与被测文件同级

开始干。
