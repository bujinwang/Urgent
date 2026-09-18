# 急救侠 · 志愿者响应（F4）交付总结

> 范围：服务时长「台账 → 归因 → 我的时长 → 证明 → 机构/政府聚合 → 反悔」端到端写链路
> 撰写日期：2026-09-18
> 关联文档：`volunteer-service-hours-prd.md`、`volunteer-service-hours-design.md`（`deliverables/software-company/`）

---

## TL;DR

F4 从**零**建立了「志愿者响应」的端到端写链路，并把服务时长做成**口径正确、不可刷、可开证明**的体系。
后端门禁 **52 文件 / 487 用例**、前端 **58 文件 / 456 用例**，两端 **`tsc`/`vue-tsc` 0 error**，乱序 3 种子一致，0 `Errors`。
独立验证 **5 轮 QA + 3 轮后续质量补齐**，含反事实夹具与突变验证。

---

## 一、交付概览

| 项 | 结果 |
|---|---|
| 任务 | T01–T06 + T41/T42 **全部完成** |
| 后续质量补齐 | 覆盖缺口（7 前端 + 2 后端）、静默加载失败、验真失败分流 **全部落地** |
| 后端门禁 | 52 文件 / **487 用例**（起点 44/416） |
| 前端门禁 | 58 文件 / **456 用例**（起点 51/385） |
| 类型检查 | 后端 `tsc` 0 · 前端 `vue-tsc` 0 |
| 稳定性 | 乱序 3 种子一致；0 `Errors`；本地 flaky 已定性（CI 不会发生） |
| 独立验证 | 5 轮对抗性 QA + 3 轮质量补齐，含突变（mutation）验证 |
| 已知问题（非阻塞） | 0（全部修复或升级为待办） |

> 注：提交链见文末「提交清单」。门禁数字以最终实测为准（summary 中曾误记后端基线为 470，实际 474，已纠正）。

---

## 二、四件真正修掉的事（F4 核心）

| # | 维度 | 修复前 | 修复后 |
|---|---|---|---|
| 1 | **归因** | `acceptTaskApi` 有定义有测试、**生产零调用** ⇒ 可归因率恒为 0 | 接线 + 调用点守卫（删调用 ⇒ 对应用例精确红） |
| 2 | **时长口径** | 报名→结束（含赶路；且「到达即结束」⇒ 救人反而不计） | **到达→离开**（更贴近「实际服务」定义） |
| 3 | **闭合范围** | 任何一人的动作给**全任务所有人**结算时长 | **按人闭合**（谁的动作结算谁） |
| 4 | **放弃/拒绝** | 照样入账 ⇒ **可反复刷时长** | 不计入 + 作废留痕（审计可追） |

辅助口径澄清（设计稿 v1.5/v1.6 已登记）：
- 「跨机构」的两个维度区分：**调用者权限** vs **数据范围**
- 政府口径：**跨机构不翻倍**（按机构相加得到任务总时长，而非按行求和）
- 零时长 `null` 判据：以「**有无台账行**」为准，而非 `totalMinutes<=0`

---

## 三、后续质量补齐（QA 驱动，3 轮）

### 轮 1 · 覆盖缺口补齐（QA 列出的 7 前端 + 2 后端）
- 前端 12 例：撤销调用点 / 打印 / 分页（含两端越界边界）/ 非法区间 / 三个失败反馈 / 已撤销态渲染 / goBack
- 后端 6 例：CLI `service:report` 起**子进程**跑真实 CLI，断言无过滤=3、`--days 30`=2、`--user u2`=1、交集、以及 **`--days 0` ⇒ 退出码 2 + 提示「正数」（绝不静默当成全部）**
- 后端补 PII 值形态扫描：正则初版被 **13 位 epoch 毫秒**命中子串（假阳性），已加数字边界 `(?<!\d)1[3-9]\d{9}(?!\d)`
- **5 条突变全部精确红**（非法区间守卫 / 生成失败 toast / 撤销调用 / 分页下界 / CLI `--days` 生效）
- 关键坑（已记）：user store 首次创建**异步** refresh profile，而 `onMounted` 同步 ⇒ 须先建 store + flush 再 mount

### 轮 2 · 静默加载失败（工程师多报的真实缺陷）
- `hours.vue:127-129` 原 `loadHours().catch(() => {})` ⇒ 加载失败落**空态「暂无服务记录」**，用户会以为时长丢失
- 修复：`store.error` 非空 ⇒ **可区分失败态**（本地化文案 + 重试，隐藏内容区，不回显后端原文）
- `certificates.vue` **有同类模式，已一并修但用本页局部 `loadError`**（理由见下）
- **关键区分**：`serviceCert.store.error` 被 `createCertificate/revokeCertificate/verify` 失败也写入 ⇒ 若共用当「加载失败」信号，一次「撤销失败」会把整页换成失败态（动作失败 ≠ 加载失败）。故 certificates 用局部 `loadError`，并加用例断言「撤销失败时**不**变失败态、列表仍在」
- **3 条突变精确红**：失败态分支、`失败文案==空态文案`、重试调用点

### 轮 3 · 验真失败分流（更底层的发现）
- 前端**原本无法区分**：`requestFull` 丢弃 HTTP status ⇒ 404（编号不存在）与网络错误都只表现 `{code:-1, message}`
- 最小改动：`FullResponse` 加**可选** `statusCode` 并透传（未重构 `request`）；`serviceHours` 错误带 `code/statusCode`
- 页面：`statusCode===404` ⇒ 「未找到」；否则 ⇒ 「验真失败，请稍后重试」
- **2 条突变精确红**（合并文案、去掉 statusCode 透传）；退化方向安全（后端改码会退化成「验真失败」，不会误报「不存在」）
- api 契约守卫用 `vi.unmock('@/api/index')` 还原**真实** `requestFull`

---

## 四、结构性洞察（已固化为团队纪律）

**守卫会「各盲其盲」。** F4 期一个「原生标题未本地化」的缺陷让**四层守卫同时失明**：
1. 源码扫描（裸 CJK / 静态 key）**只扫 `.vue`**，不扫 `pages.json`
2. en 渲染快照**不渲染原生 chrome**（标题栏由宿主绘制）
3. nav-title **调用点**守卫**硬编码只枚举 3 页**
4. `nav` 键集断言「恰好等于 3 页」⇒ 新页不接它依然成立

由此立两条纪律（已写入验证手册 `jiujiaxia-verify-playbook`）：
- **给新守卫做「探针突变」**：证明它抓到的是别的层抓不到的（工程师轮 1 的探针：往 `SCOPE_FILES` 加一个「已本地化未接线」页 ⇒ 第⑤层红、③仍绿，正是补位证据）
- **枚举型守卫自动跟随事实源**：硬编码清单是失明的直接原因（nav-title 守卫 ③ 已改由 `NAV_PAGES` 派生）

---

## 五、待业务侧定稿（不阻塞工程）

1. **验真失败中英文案**（工程已用中性准确表述落地，措辞请确认）：

   | 场景 | 中文 | 英文 |
   |---|---|---|
   | 真 404（编号不存在） | 未找到该编号对应的证明 | No certificate found for this number |
   | 网络/其它失败（本次新写） | **验真失败，请稍后重试** | Verification failed, please try again later |
   | 已作废（既有） | 该证明已作废 | This certificate has been revoked |
   | 有效（既有） | 证明有效 | Certificate is valid |

2. **建议书 §10 措辞对齐**：F4「符合国家标准 / 官方证明」+ F3「实名 / 自动删除」需与现实现对齐（对外提交文件）

3. **D-7**：政府侧要求机构汇总「不重复」⇒ 须先给台账写入 `org_id`（P1 / 另立）

---

## 六、已知既有问题（已记账，不在 F4 范围）

- `user.profile` **类型谎言**：`fetchProfile` 声称非空、运行时可能返回 `null`，全仓裸访问含模板
- 32 处 `body.userId` 身份弱点
- `/api/rescue/team` **无鉴权**
- `mobilization_volunteers.status` 死列
- 本地测试 flaky（新增测试文件 ⇒ `app.listen(0)` 端口抢答概率上升，已定性，CI 不会发生）

---

## 七、文件清单（主要变更）

### 前端 `急救侠-uniapp/src`
- `pages/volunteer/hours.vue` —— 我的服务时长页（加载失败态、重试、`store.error` 驱动）
- `pages/volunteer/certificates.vue` —— 我的服务证明页（局部 `loadError`、验真分流、游客入口）
- `stores/serviceHours.ts`、`api/serviceHours.ts` —— 契约层（错误带 `code/statusCode`）
- `api/index.ts` —— `FullResponse` 增**可选** `statusCode` 并透传
- `pages.json` —— 两新页 `navigationBarTitleText` 保留中文（首屏默认，与既有 3 页同约定）
- `locales/*` —— 新增 `nav.hours` / `nav.serviceCert` / `serviceCert.loadFailed`（zh 与 pages.json 逐字一致，en 由实现方拟定）
- `__tests__/pages/volunteer-t04-qa.test.ts`（QA，21 例，含 KNOWN-BUG→FIXED 反转）
- `__tests__/pages/volunteer-interactions.test.ts`（12 例，覆盖缺口）
- `__tests__/nav-title-locale.test.ts`（守卫 ③④⑤，含 `pages.json×接入`一致性层）
- `__tests__/api/serviceHours.test.ts`（api 契约，真实 `requestFull`）
- `rescue-i18n.test.ts`（`SCOPE_FILES` 扩围扫描）

### 后端 `急救侠-server/src`
- 服务时长聚合（机构 / 政府，P1-6 / P1-8），含跨机构不翻倍、零时长 `null` 判据
- `service:report` / `service:purge` CLI（T16），`purge` 只碰台账、绝不碰证明（守卫守）
- 迁移实机验证（T16）
- `__tests__/gov-caliber-qa.test.ts`（QA，7 例）、`service-report-cli.test.ts`（6 例，子进程真实 CLI）

> 完整文件级链路见 git 提交链；以上为按职责归类的主要文件。

---

## 八、用户下一步建议

1. **定稿 §五 的文案**（尤其验真失败中英文），回复后我可直接落地
2. **定 D-7 优先级**：若政府侧要求机构汇总不重复，需先排 `org_id` 写入（P1/另立）
3. **降级处理排期**：§六 的 5 个既有问题建议单独开 F 项，不混入后续功能
4. **F1 地图**：高德/腾讯 Key 仍在你手里，是地图功能的前置阻塞
5. **部署验证**：本地 `docker-compose` 起全栈，按 T16 迁移脚本实机跑一遍 `service:report`/`service:purge`

---

## 九、提交清单（F4 终态，倒序）

```
a7824f4 fix(f4-t04): 验真失败分流 —— 真 404「未找到」 vs 网络/其它「验真失败，请稍后重试」
b9e474e feat(f4-t04): requestFull 透出 statusCode + serviceHours 错误带上 code/statusCode
c82f822 test(f4-t04): 加载失败态守卫（可区分 + 重试调用点 + 动作失败不换态）
bbfe96b fix(f4-t04): 两页加载失败不再静默落空态（可区分失败态 + 重试）
a3d0f09 test(f4-t05): 补 --user/--days 过滤真实生效 + gov PII 值形态扫描（后端）
021acdc test(f4-t04): 补 QA 列出的 7 项 volunteter 页交互覆盖（前端）
5d70660 test(f4-t04): 一致性守卫改用 stripComments 判定（防注释假阴性）
01e825a test(f4-t04): 反转 QA 的 KNOWN-BUG —— 两新页原生标题已本地化
c80cdba fix(f4-t04): 两新页接入原生导航栏标题本地化 + 扩两层守卫 + 新增一致性守卫
1ce3728 test(f4-t04,t41,t42): 最终独立验证（QA 产出，判定 Engineer）
58edf4e docs(next-steps): 登记 F4 期顺带发现的既有隐患
145e5dd test(f4-t41,t42): gov 跨机构不翻倍 + 零时长 null 双向守卫
a080cb2 fix(f4-t42): gov serviceHours 的 null 判据改为「有无台账行」
22be0bb test(f4-t04): i18n 守卫扩围 + 页面调用点守卫
b82a551 feat(f4-t04): 我的时长页 + 证明页 + 「我的」入口（前端）
36119e7 docs(f4): 设计 v1.6 —— 聚合口径澄清
dc1a7f4 test(f4-t05): 独立对抗性验证（QA 产出，判定 NoOne）
a5d1985 feat(f4-t03): utils/serviceExport —— CSV 导出
e64ce37 feat(f4-t03): 前端契约层
d82e4ce docs(f4): 设计 v1.5
763b2fc test(f4-t05): purge 只碰台账守卫（D7）
95b83ea feat(f4-t05): CLI + 迁移实机验证（T16）
8990644 feat(f4-t05): 机构/政府服务时长聚合
f0b73f6 test(f4-t06): 独立对抗性验证 —— 反悔路径（QA 产出，判定 NoOne）
```
（更早的 T01–T04 实现方提交略；完整历史 `git log` 可见）
