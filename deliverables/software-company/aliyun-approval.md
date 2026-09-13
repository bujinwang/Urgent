# 阿里云短信 / 语音 · 报备材料（可直接提审的草案）

> ⚠️ **草案，需业务/合规确认后方可提审。**
> 本文件由工程侧依据**仓库现有代码事实** + **阿里云官方文档**整理，供业务/运营拿去控制台逐项填报。
> 文案、签名命名等属**业务/合规决策**，工程侧不替业务拍板；凡本文件标注「**待控制台确认**」的项，均因**无法从本仓库代码或官方文档确证**，请以控制台实际页面为准。

**业务背景（本材料为何存在）**：AED 被取用 → 系统推送该设备责任人 → 责任人未装 App／推送失败 → **降级发短信** → 短信**未送达**（阿里云状态报告回调 `FAIL`）→ 再**降级语音呼叫**。短信/语音需**企业实名 + 签名/模板报备**，是上线关键路径上的**外部审核阻塞**，故**无需真实凭证**即可先行准备并提审。

---

## 1. 前置：必须企业实名（一句话）

**短信服务在 2025 年起的签名实名制报备要求下，仅企业资质可完成报备并发送；个人实名账号的自用资质无法通过报备** —— 请先把阿里云账号升级为**企业实名认证**（或改申请「他用资质」并附企业授权委托书）。

- 依据：<https://help.aliyun.com/zh/document_detail/108044.html>（使用须知：企业认证 vs 个人认证）、<https://help.aliyun.com/zh/document_detail/2539800.html>（短信资质：个人认证用户申请自用资质无法通过签名实名制报备）。
- **待控制台确认**：具体所需材料清单（营业执照、法人证件、业务管理员证件与手机号等）以控制台资质申请页为准。

> ⚠️ **重要预期管理（与「1–2 个工作日」的旧认知不同）**：签名/模板**审核本身**较快（签名工作时间提交最快约 24 小时内、模板约 2–4 小时），但**审核通过后还有一道「运营商实名报备」**（2025 年起新增），**平均 5–7 个工作日，部分 7–10 个工作日，且运营商不承诺时效；报备期间签名不可用**。请按 **≥10 个工作日** 预留上线窗口。
> 依据：<https://developer.aliyun.com/article/1746495>（接入链路：审核/报备时长）、<https://helpcdn.aliyun.com/document_detail/337013.htm>（报备 5–7 工作日，部分 7–10）。

---

## 2. 短信签名

**签名规范（官方，务必先读）**：长度 **2–12 个字**；仅中文/英文/数字，**不支持符号（含空格）**；**不支持中性签名**（如「客服通知」「温馨提示」）；**发送时系统自动加 `【】`**，提审时**只填签名文字、不要自带括号**。
依据：<https://intl.aliyun.com/help/zh/doc-detail/158399.htm>、<https://help.aliyun.com/document_detail/2873145.html>。

### 2.1 ⚠️ 对「急救侠」作为签名的诚实提醒（务必先看）

按**当前**（2025+）签名实名报备政策，**「APP 名 / 公众号小程序名 / 电商店铺名 / 已备案网站名」这几类签名来源已不再支持运营商实名报备**，推荐的来源是老一套之外的两类：**① 企事业单位名（全称或"含地域、唯一、为企业全称子集"的简称）；② 已注册商标名（商标所有方须与该阿里云账号主体一致）**。
依据：<https://help.aliyun.com/document_detail/2873145.html>、<https://help.aliyun.com/zh/sms/product-overview/notice-on-compliance-verification-of-sms-signature>。

因此：

- **若「急救侠」只是 App/产品/网站名称、并非该运营主体的注册商标，也未包含在主体企业名称里 → 直接用「急救侠」作签名，报备大概率不通过。**
- 「急救侠」要能用，二选一：**(a)** 该主体已注册「急救侠」商标且商标所有方=阿里云账号主体；**(b)** 主体企业名称本身含「急救侠」。
- **待控制台确认**：运营主体的**企业全称/简称**、**是否持有「急救侠」商标**（及商标注册证编号）—— 这两者是签名能否过审的决定项，需业务/法务提供。

### 2.2 候选签名（按推荐度）

| # | 候选签名 | 适用场景 | 通过报备的把握 |
|---|---|---|---|
| 首选（合规优先） | **`<企业全称或含地域的简称>`**（如「杭州急救侠科技有限公司」/「杭州急救侠科技」） | 主体自有牌照、追求**稳定过审**；`简称`必须是全称子集、能唯一标识主体、含地域信息 | **最高**（官方"优先推荐"来源） |
| 备选 A（品牌优先） | **`急救侠`** | 已持有「急救侠」**注册商标**（所有方=账号主体），或企业名含「急救侠」 | 取决于商标/企业名（见 §2.1） |
| 备选 B（主体名简写） | **`<企业全称的子集，含地域，如"深圳急救侠"`>** | 希望签名短、又含地域、且确为全称子集的合规简写 | 中—高（简称须严格合规） |

> 说明：**品牌归属证明**通常需提供**营业执照**（自用资质）或**商标注册证 / ICP 备案**（及必要时**授权委托书**，由授权方**法定代表人签字并加盖公章**）。**待控制台确认**：贵司采用哪种签名来源、对应需上传哪些证照。
> 依据：<https://developer.aliyun.com/article/1746495>（签名审核要点/授权书要求）、<https://help.aliyun.com/document_detail/2873145.html>。

---

## 3. 短信模板正文（可直接复制提审）

### 3.0 硬约束（先看）

- **模板变量名必须与代码逐字一致**：`device`、`address`（见 §6）。报备变量名与代码 key 不一致 ⇒ 线上**发空值或静默失败**。
- **计费**：国内短信 **字数 = 签名字数 + 模板内容字数**；简体中文/字母/数字/标点**一律按 1 字**；**≤70 字按 1 条计费，>70 字按 67 字/条拆分多条计费**（用户端仍是一条）。
  依据：<https://helpcdn.aliyun.com/document_detail/158401.htm>、<https://help.aliyun.com/zh/sms/user-guide/message-rules>。
- **模板类型选「通知短信」**（非营销/推广）。文案**不得含营销、促销、推广、诱导**类措辞，否则驳回。
- 下表「字数」口径：**含签名 `【急救侠】`（5 字）+ 标点**；变量 `${device}`/`${address}` 按**字面**计入（`${device}`=9、`${address}`=10）；**实发字数 = 固定文字 + device 实际长度 + address 实际长度**（见每行的「变量预算」）。

### 3.1 候选 A（简洁直给）

**提审填此模板正文（不含签名）**：

```
${device}（${address}）被取用，请责任人尽快确认授权。
```

- **字数：正文字面 36 字；含签名 `【急救侠】` 合计 41 字 → ≤70 ✓（1 条计费）**
- 固定部分（去变量）17 字 + 签名 5 = 22 字；**变量预算：`device + address` 合计 ≤ 48 字**即不超 70。
- 语义：告知「某设备被取用」+ 请责任人确认授权；口吻为**通知类**，无营销词。

### 3.2 候选 B（点明"您负责的"）

**提审填此模板正文（不含签名）**：

```
您负责的${device}（${address}）有急救取用请求，请立即确认授权。
```

- **字数：正文字面 41 字；含签名 `【急救侠】` 合计 46 字 → ≤70 ✓（1 条计费）**
- 固定部分（去变量）22 字 + 签名 5 = 27 字；**变量预算：`device + address` 合计 ≤ 43 字**。
- 语义：明确"您负责的设备"+ 取用请求 + 确认授权；同样为通知类。

> 变量实际长度的提醒：`device` 取 `aed_devices.name`（种子数据约 8–12 字），`address` 取 `aed_devices.address`（约 10–20 字）。**若个别地址很长**，请核对实发是否仍 ≤70（A 留 48 字余量、B 留 43 字余量，一般足够）。

---

## 4. 语音 TTS 模板（`TtsCode`）

### 4.0 公共模式 vs 专属模式（关键）

| 对比项 | **公共模式** | **专属模式** |
|---|---|---|
| 号码 | **无需购买**，系统从**公共号码池**随机调度 | **须单独购买**真实号码，用自有号外呼 |
| 费用 | 后付费 **0.11 元/分钟**（不满 1 分钟按 1 分钟） | 同价 + **号码月租约 35 元/个/月** |
| 开通 | 资质 + 话术申请后即可用 | 需购号 |
| 适用 | **仅语音通知 / 语音验证码** | 常用场景（含更广场景） |
| 模板 | 需用**公共模式**语音模板 | 需用**专属号码**语音模板（**两类模板/套餐包不通用**，外呼模式须匹配） |

依据：<https://help.aliyun.com/doc/document_detail/55069.html>、<https://help.aliyun.com/zh/document_detail/148279.html>、<https://static-aliyun-doc.oss-cn-hangzhou.aliyuncs.com/download%2Fpdf%2F150082%2F%E4%BA%A7%E5%93%81%E5%AE%9A%E4%BB%B7_cn_zh-CN.pdf>（语音通知公共模式 0.11 元/分钟、专属号码月租 35 元/个/月）。

### 4.1 ✅ 本项目推荐：**公共模式**

依据**代码事实**：`急救侠-server/src/services/voiceService.ts:112` 传入 `callerNumber: config.ALIYUN_VOICE_CALLER_NUMBER || ''`，而 `buildVoiceRequest` 在 `voiceService.ts:81` 处 **`if (params.callerNumber)` 为空则"省略" `CalledShowNumber`** ⇒ **`ALIYUN_VOICE_CALLER_NUMBER` 留空即走公共模式**（公共号码池，**无需购号**、无月租）。这与语音降级"成本敏感、低频、仅通知"的定位一致，**推荐公共模式**。

> **待控制台确认**：公共模式是否需单独申请**「语音通知（公共模式）」模板类型**，以及该模板的"外呼模式"字段与代码 `SingleCallByTts`（不带 `CalledShowNumber`）的对应关系。

### 4.2 语音候选文案（变量名 `device`，与代码 `voiceService` / `smsReportService:185` 一致）

**候选 A（含"急救侠"播报口吻）**：

```
急救侠提醒：${device}有急救取用请求，请责任人尽快确认授权。
```

- **字数：34 字**（语音无签名；`${device}`=9 字面计；固定 25 字 + device 实际长度）。

**候选 B（简短）**：

```
急救设备${device}被取用，请责任人立即确认授权。
```

- **字数：28 字**（固定 19 字 + device 实际长度）。

> 语音变量 **只有 `device`**（**无 `address`**）—— 与短信不同，务必按 §6 对齐；代码对无值场景**回落字符串 `'AED'`**（`smsReportService.ts:185`），建议模板对 `${device}` 的读法在此前提下仍通顺。

---

## 5. 控制台配置步骤（拿到实名后照做）

1. **短信资质**：控制台 → 国内消息 → 资质管理 → 新增资质（企业自用/他用）；审核通过后才能申请签名。
2. **短信签名**：按 §2 选定 → 提交审核 → **等运营商实名报备**（5–10 工作日，报备期间不可用）。
3. **短信模板**：按 §3 选定 → 类型选**通知短信** → 变量 `device`、`address` → 提交审核（约 2–4 小时）。
4. **语音 TTS 模板**：按 §4 选定（推荐**公共模式**）→ 提交审核，得到 `TTS_xxxxxxxx`。
5. **开启短信状态报告 → HTTP 批量推送**：控制台 → **通用设置 → 回执配置 → 状态报告接收 → 开启「HTTP 批量推送模式」** → 接收地址填 **`https://<你的域名>/api/public/aliyun-sms-report`**。
   - 关键契约：**系统仅校验响应 `code` 为数字**，须 `HTTP 200` + `{"code":0,...}`；**响应超时 700ms**；**回执消息不保证幂等**（本仓库已在服务端做幂等）；失败按 **1/5/10 分钟重推，最多 3 次**。
   - 依据：<https://help.aliyun.com/zh/sms/globesmsreport>。
6. **生成 AccessKey**（建议 **RAM 子账号**，授予 `dysms:SendSms`、`dyvms:SingleCallByTts`），拿到 `AccessKeyId` / `AccessKeySecret`。
7. **写入 8 个 `ALIYUN_*`**（见 §5.1 的**文件归属**，写错文件会**静默失效**）。

### 5.1 ⚠️ 环境变量写到哪个文件（**以本节为准**）

| 场景 | 写入文件 |
|---|---|
| **生产部署**（`docker-compose.prod.yml`） | **仓库根 `.env`**（compose 的 `env_file` **只读根 `.env`**；`急救侠-server/.env` **生产不读**） |
| **本机生产同构自测**（`docker-compose.local.yml`） | **根 `.env.local`** |
| **本地裸跑后端**（`npm run dev`，直接跑 `急救侠-server`） | **`急救侠-server/.env`** |

> 参考模板：仓库根 `.env.example` 已含全部 `ALIYUN_*` 占位与说明（可直接 `cp .env.example .env`）。
> ⚠️ 旧文档中「写入 `急救侠-server/.env` 或根 `.env.local`」对**生产是错的**（另一工单正在修），**生产一律根 `.env`**。

**8 个 `ALIYUN_*`（生产写根 `.env`）**：

```
ALIYUN_SMS_ACCESS_KEY_ID=<RAM 子账号 AccessKeyId>
ALIYUN_SMS_ACCESS_KEY_SECRET=<RAM 子账号 AccessKeySecret>
ALIYUN_SMS_SIGN_NAME=<§2 审核通过的签名，只填文字，不含【】>
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxxxxxxx
ALIYUN_SMS_REGION=cn-hangzhou
ALIYUN_VOICE_TTS_CODE=TTS_xxxxxxxx
ALIYUN_VOICE_CALLER_NUMBER=            # 留空 = 公共模式（本项目推荐）
ALIYUN_SMS_REPORT_SECRET=<自定的随机长串，用于回调验真>
```

> 可选：`ALIYUN_VOICE_DAILY_LIMIT`（全局每日语音呼叫上限，默认 200）。
> **门控**：短信需**前 4 项非空**才启用；语音需**AK/SK + `ALIYUN_VOICE_TTS_CODE`** 齐备；回调端点未配 `ALIYUN_SMS_REPORT_SECRET` 时**整体返回 404**（不暴露存在）。

---

## 6. 变量 ↔ 代码逐字对齐表（含 `file:line`）

| 用途 | 阿里云侧 | 变量名（须逐字一致） | 代码出处 |
|---|---|---|---|
| 短信模板变量 | `${device}` | `device` | `急救侠-server/src/routes/aed.ts:679`（`sendSms(phone, { device: device.name, ... })`） |
| 短信模板变量 | `${address}` | `address` | `急救侠-server/src/routes/aed.ts:680`（`address: device.address || ''`） |
| 语音 TTS 变量 | `${device}` | `device` | `急救侠-server/src/services/smsReportService.ts:185`（`sendVoiceCall(phone, { device: device?.name || 'AED' })`） |

**API / 参数对齐**：

| 能力 | 端点 | Action | 关键参数 |
|---|---|---|---|
| 短信 | `dysmsapi.aliyuncs.com` | `SendSms` | `PhoneNumbers` / `SignName` / `TemplateCode` / `TemplateParam`(JSON)；Region 默认 `cn-hangzhou`（`smsService.ts:18-20,71-84`） |
| 语音 | `dyvmsapi.aliyuncs.com` | `SingleCallByTts` | `CalledNumber` / `TtsCode` / `TtsParam`(JSON) / `CalledShowNumber`(可选，空则省略=公共模式)（`voiceService.ts:64-84`） |
| 状态报告回调 | `POST /api/public/aliyun-sms-report` | — | 请求头 `x-sms-report-secret`（`routes/public.ts:71-75`；挂载 `app.ts:161`） |

> 变更提醒：若业务决定改用其它变量名，**短信**只需改 `routes/aed.ts:678-681` 一处键名（并同步模板报备）；**语音**改 `smsReportService.ts:185` 键名（并同步 TTS 模板）。**报备与代码必须同时改、保持一致。**

---

## 7. 提审后如何自查

拿到全部 `ALIYUN_*` 后，照 **`docs/DEPLOY.md §11`（阿里云短信 / 语音 · 联调验收清单）** 的 **7 项逐项验收**执行，覆盖：短信真机送达 → 状态报告落库 → 制造失败触发语音 → 重推幂等 → 回调验真 404 → 日上限限流 → 清空 `ALIYUN_*` 后零网络请求。

---

## 附录：已核查的阿里云官方文档（附 URL）

| 主题 | URL |
|---|---|
| 使用须知（企业/个人认证权益差异） | https://help.aliyun.com/zh/document_detail/108044.html |
| 短信资质（个人自用资质无法报备） | https://help.aliyun.com/zh/document_detail/2539800.html |
| 通过控制台发送短信（实名报备 5–7/7–10 工作日） | https://helpcdn.aliyun.com/document_detail/337013.htm |
| 签名规范（2–12 字/无符号/非中性） | https://intl.aliyun.com/help/zh/doc-detail/158399.htm |
| 签名实名制报备（来源降级、须企事业名/商标） | https://help.aliyun.com/document_detail/2873145.html |
| 存量签名合规核查通知 | https://help.aliyun.com/zh/sms/product-overview/notice-on-compliance-verification-of-sms-signature |
| 产品计费 / 短信长度规则（70 字/67 字拆分） | https://helpcdn.aliyun.com/document_detail/158401.htm |
| 短信发送规则（长度 + 频率限制） | https://help.aliyun.com/zh/sms/user-guide/message-rules |
| 回执消息配置（HTTP 批量推送 / 700ms / 重推） | https://help.aliyun.com/zh/sms/globesmsreport |
| 语音：公共模式 / 专属模式 FAQ | https://help.aliyun.com/doc/document_detail/55069.html |
| 语音：应用场景（两模式对比） | https://help.aliyun.com/zh/document_detail/148279.html |
| 语音：产品定价 PDF（公共 0.11 元/分钟；专属号码月租 35 元/月） | https://static-aliyun-doc.oss-cn-hangzhou.aliyuncs.com/download%2Fpdf%2F150082%2F%E4%BA%A7%E5%93%81%E5%AE%9A%E4%BB%B7_cn_zh-CN.pdf |
| 接入链路实操（审核/报备时长） | https://developer.aliyun.com/article/1746495 |

## 附录：「待控制台确认」清单

1. 签名来源方式（企事业单位名 / 已注册商标名）及**对应需上传的证照**；运营主体**企业全称/简称**；
2. 是否持有「**急救侠**」**注册商标**及注册证编号（决定该签名能否报备）；
3. 公共模式**语音通知模板**的申请入口/类型、模板"外呼模式"与 `SingleCallByTts`（无 `CalledShowNumber`）的对应关系；
4. 实名报备的**实际时效**（官方口径 5–10 工作日，不承诺）；
5. 资质/签名/模板**具体驳回原因清单**以控制台为准。

## 附录：存疑点（工程侧提醒）

- **签名与品牌名不一致的风险**：若合规上只能注册"企业全称/简称"签名，用户收到的短信将显示企业名而非"急救侠"品牌 —— 属**产品/合规取舍**，请业务确认是否可接受。
- **文案中"确认授权"的表述**：代码语义为责任人远程**确认授权**（MVP **不做物理开锁**）。模板文案已回避"开箱/开锁"字样以免误导；若产品改口径需同步改 §3/§4 文案。
- **语音文案字数**：语音按分钟计费（不满 1 分钟按 1 分钟），文案略长仍基本落在 1 分钟内；本材料给的两条均**远短于**常规 1 分钟播报，无额外计费影响。
- **纯英文/特殊字符**：本项目文案为纯中文，不受 GSM-7 扩展字符问题影响；但**短信中任何中文标点都会使编码切到 UCS-2**（按 70 字/67 字规则），本材料字数口径已按 UCS-2 计。
