# 急救侠 · 项目工具脚本

## 依赖树守卫 `急救侠-uniapp/scripts/check-vue-singleton.mjs`

断言「安装后的依赖树中**恰好一份 Vue**」。CI 在 `npm ci` 之后运行（`npm run check:vue-singleton`）。

| 项 | 说明 |
|------|------|
| 为什么需要 | uni-app 精确锁 `vue@3.4.21`，pinia（2.2+ / 3.x / 4.x）的 peer 要求 `vue@^3.5.11` —— **同一份 Vue 不可兼得**。`.npmrc` 的 `legacy-peer-deps=true` 把 Vue 压平成唯一一份 3.4.21 |
| 拦下的失败 | 一旦移除该标志并**重新生成 lock**，`npm ci` 会**绿着**装出「根 `vue@3.5.42` + 嵌套 `vue@3.4.21`」的分裂树 → 应用与 uni-app 运行时各一套 Vue，响应式 / provide-inject / `app.use(pinia)` 静默错配 |
| 输出 | 通过：`✓ 依赖树中恰好一份 Vue：<版本>`（exit 0）；分裂/缺失：列出全部副本 + 修复指引（exit 1） |

用法：`cd 急救侠-uniapp && npm run check:vue-singleton`（需先安装依赖）

## 端到端冒烟脚本 `scripts/smoke.mjs`

上线前 / 每次部署后的一键冒烟，把手工端到端验证固化成可重复的一条命令。

| 项 | 说明 |
|------|------|
| 脚本 | `scripts/smoke.mjs`（Node ESM，**仅用 Node 内置模块**，零安装即可运行） |
| 断言 | 13 项：SPA 首页 + 4 个 `/assets` 静态资源、`/api/health`、注册/登录/`/api/auth/me`、无令牌 401 与错口令负例、令牌隔离（`/api/gov/dashboard` 401）、角色授权（`/api/gov/viewers` 403）、CORS 白名单、请求体上限 413、helmet 安全响应头 |
| 输出 | 每条断言一行 `PASS`/`FAIL`，结尾 `N passed, M failed` 与耗时；**全绿 exit 0，任一失败 exit 1** |

用法：

```bash
node scripts/smoke.mjs                          # 默认打本机 https://localhost:8443
node scripts/smoke.mjs --base https://<域名>    # 生产
node scripts/smoke.mjs --phone 13900000001 --password test1234   # 换测试号
node scripts/smoke.mjs --verbose                # 打印每个请求的 method/url/status
node scripts/smoke.mjs --help                   # 查看全部选项
```

说明：

- `--insecure`：跳过 TLS 校验；当 `--base` 主机为 `localhost`/`127.0.0.1` 时**自动开启**（自签证书）。
- **幂等**：固定测试号 + 固定口令；注册返回「该手机号已注册」视为通过并继续登录，不会反复新增用户。
- 依赖被测栈已启动（本机见 `docs/DEPLOY.md` §9）；连不上服务会逐条 `FAIL` 且退出码 1。
- `/api/auth/*` 有限流（15 分钟 20 次），一次冒烟消耗 **5** 次（CORS 与 413 两条已改打无限流的 `/api/health`）→ **连跑上限约 4 轮**；命中限流时汇总首行会显式标注「本轮含 N 处 429」，不代表真实回归，等窗口重置后重跑即可。

## 急救侠-server 运维 CLI

后端 `急救侠-server/package.json` 中的运维命令（均为 `tsx` 直跑，**零新增依赖**）。

| 命令 | 脚本 | 作用 |
|------|------|------|
| `npm run admin:narrow` | `src/scripts/narrow-platform-admins.ts` | **平台管理员收窄**：`--list` 查看候选 / `--downgrade <ids>` 降级（`--force` 才允许清零）。用于把历史「隐式赋权」收窄为显式白名单（详见 `docs/DEPLOY.md` §10） |
| `npm run aliyun:keepalive` | `src/scripts/aliyun-keepalive.ts` | **阿里云签名保活巡检**：`--status` 打印最近发送/距今/剩余/等级（可用退出码接 cron/CI）；`--send-test <手机号>` 发一条保活测试短信并记时间戳（`--days N` 覆盖阈值）。详见 `docs/DEPLOY.md` §12 |

用法（在 `急救侠-server/` 下）：

```bash
npm run admin:narrow -- --list
npm run admin:narrow -- --downgrade 3,7
npm run aliyun:keepalive -- --status
npm run aliyun:keepalive -- --send-test 13900000000
npm run aliyun:keepalive -- --help
```

说明：

- **阿里云签名保活**：阿里云规定签名**超 6 个月无发送记录即失效**（见 `deliverables/software-company/aliyun-approval.md` §8.6）。`--status` 退出码：`0`=ok/warn、`1`=action_due、`2`=overdue/never_sent；`--send-test` 退出码：`0`=受理、`2`=用法错误/短信未配置/号码非法、`1`=发送失败。**输出绝不含完整手机号**（`maskPhone` 脱敏），**短信未配置时明确报错并非零退出**（绝不静默）。
- **平台管理员收窄**：收窄完成后写入 `app_meta.platform_admin_narrowing_done` 标记，使 `backfillPlatformAdmins()` 不再反向回填。

## HTML / CSS 校验脚本

下列 Python/JS 脚本用于校验静态 HTML 演示文件 `急救侠_H5_Demo_v17.html`：

| 脚本 | 作用 |
|------|------|
| `check_html.py` | 基础 HTML 解析验证（使用 `HTMLParser`） |
| `check_all_tags.py` | 检查 HTML 标签完整性 |
| `check_tags.py` | HTML 标签校验 |
| `check_tags2.py` | HTML 标签校验（补充规则） |
| `check_html_comments.py` | 检查 HTML 注释格式 |
| `check_divs.py` | 检查 `<div>` 嵌套结构 |
| `check_css.py` | 校验页面 CSS 声明 |
| `check_parens.py` | 检查 JavaScript 括号匹配 |
| `parse_css_rules.js` | 解析 CSS 规则的工具 |

用法：`python3 check_*.py` 或 `node parse_css_rules.js`

## 其他文件

| 文件 | 说明 |
|------|------|
| `急救侠_分享页.html` | 微信/社交分享落地页 |
| `分享页使用说明.md` | 分享页的使用说明文档 |
| `LOGO_DESIGN_SUMMARY.md` | 急救侠 Logo 设计总结 |
| `LOGO_IMPLEMENTATION.md` | Logo 实现技术说明 |
| `急救侠_logo_lifespark.svg` | 生命火花 Logo SVG 源文件 |
