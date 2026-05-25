# 急救侠 · 项目工具脚本

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
