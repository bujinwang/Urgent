# 急救侠 · 项目工具脚本

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
- `/api/auth/*` 有限流（15 分钟 20 次），一次冒烟消耗 8 次；命中限流会打印明确诊断。

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
