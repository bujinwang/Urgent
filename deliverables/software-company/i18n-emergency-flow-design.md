# 设计：急救主链路中英双语（F2）

> 上游：`i18n-emergency-flow-prd.md`（v1.0）+ `product-backlog.md` F2
> 版本：v1.0 | 状态：设计定稿，待实现 | 语言：中文
> 本文**只写 PRD 没定的东西**（架构、键名、落点、分阶段）；PRD 已有的决策不复述。

---

## 1. ⚠️ 三处对 PRD 的实测修正（先读这节）

调研真实代码后，PRD 的三处判断需要修正。**其中第 1 条是"少做工作"，第 2 条是"多做工作"，第 3 条是"少做工作"。**

### 1.1 ✅ 修正（少做）：`vue-i18n` **已经是依赖**，不需要新增

PRD §1.1 称「❌ 零 i18n 基建 / **无任何 i18n 依赖**」—— **不准确**。

| 事实 | 值 |
|---|---|
| `package.json` → `dependencies['vue-i18n']` | **`^9.1.9`（已声明）** |
| `node_modules/vue-i18n/package.json` → version | **9.14.4（已安装）** |
| `src/` 中实际引用 | **0 处**（这才是"零基建"的真实含义） |

⇒ 准确表述是「**依赖已就位但从未接线**」。**不需要 `npm install`**，也不需要评估引入新依赖的供应链风险。
（PRD 原判断可能来自只在 `src/` 目录内 grep `vue-i18n` —— 命中的是 `lang="ts"` 之类的属性名误匹配。）

### 1.2 ⚠️ 修正（多做）：语音本地化 ≠ 只改 `wordForCpr`，`voice.ts` 有两处**中文硬编码**

PRD §1.1/D5 只点了 `wordForCpr`。实测 `utils/voice.ts` 还有两处更深的：

| 位置 | 现状 | 为什么是坑 |
|---|---|---|
| `voice.ts:91`（`speak`）、`:108`（`count`） | `u.lang = 'zh-CN'` **写死两处** | 即使**文本**换成英文，TTS 仍被告知用中文引擎 ⇒ 英文句子由中文语音合成读出来 |
| `voice.ts:61-74` `pickVoice` | 匹配器优先 `婷婷` / `Microsoft.*Xiaoxiao` / `Google.*Chinese` / `lang === 'zh-CN'` | 选出的永远是中文音色 |
| `voice.ts:85` | `.replace(/!/g, '，')` | 把感叹号换成**中文逗号** ⇒ 英文提示（`Start now!` → `Start now，`）被破坏 |

⇒ **真正的语音本地化 = 文本 + `u.lang` + 音色选择 + 标点规整，四者都要按 locale 走。**
只翻 `wordForCpr` 会得到「英文单词 + 中文音色 + 中文标点」，PRD 的 KPI「语音语言一致」在测试里能过、在**耳朵里**不过。

### 1.3 ✅ 修正（少做）：D4（后端 `message` 直出）在主链路上只有 **1 行**

PRD §3 把 D4 列为「**本次最容易被低估的坑**」。实测**高估了**：

> ⚠️ 取证过程本身踩了一个坑：Grep 工具用 `glob: "aed/**/*.vue"` 或 `glob: "{guide,aed,drill}/**/*.vue"` **静默返回 0 命中**（而 `aed/detail.vue` 明明含 `message`）。把 `path` 直接指向目录才拿到结果。**差点据此得出"范围内无后端文案"的错误结论。**

全范围内**只有 2 行**在展示后端 `res.message`，且**只有 1 行在急救主链路上**：

| 文件 | 行 | 在范围内？ | 说明 |
|---|---|---|---|
| `pages/aed/detail.vue` | 393 | ✅ **是** | 「通知 AED 责任人」的**最后兜底分支**（`code 0` / `NO_CUSTODIAN` / `CONSENT_REQUIRED` 三种都已有本地文案，只有"其它错误"才落到 `res.message`） |
| `pages/aed/custodian-alert.vue` | 142 | ❌ **否** | 这是 **AED 责任人**（志愿者/物业）看的页面，**游客看不到** ⇒ 不在 §1.2 清单内 |

⇒ **D4 的工作量是「1 行」**，不是"逐个盘点主链路"。PRD 的担忧方向正确、量级严重高估。

### 1.4 顺带确认的一处范围边界

`pages/aed/custodian-alert.vue` 与 `pages/aed/custodian-*.vue` 同族文件**不在 F2 范围**
（面向责任人，非面向呼救者/游客）。**范围纪律**：不要因为"同在 `aed/` 目录"就顺手翻掉。

---

## 2. 范围终稿（可执行清单）

在 PRD §1.2 基础上，**补上实测发现的必须项**：

| 层 | 文件 | 行数 | 备注 |
|---|---|---|---|
| 页面 | `pages/rescue/index.vue` | 492 | **最高优先**（建议书原文落点：「SOS 呼救全程无需语言沟通」） |
| 页面 | `pages/guide/index.vue` | 356 | 急救指引 |
| 页面 | `pages/aed/index.vue` | 649 | 找设备 |
| 页面 | `pages/aed/detail.vue` | 670 | 含 D4 那 1 行 |
| 页面 | `pages/drill/index.vue` | 105 | 与技术链路同源 |
| 组件 | `SosButton` / `StepTimer` / `Metronome` / `BottomSheet` / `VoiceManager` | 148/84/86/116/91 | |
| 语音 | `utils/voice.ts` | 137 | **四件事**：文本 + `u.lang` + 音色 + 标点（§1.2） |
| 基建 | `src/locales/{zh-CN,en-US}.ts` + `src/i18n.ts` + `main.ts` | 新增 | |

合计约 **2,934 行 / 11 个既有文件**，含中文行约 **326 行**。**这是本项目最大的一次前端改动**，故分期做（§6）。

❌ **不做**：其余 20+ 页面、`aed/custodian-*`、第三语种、后端 `Accept-Language`（PRD §8 已声明，此处重申）。

---

## 3. 架构与落点

### 3.1 目录与文件

```
src/locales/zh-CN.ts     ← 基准语言（source of truth）
src/locales/en-US.ts     ← 必须 ⊇ zh-CN 的键集
src/locales/index.ts     ← 组装 messages，导出 SUPPORTED_LOCALES / Locale 类型
src/i18n.ts              ← createI18n 配置 + 语言读写/自动判定
src/main.ts              ← app.use(i18n)
```

### 3.2 `createI18n` 配置（逐项都有理由，不要"顺手改"）

```ts
createI18n({
  legacy: false,                 // Vue3 Composition API（<script setup> 里 useI18n()）
  globalInjection: true,         // 模板里可直接 $t(...)
  locale: resolveInitialLocale(),// 见 §3.4
  fallbackLocale: 'zh-CN',       // ⚠️ PRD D2 契约：必须中文。绝不可改成 en-US
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
  missingWarn: import.meta.env?.DEV ?? false,  // 生产不刷警告
  fallbackWarn: import.meta.env?.DEV ?? false,
})
```

⚠️ **`legacy` 必须是 `false`**：v9 默认 `legacy: true` 是 Options API 形态，与 `<script setup>` + `useI18n()` 不兼容。
⚠️ **`fallbackLocale` 是硬契约**（PRD §8）。它只保证「缺 key 回落中文」，**不保证**"永远不出现裸 key"（见 §5.2）。

### 3.3 键名方案（语义命名，按页面/组件分域）

```
rescue.*      # pages/rescue
guide.*       # pages/guide
aed.list.*    # pages/aed/index
aed.detail.*  # pages/aed/detail
drill.*       # pages/drill
comp.*        # 组件共用（comp.sosButton.*、comp.bottomSheet.close…）
common.*      # 跨页面复用（common.confirm、common.cancel…）
voice.*       # 语音文本与计数词
```

**规则**：
1. **键名只描述语义，不含语言**：✅ `rescue.confirm.body` ❌ `rescue.confirm.body.zh`
2. **同义复用优先**：`common.*` 里有就不新造（PRD 的 KPI 是覆盖率，不是键数）
3. **插值用具名占位**：`{n}` / `{seconds}`，不用位置参数（可读性 + 便于校验）
4. **不允许把整句话拼起来**（`t('a') + name + t('b')`）—— 语序因语言而异，必须整句 + 插值

### 3.4 语言判定与持久化（PRD §6.2 的待验证项 —— 已验证）

```ts
const STORAGE_KEY = 'app_locale'

export function resolveInitialLocale(): Locale {
  // 1) 持久化优先
  const saved = safeGetStorage(STORAGE_KEY)
  if (isSupported(saved)) return saved
  // 2) 系统语言；⚠️ 必须守卫：测试 mock 与部分环境没有 uni.getLocale
  const sys = typeof uni.getLocale === 'function' ? safeCall(() => uni.getLocale()) : ''
  if (sys && /^en/i.test(sys)) return 'en-US'
  // 3) 兜底中文（PRD D2）
  return 'zh-CN'
}
```

**已验证的事实（不是猜测）**：
- `uni.getLocale()` **存在**于 uni-app 运行时；但 `__tests__/setup.ts` 的 `uni` mock **没有实现它** ⇒ 必须写成 `typeof uni.getLocale === 'function'` 守卫，否则测试里直接 `undefined` 调用崩溃。
- `uni.getStorageSync` 在新测试里**只对 `jwt_token` 返回 mock 值，其余键返回 `''`**（`setup.ts:20-26`）⇒ 语言键在测试中**必须自行 mock**，否则拿到 `''` 导致断言假绿（PRD §9 结尾已提醒，这里给出落法：测试里 `setStorage` 覆写而非依赖默认）。

### 3.5 页面内取值方式

- `<template>`：`$t('rescue.title')`（靠 `globalInjection`）
- `<script setup>`：`const { t, tm, locale } = useI18n()`
- ⚠️ **不要在 `<script setup>` 顶层把 `t(...)` 的结果赋给 `const`**：i18n 的 `t` 是响应式的，顶层取值会**冻结语言**（切换语言后不更新）。凡是需要响应式的地方，写成 `computed(() => t(...))`。

---

## 4. 语音本地化设计（§1.2 修正的落法）

### 4.1 `voice.ts` 改造点

> ⚠️ **本节 v1.1 修正（原方案错了，实现前必读）**：原设计提的是模块级 `setLocale(locale)` —— **不可用**。
> 实测：`utils/voice.ts` 是**跨范围单例**，除 F2 范围内的 `rescue`/`guide` 外，还被
> **范围外**页面直接 import：`pages/home/index.vue`（2 处）、`pages/mission/running.vue`（4 处）、
> `pages/mission/arrived.vue`（speakSequence）。
> 那些页面**并不会被本次改成双语**，文案仍是硬编码中文。
> ⇒ 若用全局 `setLocale`，切到 en-US 后它们会**用英文音色去念中文**，比改之前更差。
>
> **正确做法：语言是「每次调用的显式参数」，默认 `zh-CN`。**

```ts
interface VoiceOptions {
  rate?: number; pitch?: number; volume?: number; priority?: 'NORMAL' | 'URGENT'
  /** 合成语言。**默认 'zh-CN'** ⇒ 范围外调用方行为**逐字不变**（这是默认值存在的唯一理由）。 */
  lang?: 'zh-CN' | 'en-US'
}
```

**为什么默认值是 `zh-CN`（而不是"跟随全局 locale"）**：默认值决定了**范围外调用方的行为**。
必须让「不传 lang」等价于改动前的行为，否则就是**在范围外引入回归**。
范围内调用方（`rescue`/`guide`）**显式**传入当前 locale。

| 改造 | 原来 | 改为 |
|---|---|---|
| `speak` / `count` 的 `u.lang` | 写死 `'zh-CN'` | `opts.lang ?? 'zh-CN'`（**每调用**决定） |
| `pickVoice` | 无参、硬编码中文音色优先级 | `pickVoice(lang)`，按 `lang` 选匹配器（en ⇒ `lang==='en-US'` / `Google.*US English` / `Samantha` 等） |
| `!` → `，` | 无条件替换 | **仅当 `lang === 'zh-CN'`** 才替换（英文保留 `!`） |
| `AED` / `CPR` 规整 | 保留 | 保留（两种语言下读字母都对） |
| `command`/`guide`/`comfort`/`speakSequence` | 直接转发 | **透传 `lang`**（不传 ⇒ `zh-CN`，范围外不变） |

**`components/VoiceManager/index.vue`**：实测它是个**纯转发壳**（lazy `import('@/utils/voice')`，微信端降级为 `console.log`），
且**没有任何页面以组件方式使用它**（只在 `pages.json` 有条 easycom 规则 `^voice-mgr`，无实际引用）。
⇒ 只需给它的各方法**加可选 `lang` 透传**以保持 API 一致，**不要**为此重写它。


### 4.2 CPR 计数词

`pages/rescue/index.vue:329` 的 `wordForCpr(n)` 改为按 locale 取值：

- `zh-CN`：`['零','一',…,'十']`（现状不变）
- `en-US`：`['zero','one',…,'ten']`
- `n > 10`：两侧都回落 `String(n)`（TTS 会自然读成 "fifteen"），**与现状行为一致**

**KPI 断言**（PRD §5）：英文 locale 下 `wordForCpr` 输出**不含中文字符** —— 用 `/[\u4e00-\u9fa5]/` 断言。

> 实现选择：计数词**走 i18n 的 `voice.cprNumbers` 数组**（而非在 `rescue/index.vue` 里写死两份数组）。
> 理由：这样「漏译」会被 §5.1 的 key 完整性测试**自动覆盖**，不需要为语音单独写一套覆盖率检查。

**⚠️ 补充（v1.1 实测新发现）：还有第二处硬编码中文数字**

`pages/rescue/index.vue:367` 的 `startBreathCount()` 里写死了 `voice.count('一零零一')`，
并把 `String(1000+count)`（如 `"1002"`）交给 `voice.count()` —— 后者在当前实现下**明确按 `lang='zh-CN'` 合成**。
⇒ 英文 locale 下用户会听到**中文数字报数**。这一处 PRD 与设计 v1.0 **都没有捕获**。

处理：`'一零零一'` 是"人工呼吸计数"的**中文念法**（逐位念"一零零一"），英文对应 `'one zero zero one'`。
⇒ 归入 `voice.*` 的 i18n 键（与 `cprNumbers` 同一处理），并由 `startBreathCount` 按当前 locale 取值 + 传入 `lang`。
`String(1000+count)` 在英文下直接念数字即可（TTS 会读成 "one thousand two"）—— **保持现状形态，不要额外造词表**。


---

## 5. 测试与突变计划（在 PRD §9 上补强）

### 5.1 ★ 补上 PRD 漏掉的那条：**"用了但没定义"的 key**

PRD §9 只断言「`en-US` ⊇ `zh-CN`」。但**这不能防裸 key**：
若某处在代码里写了 `t('rescue.foo')` 而 **`zh-CN` 里根本没有 `rescue.foo`**，
则 `en-US` 缺它、`zh-CN` 也缺它 ⇒ **两侧都缺 ⇒ vue-i18n 直接渲染裸 key `rescue.foo`**，而完整性断言**依然全绿**。

⇒ **新增静态扫描测试**：
1. 扫描 §2 清单内所有文件，抽出全部 `t('...')` / `$t('...')` 字面量键；
2. 断言**每个键在两个 locale 中都能解析出非空字符串**，且**结果 ≠ 键名本身**（这正是"裸 key"的签名）；
3. 反向：断言**没有"定义了却没人用"的孤儿键**（防止翻译表腐烂）—— 此项列为**警告级**（`console.warn`），不 FAIL（孤儿键可能是为下一期预留）。

这条测试是**唯一能真正咬住"裸 key 泄漏 = 0"这个 KPI 的**东西。

#### 5.1.1 ⚠️ 更正（P0-3 期间由 QA 独立读码发现）：这条扫描是**单向**的，守不住"漏抽"

上面的措辞（"唯一能真正咬住 KPI 的东西"）**说过头了**。QA 读 `extractUsedKeys` 的实现后指出：

该函数用正则 `/(?<![\w$])(?:\$?t|tm|rt)\(\s*['"]([^'"]+)['"]/g` 抽键，**只匹配代码里出现的 `t('...')` 字面量**。
⇒ 它检验的是 **「代码用了这个 key → locale 里必须有」（used → defined，单向）**。

**它抓不到的反方向失效**：一段中文文案**整段漏抽，仍以裸字符串留在模板/脚本里**。
此时它**不产生任何 `t()` 调用** ⇒ `extractUsedKeys` 匹配不到 ⇒ `problems` 为空 ⇒ **扫描全绿、零告警**。
`expect(scannedKeys).toBeGreaterThan(0)`（§9.4 已论证其唯一价值边界是"范围清单被清空/扫描器整体失效"）**同样守不住"漏了一条"** —— 只要范围内还有**别的**文件含 `t()`，该计数就 > 0。

| 失效方向 | 症状 | 现有守卫 |
|---|---|---|
| **用了但没定义** | 渲染出裸 key `rescue.foo` | ✅ §5.1 静态扫描 + ✅ 类型层（`en-US: MessageSchema`） |
| **漏抽**（文案没换成 key） | 英文界面里**残留中文** | ❌ **无** |
| **孤儿键**（定义了没人用） | 翻译表腐烂 | ❌ **无** —— §5.1 第 3 步列为"警告级"，但**实测未实现** |

⇒ **必须补两条守卫**（随分期逐文件扩大范围，不要一次上全量，否则未迁移文件会立刻全红）：

1. **裸 CJK 扫描**：对**已迁移**的范围内文件，**剥离注释后**断言源码中不存在中日韩字面量（`/[\u4e00-\u9fa5]/`）。
2. **en-US 渲染快照**：在该语言的页面用例里断言 `wrapper.text()` **不含** `/[\u4e00-\u9fa5]/`。
   （比 1 更强：它覆盖"运行时才拼出来的字符串"，例如 `t()` 的插值结果、模板三元分支的另一侧。代价是只能覆盖已 mount 的状态 ⇒ 两者**互补，都要**。）
3. **孤儿键**检查暂**不**实现（列为警告级、且需要维护豁免名单）—— 记为独立技术债，不在 F2 分期里。

> **这条更正也修正了 §9.4 的教训**：那节讲的是"守卫自己失效也要能被突变咬住"；
> 本节讲的是**另一种**失效 —— **守卫方向不完整**。
> 守卫能红、且能咬住它**声明的**那种失效，仍然可能对**另一种**失效完全沉默。
> ⇒ 下"KPI 已守住"的结论前，必须先把该 KPI 的**失效模式逐个列出**（上表），再逐个问"哪条守卫咬它"。
> **"有守卫" ≠ "KPI 守住了"。**

### 5.2 `fallbackLocale` 的正确突变方式

PRD §9 说"把 `fallbackLocale` 改成 `'en-US'` ⇒ 必须红"。**补充精确的验法**：
- 构造一个**只在 `zh-CN` 存在的临时 key**（测试内注入），在 `en-US` 下 `t()` 它 ⇒ 期望拿到**中文**；
- 把 `fallbackLocale` 改成 `'en-US'` ⇒ 此时该 key 在 en 与 fallback 都缺失 ⇒ 返回**裸 key** ⇒ 断言"结果是中文"精确变红。
- 用"测试内注入临时 key"而不是"删掉某个真实 en key"：**不依赖具体文案**，不会因后续改文案而失效。

### 5.3 完整突变矩阵（实现后逐条跑）

| # | 改坏什么 | 期望 |
|---|---|---|
| 1 | `en-US` 删掉任一真实 key | 完整性用例红 |
| 2 | 代码里加一个 `t('rescue.__nope__')` 而不定义 | **§5.1 静态扫描红**（这条是本设计的核心价值） |
| 3 | `fallbackLocale` → `'en-US'` | §5.2 用例红 |
| 4 | `wordForCpr` 改回硬编码中文 | 英文 locale 断言红（含中文正则） |
| 5 | `voice.ts` 的 `u.lang` 改回 `'zh-CN'` | **语音 lang 断言红**（§1.2 修正对应的守卫） |
| 6 | `.replace(/!/g,'，')` 去掉 locale 守卫 | 英文标点用例红 |
| 7 | 去掉 `setStorageSync(STORAGE_KEY, …)` | 持久化用例红 |
| 8 | `resolveInitialLocale` 去掉 `typeof uni.getLocale` 守卫 | 测试**崩溃**（证明守卫必要）|
| 9 | `aed/detail.vue:393` 改回 `res.title = res.message` | 英文场景断言红（D4，唯一那 1 行）|
| 10 | `locale` 顶层取值（非 `computed`） | 切换语言后文案不更新 ⇒ 响应式用例红 |
| 11 | **故意漏抽一句**（模板里某句改回裸中文） | **§5.1.1 裸 CJK 扫描红**（守"漏抽"） |
| 12 | 把某句 en 值写成中文（或让 `t()` 返回中文） | **§5.1.1 en 渲染快照红**（守"运行时残留中文"） |
| 13 | `stepLabels` / `emergencyGuides` / `ventSteps` 从 `computed` 改回模块级 `const` | 切语言后文案不变 ⇒ 响应式用例红 |
| 14 | `pressLabel` 只改 `ref` 初值（保留 `watch` 里 `pressLabel.value='跟屏幕数字按压'`） | 进入 step4 后回到中文 ⇒ **EN 状态下断言该文案红**（P0-3 特有） |

> ⚠️ **突变纪律（本项目已两次踩坑，务必遵守）**：
> ① **改动后 `sleep 1` 再跑，或对任何 SURVIVED 结论复跑确认** —— vitest 可能回放过期 transform 缓存，把突变**假报为存活**（F3 实测：首跑 13 passed 假绿，复跑即红）。
> ② **还原用 `cp` 备份 + `sha256 -c` 自证**，不要 `git checkout --`（会连未提交的正当改动一起抹掉）。
> ③ **调用点/接线必须单独测**（F3 实测：删掉页面里那一行调用，全部用例仍全绿）。

---

## 6. 分期实施（每期结束都要过门禁）

**为什么分期**：2,934 行 / 326 处中文，一次性改完无法定位回归；而这是**急救主链路**，容错为 0。
每期结束跑：`vue-tsc --noEmit` + 全量 vitest（基线 **218 通过 / 40 文件**）+ 该期突变。

| 期 | 内容 | 交付 |
|---|---|---|
| **P0-1 基建** | `locales/{zh-CN,en-US}.ts`（先只放 `common.*` + `voice.*`）、`i18n.ts`、`main.ts` 接线、`resolveInitialLocale` | 基建可用；§5.1 静态扫描测试就位（此时键少，先跑通） |
| **P0-2 语音**（先于页面） | `voice.ts` 四件事 + `wordForCpr` 走 i18n | 语音 KPI 可达（PRD §5 第 4 条） |
| **P0-3 核心 SOS** | `pages/rescue/index.vue` + `SosButton`/`StepTimer`/`Metronome`/`BottomSheet`/`VoiceManager` | **建议书原文承诺的落点**，价值最高 |
| **P0-4 其余主链路** | `pages/guide` → `pages/aed/index` → `pages/aed/detail`（含 D4 那 1 行）→ `pages/drill` | 范围清单归零 |
| **P1** | 语言切换入口（放**设置/我的**页，**不得**放进 SOS 主流程）+ 自动判定打磨 | PRD §4 P1 |
| **P2** | 第三语种 | 需另开 PRD |

> **P0-2 放在 P0-3 之前**的理由：语音是"用户会立刻听出来"的部分，且改动集中在一个文件、风险低；
> 先做它可以用最小代价验证「i18n 在 uni-app H5 + vitest 里真的能跑」，避免在改完 5 个页面后才发现基建不兼容。

---

## 7. 由本设计确认的 PRD 开放问题（§6）

| PRD 问题 | 结论 | 依据 |
|---|---|---|
| §6.1 范围（guide / drill 是否做） | **都做**（PRD 建议），且**明确排除** `aed/custodian-*` | §1.3/§1.4 实测 |
| §6.2 `uni.getLocale()` 可用性 | **不可依赖**：必须写 `typeof` 守卫；测试环境无此方法 | §3.4 已验证 |
| §6.3 后端 message 方案 | **前端按 code 映射**（PRD 建议）。**但实测只需处理 1 行** | §1.3 |
| §6.4 切换入口位置 | **设置/我的页**（PRD 建议）；硬契约：**不得进 SOS 主流程** | PRD §8 |

---

## 8. 已识别风险与对策

| 风险 | 对策 |
|---|---|
| ⚠️ **改 `voice.ts` 会波及范围外页面**（它是跨范围单例，`home`/`mission/*` 都在用，且它们仍是中文） | **语言作为每次调用的显式参数、默认 `zh-CN`**（§4.1）。默认值保证"不传参 ⇒ 行为与改动前逐字一致"。**禁止**用模块级 `setLocale`。加一条断言：**不传 lang 时 `u.lang === 'zh-CN'`**（突变：把默认值改成 en ⇒ 必红） |
| 范围外的 `home`/`mission/*` 在 en-US 下仍说中文（体验不一致） | **本项不做**（PRD §8 范围纪律）。已记录为已知限制，不顺手扩大；若日后要覆盖，另开 PRD |
| vue-i18n 9.14 在 uni-app H5 的 message compiler 行为与纯 Vue 不同 | **P0-2 之前先做 5 分钟冒烟**：在 vitest 里 `createI18n` + `t()` 跑通再动手 |
| 批量抽 key 引入"文案错位"（把 A 的文案接到 B 的键） | 抽完**逐页 diff 视觉复核**；键名语义化（§3.3）降低错位概率 |
| 双语后**中文用户**体验被改变（PRD §2.2 用户故事 2） | `zh-CN` 为默认 + 兜底；**纯中文路径必须与改动前逐字一致**（列一条"中文文案快照"断言） |
| 改 `rescue/index.vue` 触发 F3 埋点回归 | F3 已有 `pages/rescue.test.ts`（5 条）；本项**必须保持其全绿** |
| 一次性改 5 个页面难以定位回归 | §6 分期，每期独立过门禁 |

---

## 9. ✅ P0-2 实现与独立验证记录（2026-09-14）

**门禁**：`vue-tsc --noEmit` **0 错误**；vitest **43 文件 / 261 用例**（P0-1 后基线 41/237 ⇒ +2 文件 +24 用例，零回退）；
**F3 的 `pages/rescue.test.ts` 5 条保持全绿**。

**分工**：工程师（寇豆码）实现 + 自证；**QA（严过关）另起实例独立复核**（新眼睛），源码与测试双查。

### 9.1 QA 独立突变矩阵（作者自证之外的第二次验证）

| 突变 | 结果 | 关键变红用例 |
|---|---|---|
| M1 `speak` 忽略 `options.lang`，写死 `zh-CN` | RED (7) | `传 lang en-US⇒u.lang`、`pickVoice 按语言选`、`缓存隔离`… |
| M2 音色缓存退化为单一固定键 | RED (2) | `音色缓存按语言隔离`、`缓存隔离双向` |
| M3 去掉 `!`→`，` 的 locale 条件 | RED (1) | `标点：zh "!"→"，"；en 保留 "!"` |
| M4 `wordForCpr` 改回硬编码中文 | RED (2) | `en-US 按压词不含中文`、`响应式切语言` |
| M5 **默认语言 `zh-CN` → `en-US`** | RED (9) | `不传 lang⇒zh`、`不传 lang 选中文音色`、`标点`、各类默认值… |
| M6（QA 自选）`guide` 调用点漏传 lang | RED (2) | `zh⇒lang=zh-CN`、`en⇒lang=en-US` |
| M7（QA 自选）en `cprNumbers` 错位（zero/one 对调） | RED (1) | `en-US 按压词不含中文`（**精确有序序列**抓到；仅长度断言抓不到错位） |
| M10（QA 自选）呼吸计数 interval 漏传 lang | RED (1) | `呼吸数字分支带 lang=en-US` |
| M11（QA 自选）**VoiceManager 组件剥掉 lang 透传** | ⚠️ **SURVIVED**（复跑确认） | 无 ⇒ **缺口 2** |
| M8（QA 自选）清空 `SCOPE_FILES` | ⚠️ **SURVIVED**（复跑确认） | 无 ⇒ **缺口 1** |

### 9.2 QA 抓出的两个测试缺口（作者自证时漏掉，均已修复）

| # | 缺口 | 为什么要紧 | 修法 |
|---|---|---|---|
| 1 | `i18n.test.ts` 的"扫描器失效"自检写成 `toBeGreaterThanOrEqual(0)` —— **对计数恒真** | 静态扫描是「裸 key 泄漏 = 0」KPI 的**唯一真守卫**（§5.1 已论证 `fallbackLocale` 防不住它），**而守卫自己失效时不报红** | 改 `toBeGreaterThan(0)`；并把 `utils/voice.ts` 加入 `SCOPE_FILES`（当前零 `t()` 调用，属预防） |
| 2 | `VoiceManager` 组件的 lang 透传**无任何测试** | M11 证明剥掉透传仍全绿 | 补 mock + `flushPromises` 的用例，断言下游收到 `en-US` |

> **教训（已写入手册）**：**"扫描器是否失效"这一类自检，本身也必须能被突变咬住。**
> `toBeGreaterThanOrEqual(0)` / `toBeTruthy()` 这类**弱断言**会让守卫变成装饰品 ——
> 断言必须写成"**该数字应该是多少**"，而不是"它是个数字"。

### 9.3 发现的一条既存缺陷（**非本次回归，不在本期范围**）

`utils/voice.ts` 的 `speak()` 只解构 `rate/pitch/volume/priority`，**从不读取 `options.onend`**
⇒ `speakSequence()` 在末句包装的回调**实际上从不触发**（改动前后一致，且无测试断言其触发）。
使用方为范围外的 `pages/mission/running.vue`、`pages/mission/arrived.vue`。
**本期不修**（超出 F2 范围）；已记入台账，若产品依赖该回调需另立任务。

### 9.4 ✅ 缺口修复的**二次验证**（team-lead 独立复跑，不是作者自证）

两个缺口修完后，由 team-lead 在干净工作树上重跑突变 —— **只证明"测试通过"不算数，必须证明"守卫会红"**：

| 复验突变 | 改法 | 结果 | 精确变红位置 |
|---|---|---|---|
| **A**（缺口 1 的真正价值） | 清空 `SCOPE_FILES`（断言保持 `> 0`） | **RED**，1 条 | `i18n.test.ts:188` → `expected 0 to be greater than 0` |
| **A′**（对照组，同突变、只回退断言） | 同样清空 `SCOPE_FILES`，但断言退回 `>= 0` | **GREEN，19/19 全过** | 无 ⇒ **完整复现 QA 当初的 M8 SURVIVED** |
| **B**（缺口 2） | `VoiceManager` 里 `vm.voice.command(text, lang)` → `vm.voice.command(text)` | **RED**，1 条 | `VoiceManager.test.ts:96` → `toHaveBeenCalledWith('x', 'en-US')` |

> **A 与 A′ 只差一个断言符号，结果从"溜过"变成"咬住"** —— 这就是缺口 1 的完整证明。

#### 9.4.1 一个必须写清楚的边界（第一版结论写错了，此处更正）

最初想用"**把扫描正则改坏**"来证明 `> 0` 的价值，实测**不成立**：
把正则改成永不匹配后，即使断言还是 `>= 0`，仍有 **2 条**用例变红 ——
来自独立的 `describe('静态扫描器自检')` 块（直接调 `extractUsedKeys` 断言返回非空），
它们与 `> 0` 无关。

⇒ 结论要收窄为：**`> 0` 这条守卫的唯一价值边界，是"范围清单本身失效"** ——
`SCOPE_FILES` 被清空 / 路径写错 / 某个文件被重命名后 `existsSync` 分支只 push 进 `problems`
而 `problems` 恰好为空、或循环压根不执行。这个失效模式下**其它守卫全部沉默**，
只有 `> 0` 会红。QA 选中 M8 正是一击命中该边界，而 `>= 0` 放过了它。

> **教训（已写入手册）**：**"扫描器是否失效"这一类自检，本身也必须能被突变咬住。**
> `toBeGreaterThanOrEqual(0)` / `toBeTruthy()` 这类**弱断言**会让守卫变成装饰品 ——
> 断言必须写成"**该数字应该是多少**"，而不是"它是个数字"。
> 另一半教训是**验证方法本身**：说"某守卫有价值"之前，先弄清**还有谁会咬住这个突变**，
> 否则证明的是别人的功劳。（本次第一版结论就是因为没做这一步而写错。）

突变一律 `cp` 备份 + `shasum -a256 -c` 还原，还原后校验字节一致（`RESTORED_OK`），
再跑全量确认 **261 passed** 才提交 —— 工作树里不留任何突变残留。

### 9.5 提交记录

| 提交 | 内容 |
|---|---|
| `3ddc1b2` | `feat(i18n)`: 语音层本地化（`voice.ts` + `VoiceManager` + rescue/guide + 两个 locale） |
| `75115b9` | `test(i18n)`: 22 + 6 + 2 用例 + 两处守卫加固 |

---

## 10. ⚠️ 交接给 P0-3 的前置条件（开工前必读）

> **✅ 本节已完结（2026-09-14）**：三条前置条件 P0-3 全部处理完毕，验证记录见 **§11**。
> §10.1 已在 `setup.ts` 落实（并额外发现 `dispose` 承重问题）；§10.2 的 7 条语音整句已全部抽 key。
> 本节保留作**决策依据的存档**，不要再当待办读。

### 10.1 🔴 **测试基建必须先装 i18n 插件**（否则 P0-3 一定崩）

P0-2 实测发现：现有页面测试 `mount(page.default)` **没有安装 i18n 插件**
（`vitest.config.mts` 与 `src/__tests__/setup.ts` 里都没有 `app.use(i18n)`），
而 vue-i18n v9 在未安装时 `useI18n()` **直接抛** `Need to install with 'app.use' function`。

P0-2 绕开了它（改用全局组合式实例 `i18n.global`，响应式实测有效）。
**但 P0-3 一旦在模板里写 `$t(...)`，页面测试会当场崩。**

⇒ **P0-3 第一步**：给 `@vue/test-utils` 配 `config.global.plugins = [i18n]`，再动页面文案。
（这是 **P0-1 未做、P0-2 绕开、P0-3 必然踩到**的基建缺口。）

### 10.2 🟡 P0-2 只本地化了"计数词"，**语音句子仍是中文**

`rescue` 的 `speakGuide` / `speakCommand` / `speakUrgent` 传入的整句文案**仍是硬编码中文**，
却已经带了 `lang=en-US` ⇒ 当前英文用户会听到"**英文音色念中文句**"。
**只有计数词（一→one…）与呼吸计数已本地化。**

⇒ PRD §5 的「**语音语言一致**」KPI 目前**仅部分达成**，由 P0-3（页面文案抽 key）收口。
**这是分期的已知中间态，不是 bug**；但**不要在 P0-2 交付时对外宣称语音已全英文化**。

**精确清点（QA 独立穷举，供 P0-3 逐个核销）**：共 **7 条**硬编码中文朗读文本，分布在 **5 个代码位置**：

| # | 位置 | 朗读文本 | 备注 |
|---|---|---|---|
| 1 | `watch` `step===1` | `演习模式。系统已模拟调度。现场清空，准备按压。` | ⚠️ 三元分支，需**单独一条 key** |
| 2 | 同上 | `系统已调度。现场清空，准备按压。` | ⚠️ 上一条的另一分支 |
| 3 | `watch` `step===2` | `拍打患者两侧肩膀，在耳边大声呼喊。观察是否有反应。` | |
| 4 | `watch` `aed` `phase===0` | `所有人离开患者。AED 正在分析心率。` | |
| 5 | `watch` `aed` `phase===1` | `离开。按下电击键。` | |
| 6 | `watch` `step===5` | `仰头抬下巴，让气道打开。检查口腔，清除可见异物。捏住鼻子，嘴包嘴密封，吹一口气。` | |
| 7 | `watch` `step==='loop'` | `继续三十次按压，加两次人工呼吸。不要停下。` | 用中文数字词，易被"数字不译"直觉漏掉 |

**已本地化、不需再抽**：`voice.speak(wordForCpr(...))`（走 `voice.cprNumbers`）与 `startBreathCount()` 的 `voice.count(breathStart.value)`（走 `voice.breathStart`）；`String(1000+count)` 为纯数字，locale 中性。

### 10.3 🟢 范围外页面的隔离已被证明

`pages/home/index.vue`、`pages/mission/running.vue`、`pages/mission/arrived.vue`
**未被本次改动触及**（`git status` 确认），其调用点全部不传 `lang`；M5 已证明"默认值守卫"有效（9 条变红）。

---

## 11. ✅ P0-3 实现与独立验证记录（2026-09-14）

**门禁**：`vue-tsc --noEmit` **0 error**；vitest **44 文件 / 292 用例**（P0-2 后基线 43/261 ⇒ +1 文件 +31 用例，零回退）。
**`Errors` 行为 0**（连跑 5 次确认，见 §11.4 —— 这一行曾是非 0，是本次最重要的发现）。

**提交**：`6d09ffe`（测试基建）→ `f3bf9e4`（feat）→ `9157a0f`（test）→ `24c6cee`（fix 泄漏）→ `c7f873e`（test 守卫）→ `bb80d30`（fix 文案）

**交付**：`rescue` 页 127 条叶键（全在顶层 `rescue.*`）；语音整句 **7 条**本地化（§10.2 缺口收口）。

### 11.1 本次最大的技术陷阱：**语言会被"冻结"**

三个模块级 `const`（`stepLabels`/`emergencyGuides`/`ventSteps`）+ 两个 `ref` 初值
**只在 setup 求值一次** ⇒ 只包 `t()` 不够，切到 en 后仍显示中文。
其中 `pressLabel` 最阴：它**还被 `watch` 里 `step===4` 与 `resetCount()` 两处
用硬编码中文重新赋值** ⇒ **改 `ref` 初值根本拦不住**。
落法：**状态-文本分离**（ref 存 `'idle'|'hint'|'reset'`，`computed` 翻成文本）。

### 11.2 守卫体系（**四层**，实测互补）

| 守卫 | 能抓 | 抓不到 |
|---|---|---|
| 类型层（`en-US: MessageSchema`） | en **结构性**漏键 | 值写错、漏抽 |
| 静态扫描（`t('...')` 字面量） | **用了但没定义**（used → defined） | **漏抽**（见 §5.1.1） |
| 源码裸 CJK 扫描 | 代码里的中文字面量（**含不渲染的死分支**） | locale 文件里的中文 |
| 渲染快照（en 无 CJK / 内容完整性） | 运行时渲染出的中文；**整项被删** | 不渲染的代码 |

**"互补非冗余"是实测结论**，不是推测：QA 构造出双向反例 ——
(a) 不渲染的死分支里的中文 ⇒ 只有**源码扫描**红；
(b) 中文来自 **locale 文件** ⇒ 只有**渲染快照**红。

#### 11.2.1 ★ 新增的「内容完整性」守卫（8 用例 = 4 检查 × 2 语言）

QA 用 3 条突变证明了一个**真实盲区**（全部 SURVIVED、复跑确认）：
删 `emergencyGuides` 一整项 / `ventSteps` 4→3 / 改坏 zh 某值 ⇒ **282/282 全绿**。

⇒ 原两条守卫**都只证明"没有多余的中文"，证明不了"该有的还在"**。
新增守卫的**两个设计要点**：
1. **期望值锚到 `messages[locale]`，零硬抄**。断言形式为
   「渲染值 === locale 值」+「数量 === locale 条目数」。
   ⛔ 硬抄字符串会训练人盲目更新断言 —— 快照测试的经典失效模式。
2. **先断言数量、再断言内容** ⇒ 删项时红在数量（`expected 4 to be 5`），不是一堆文本 diff。

#### 11.2.2 ⚠️ 刻意不写的一条（**已知边界，非疏忽**）

"把某条文案的值改成乱码"这类**纯内容损坏**，任何「渲染 == locale」断言
**原理上都抓不到**（它比的是同一个源）。要抓只能把期望中文**逐字硬抄**，
代价是每次正常改文案都误报 ⇒ **刻意不写**，由 **diff review** 覆盖。
（这是本设计**唯一**一条"知道有失效模式但选择不设守卫"的，明确记录以免被误当漏项。）

### 11.3 ⚠️ 一个由本次改动**引入**的缺陷：卸载后仍触发的定时器泄漏

**现象**：`vitest run` 报 `Tests 292 passed` 的同时，输出里还有 **`Errors 1 error`**：
`ReferenceError: window is not defined`，链路指向 `rescue/index.vue` 的 `Timeout._onTimeout`。
**间歇性**（3 连跑：干净 / 2 errors / 1 error）—— 取决于泄漏定时器是否正好在 teardown 后才烧完。

**根因**：`watch` 里 `setTimeout(..., 50)` 的**句柄没存**，`stopAll()` 漏清。
改动前该回调里是**硬编码中文字符串**（字面量无副作用）⇒ 泄漏一直在但**无症状**；
把整句换成 `t(...)` 后，卸载后触发会走进 i18n 运行时 ⇒ 变成可观测崩溃。
**第二处更严重**（自查发现）：`resetCount()` 的 `setTimeout(..., 1500)` 同样没存句柄，
卸载后会 `startPress()` ⇒ 起一个**永不清理的 `pressTimer`，持续念数**。

**生产影响**：进 step1 后立刻点"‹ 返回"⇒ `stopAll()` 之后那声语音**仍会念出来**。

**两条可复用的规矩（已入手册）**：
1. **跑完全量要看 `Errors` 行，不能只看 `Tests` 行** —— 通过数覆盖不了测试之外抛的异常。
2. **把字面量替换成函数调用时，要重估同一段代码的既存泄漏** —— 字面量无副作用，函数调用有。
   定时器/异步回调里做这种替换，**尤其要查句柄是否被清理**。

### 11.4 范围边界（刻意不动）

- `SosButton`/`Metronome` 的 `withDefaults` 默认值**不改**：`SosButton` 还被**范围外**的
  `pages/home` 使用；rescue 对这两个组件**全部显式传 props** ⇒ 本页文案 100% 由本页 key 覆盖，
  组件默认值从本页走不到。（`Metronome` 默认值与 rescue 原 `ref` 初值逐字相同 ⇒ 跨文件重复的第二份。）
- `VoiceManager` 组件**无用户可见文案** ⇒ 本期不改。

### 11.5 ⚠️ 两条待记账项（不阻塞 P0-3）

1. **AED 内联分阶段 UI 不可达**（**既存缺陷，非本次引入**，已核对 `HEAD` 同样零赋值点）：
   `cprStep='aed'` 全仓**零赋值点**，故该段 UI（`aedPhaseLabel/quote/detail2` + 3 条 AED 语音）
   在真实流程里**不可达**，测试须经 `wrapper.vm` 驱动。
   `goAedFlow()` 实际是 `uni.switchTab('/pages/aed/index')`（**跳走**，不设 `cprStep`）。
   严重性**中等**：用户并非失去 AED 引导（另有独立 `pages/aed/*`），但这条内联分阶段流程没接上。
   ⇒ **建议另立任务**。
2. **`v-html` 约束（由 1 处扩到 4 处）**：`step1.detail.{drill,real}` / `cpr.keyDetail` /
   `aed.detail2` / `loop.detail`。原因：`<strong>` 的强调落点**因语言而异**，
   拆前后缀拼装会破坏英文语序。
   **当前不是风险**（这 4 条消息**均无插值**、值来自本地打包静态文件）。
   ⚠️ 但下列条件下会变成真风险：① locale 改为运行时远端加载；② 引入可编辑翻译源；
   ③ **给 v-html 消息传入来源不可信的插值**（vue-i18n 的 v-html 路径**不转义插值参数**）。
   ⇒ **规则：v-html 消息不得包含来源不可信的插值；locale 保持本地静态打包。**

### 11.6 交接给 P0-4 的要点

1. **裸 CJK 源码守卫当前只扫 `rescue/index.vue`** —— P0-4 每迁移一个文件，**把它加进扫描范围**，
   并同步补该文件的「内容完整性」守卫（照 `rescue-i18n.test.ts` 的模式，期望值锚 `messages`）。
2. **测试基建已就绪**（`setup.ts` 装了插件 + `dispose` 空操作）⇒ P0-4 直接用 `$t(...)` 即可，无前置工作。
   注意 `dispose` 空操作是**承重的**（有专门用例锁住），别删。
3. **`aed/detail.vue` 含 D4 那 1 行**（`res.title = res.message`，后端直出文案）—— §1.3 已确认全链路只此 1 行。
4. 每跑完全量**扫一眼 `Errors` 行**（§11.3）。

---

## 12. ✅ P0-4a 实现与独立验证记录（2026-09-15）

**范围**：`pages/guide/index.vue`（急救知识页）+ `pages/aed/index.vue`（AED 地图页）。
**门禁**：`vue-tsc --noEmit` **0 error**；vitest **45 文件 / 319 用例**（P0-3 后基线 44/292 ⇒ +1 文件 +27 用例，零回退）；
`Errors` 行 **0**；**乱序** `--sequence.shuffle` seed 1337 / 2024 / 7 各 **45/319**。
**提交**：`948bcba`（feat）→ `10b12d0`（test）→ `87ce33a`（fix 顺序依赖）→ `37f1746`（fix 文案）

### 12.1 ★ 本次最重要的技术结论：**对象数组是"守卫真空"**

原 `guide.guides.<type>.steps` 是 `[{ title, detail }]`。**实测反例**（QA 复现）：
删掉 en 的一个 step ⇒ **`vue-tsc` 0 error，且「en-US ⊇ zh-CN」断言 PASS**。

原因是它**同时**废掉两层守卫：
1. **类型层**：`const enUSChecked: MessageSchema = enUS` 中，数组元素的类型由 zh 侧推断为
   `{ title: string; detail: string }` ⇒ 只校验元素**形状**，**不校验长度**（TS 不把数组字面量推成元组）。
2. **键完整性**：`collectKeyPaths()` 遇数组即把**整条路径当叶值** ⇒ 数组元素**内部字段根本不进键路径集合**。

**落法**（与 P0-3 的 `ventSteps` 同法）：改成**索引键** `steps.s1..s5`，
模板侧用 `computed` 组装成数组。此后删任一侧的 `sN` 都会被至少一层咬住。

#### 12.1.1 ⚠️ 单侧删除的**方向性**（与 P0-3 §11.2.1 同一道防线）

| 突变 | `vue-tsc` | 运行时 | 咬住它的守卫 |
|---|---|---|---|
| 删 **en** 的 `steps.s3` | **红** | — | 类型层（`en-US` 缺 zh 有的属性） |
| 删 **zh** 的 `steps.s3`（en 保留） | **不红** | 红 | 运行时「数量 === locale 条目数」 |

zh 侧删键**不会**触发编译错误，因为 `enUSChecked` 里多出的属性是**变量赋值**上的"多余"属性 ——
TS 的多余属性检查（excess property check）只对**直接的对象字面量**生效。
⇒ 又一次印证 §11.2.1「**先断言数量、再断言内容**」不是锦上添花，而是**唯一**能兜住这个方向的防线。

### 12.2 ★ 第三个顺序依赖：模块级单例的"注入污染"（**只有整仓乱序才暴露**）

**现象**（team-lead 独立验证时发现，**不在**工程师自证范围内）：
顺序全量跑 **45/319 全绿 ×3**，但 `--sequence.shuffle` 报

```
FAIL src/__tests__/i18n.test.ts > 翻译完整性：en-US ⊇ zh-CN > ★ zh-CN 的每个键在 en-US 都必须存在
AssertionError: en-US 缺少这些键：__test_only_zh.msg
```

**根因**：`createI18n({ messages })` **不克隆** `messages`。其内部 zh-CN 消息树与
`locales/index.ts` 的 `messages['zh-CN']`、进而与导入的 **`zhCN` 模块对象是同一个引用**。
「兜底」用例（§5.2 那条）直接 `i18n.global.mergeLocaleMessage('zh-CN', { __test_only_zh: { msg } })` 注入临时键
**且从不清理** ⇒ 该键**永久留在 `zhCN` 上**，被完整性用例读到。

**为什么此前 3 个阶段都没发现**：`i18n.test.ts` 内「完整性」用例排在该用例**之前**，
文件内顺序固定 ⇒ 单独跑、整文件跑都绿。P0-4a 新增多个测试文件后乱序才会把两者换位。

**修法（`87ce33a`）**：
1. 改用**深拷贝的沙箱实例**（`messages: JSON.parse(JSON.stringify(messages))`）——
   从**结构上**杜绝外溢，不依赖"记得清理"。`fallbackLocale` 取自生产常量 `FALLBACK_LOCALE`，
   其与生产单例的一致性由同文件第 2 条契约用例（`i18n.global.fallbackLocale.value === 'zh-CN'`）锁定。
2. 在注入处**同地**加反向断言 `expect(collectKeyPaths(zhCN)).not.toContain(KEY)` ——
   突变验证：把深拷贝改回共享引用后，红的正是这条新断言
   （`expected [ 'common.confirm', …(235) ] to not include '__test_only_zh.msg'`），
   而**不是**原先那句看不懂原因的"en-US 缺少键"。

> **新增规矩（已入手册）**：`createI18n` **不克隆** messages。
> 任何"向共享 locale 树注入测试键"的写法都必须走**深拷贝沙箱**；
> 且**顺序无关性必须用整仓乱序验证** —— 单独跑 ∧ 整文件跑 ∧ 换位置跑，三种结果必须一致。

### 12.3 守卫清单收敛为**唯一事实源**（`src/__tests__/i18n-scope.ts`）

`rescue-i18n.test.ts` 与 `guide-aed-i18n.test.ts` 都要对**同一份**"已完成本地化页面清单"做裸 CJK 扫描。
两边各写一份必然漂移（新页面只被一边扫到 ⇒ 另一边的守卫形同虚设）⇒ 收敛为共享清单。

⚠️ **命名易混点**：本模块的 `SCOPE_FILES` 与 `i18n.test.ts` 内的 `SCOPE_FILES` **刻意不同**：
- 本模块 = **裸 CJK 守卫**范围，只含**已完成本地化**的页面（P0-4a 为 rescue/guide/aed-index 三个）。
- `i18n.test.ts` = **静态 key 使用扫描**范围，含尚未抽 key 的 `aed/detail.vue`、`drill/index.vue`。
前者加入未完成页面会**误报红**；后者不加入会**漏扫**。（两者同名但作用域不同，属已知易混点。）

守卫自身也被守住：新增「扫描范围非空」断言，防清单被清空后逐文件循环退化成恒真。

### 12.4 刻意不改（QA 提出，已评估后**有意保留**）

- **`aed.nearby` 的英文复数**：`'{count} AED nearby'` 在 `count ≠ 1` 时严格说应为 `AEDs`。
  但 vue-i18n 的复数形式要求消息内含 `|` 分隔符，而「内容完整性」守卫用
  `interp(a.nearby, {...})` 做**原串等值**比较 ⇒ 加 `|` 会让守卫红。
  为一个雷达浮标的措辞去改守卫语义不划算；且 `AED` 作为缩略名词在英文中普遍不加复数。⇒ **保留**。
- **`guide.navPrev`** 原为 `'← Back'`（zh 是「← 上一步」）。这不是风格问题：`Back` 在向导语境里
  读作"退出/返回上一页"，与相邻 `Next →` 不构成上一步/下一步的对偶，会误导英文用户以为要离开流程。
  ⇒ **已修**（`37f1746` → `'← Previous step'`）。

### 12.5 交接 P0-4b

见 §13（决策已拍板）与下方"已知边界"。

---

## 13. P0-4b 前置决策（**已拍板，实现前必读**）

范围：`pages/aed/detail.vue`（670 行，含 §1.3 的 D4 那 1 行）+ `pages/drill/index.vue`（105 行）。

| 编号 | 场景 | 决策 | 理由 |
|---|---|---|---|
| **D1** | `detail.vue` 把后端 `res.message` 直接当 toast（`res.message \|\| '通知失败'`） | **en-US 走本地化通用文案；zh-CN 保留后端原文** | 后端 message 全中文（`未登录`/`令牌无效`/`请求过于频繁`…），设计 §2 已声明后端 `Accept-Language` 不做。en 用户在**失败路径**看到中文 toast 才是真问题 |
| **D2** | `drill/index.vue` 是否本轮做 | **做**（设计 §2 已列，与 rescue 的 Drill 模式同源） | 105 行机械抽 key，风险低；做完可并入同一份守卫清单 |
| **D3** | 写进后端的**审计 payload**（取用 `notes`、打卡 `comment`） | **不本地化，恒 zh-CN**，且抽到**独立非页面模块** | 这是**数据契约**不是 UI 文案；本地化会让英文用户写入英文、污染数据一致性。移出 page 文件是为了**不给裸 CJK 守卫开白名单**（白名单会削弱守卫） |
| **D4** | 前端自写的 `\|\| '中文'` 兜底（责任人头像/姓名/角色） | **本地化** | 这些是**前端常量**，不是后端数据 |
| **D5** | `drill` 表单默认值 `location: '深圳湾公园'` | 抽 key：zh `深圳湾公园` / en `Shenzhen Bay Park` | 用户可见的默认输入值；为过裸 CJK 守卫 |
| **D6** | 后端返回的**展示数据**（`d.title`/`d.description`/`d.location`/`d.organizerName`/`r.notes`/`ci.userName`） | **不本地化**，明确记为**已知边界** | 后端/用户数据，不在本期范围（§2 已声明）。新测试文件顶部须写明，避免后人误判为漏抽 |

### 13.1 ⚠️ 「英文界面无中文」KPI 的**适用边界**（重要，勿误解为漏抽）

该 KPI 的**可达成范围**仅为：**前端静态文案 + 语音**。**不覆盖**：
1. **后端返回的 `message`**（D1 已单独兜底 en 路径）；
2. **后端返回的业务数据**（设备名/地址/打卡备注/训练记录 notes/用户名）—— 用户生成内容，无对应翻译；
3. **写进后端的审计 payload**（D3，恒 zh-CN）。

裸 CJK 源码守卫与渲染快照**原理上都看不到** (1)(2)（它们不是源码字面量）。⇒ 这三类必须**显式记账**，
而不是被当成守卫漏报。（彻底的解法是后端 i18n + 数据层多语言，**超出 F2 范围**。）

### 13.2 known-defect（既存，**非本次引入，不在 P0-4b 范围**）

`drill/index.vue` 的"发起演习"弹窗使用原生 HTML 标签（`<div>/<label>/<input>/<select>/<h3>`）。
uni-app 在**非 H5 端**不支持原生 HTML 标签 ⇒ 该弹窗在微信小程序等端**很可能不可用**。
本次只做文案本地化，**不修**（修它属于行为/结构改动，需单独立项）。


