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

### 10.3 🟢 范围外页面的隔离已被证明

`pages/home/index.vue`、`pages/mission/running.vue`、`pages/mission/arrived.vue`
**未被本次改动触及**（`git status` 确认），其调用点全部不传 `lang`；M5 已证明"默认值守卫"有效（9 条变红）。

