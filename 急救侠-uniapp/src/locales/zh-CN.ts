/**
 * 基准语言（`zh-CN`）—— **所有其它语言必须 ⊇ 本文件的键集**。
 *
 * 纪律（改动前必读 `deliverables/software-company/i18n-emergency-flow-design.md` §3.3）：
 * 1. **键名只描述语义，不含语言**：✅ `rescue.confirm.body` ❌ `rescue.confirm.body.zh`
 * 2. **同义复用优先**：`common.*` 里有就不新造（KPI 是覆盖率，不是键数）
 * 3. **插值用具名占位**：`{n}` / `{seconds}`，不用位置参数
 * 4. **不允许把整句话拼起来**（`t('a') + name + t('b')`）—— 语序因语言而异，必须整句 + 插值
 *
 * ⚠️ 本文件是**基准**：漏了键不会"回落"，而是**两侧都缺 ⇒ 直接渲染裸 key**。
 * 防它的不是 `fallbackLocale`（那只管 en 缺、zh 有），而是
 * `src/__tests__/i18n.test.ts` 里的**静态扫描**（扫描代码里用到的每个键）。
 */
export default {
  common: {
    confirm: '确认',
    cancel: '取消',
    ok: '好的',
    retry: '重试',
    loading: '加载中…',
    networkError: '网络异常，请稍后重试',
    /** 语言名（用于切换入口；**各语言下都写自己的名字**，便于用户辨认）。 */
    languageZh: '简体中文',
    languageEn: 'English',
  },

  /**
   * 语音文本与计数词。
   *
   * `cprNumbers` 是**数组**：`wordForCpr(n)` 按索引取词，`n > 10` 时回落 `String(n)`。
   * ⚠️ 之所以把计数词放进 i18n（而不是在 `rescue/index.vue` 里写死两份数组）：
   * 这样"漏译"会被 key 完整性测试**自动覆盖**，不必为语音单独维护一套覆盖率检查。
   */
  voice: {
    cprNumbers: ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'],
    /**
     * 人工呼吸计数的**起手念法**（逐位念"一零零一"）。
     * `startBreathCount()` 第一声用它，随后 `String(1000 + n)` 直接交给 TTS 念数字。
     */
    breathStart: '一零零一',
  },

  /**
   * `pages/rescue/index.vue`（SOS 急救主链路，F2 最高优先落点）。
   *
   * ⚠️ 本域内**含 HTML** 的值（`step1.detail.*` / `cpr.keyDetail` / `aed.detail2` /
   * `loop.detail`）是给 `v-html` 用的：`<strong>` 的强调落到句中不同位置，
   * 因此**必须整句一个 key**（若拆成前后缀拼装，英文语序会被破坏，违反 §3.3 第 4 条）。
   */
  rescue: {
    title: '紧急救护',
    banner: {
      title: '演习模式',
      sub: '本次为流程演练，不会真实拨打 120',
      /** CPR 阶段顶部的紧凑横幅。 */
      compact: '演习 · 不会拨打 120',
    },

    /** === 阶段1：决策 === */
    decision: {
      tag: { drill: '演习 · 熟悉 CPR 流程', real: 'EMERGENCY · 黄金 4 分钟' },
      main: '患者倒地无反应？',
      sub: '深呼吸 · 您不会孤军奋战',
      start: { drill: '开始 CPR 演习', real: '立即启动 CPR' },
      startSub: { drill: '熟悉全流程 · 模拟调度 AED 小队', real: '全自动呼叫 120 + 调度 AED 小队' },
      autoLabel: { drill: '演习模式 · 系统将模拟以下操作：', real: '点击后 5 秒内系统自动:' },
      other: '其他紧急情况',
      legalSave: '🛡 善意救助免责',
      legalLaw: '《民法典》184 条',
    },

    /** 决策页"系统自动操作"三格。 */
    auto: {
      call120: '呼叫 120',
      call120Drill: '模拟呼叫 120',
      volunteers: '召志愿者',
      volunteersDrill: '模拟召志愿者',
      aed: '派 AED',
      aedDrill: '模拟派 AED',
    },

    /** 顶部 5 个步骤胶囊下的标签（顺序 = 步骤 1..5）。 */
    steps: {
      labels: ['呼救', '判断', '呼吸', '按压', '人工呼吸'],
    },

    /** 决策页"其他紧急情况"入口（`type` 与路由参数一致）。 */
    guides: {
      heimlich: { title: '异物窒息', desc: '海姆立克法' },
      bleeding: { title: '大出血', desc: '压迫止血包扎' },
      fracture: { title: '骨折外伤', desc: '原位固定防二次损伤' },
      transport: { title: '伤员搬运', desc: '脊柱损伤搬运技巧' },
      psychological: { title: '紧急心理干预', desc: '安抚情绪转移注意力' },
    },

    /** CPR 阶段顶栏标题。 */
    stepTitle: {
      s1: '第 1 步 · 呼救',
      s2: '第 2 步 · 判断意识',
      s3: '第 3 步 · 判断呼吸',
      s4: '第 4 步 · 胸外按压',
      s5: '第 5 步 · 人工呼吸',
      aed: 'AED 介入',
      loop: '循环 · 持续救护',
      ongoing: 'CPR 进行中',
    },

    step1: {
      action: { drill: '演习 · 系统模拟调度中', real: '系统调度中 · 您只管准备按压' },
      quote: '"系统已调度！现场清空，准备按压！"',
      taskCall: { drill: '【演习】模拟拨打 120', real: '120 已自动呼叫' },
      taskCallSubDrill: '（本次不会真实呼叫）',
      taskCallSubReal: '已发送您的精准位置',
      taskVolunteers: { drill: '【演习】模拟通知 5km 内志愿者', real: '5km 内 8 名志愿者已通知' },
      taskVolunteersSub: '最近模拟距离 240m · 预计 3 分钟',
      taskTeam: { drill: '【演习】3 名志愿者角色已模拟分配', real: '3 名志愿者小队已分工响应' },
      taskTeamSub: '压缩手 240m · AED 手 100m · 记录员 310m',
      taskHelper: '点这里 · 让现场路人扫码协助',
      /** `v-html`：整句含 `<strong>`，不可拆分拼装。 */
      detail: {
        drill: '<strong style="color:#FF8B5B;">本次为演习，不会真实调度资源</strong>——请跟着语音指令熟悉完整 CPR 流程。<br>放下手机，跟着语音指引准备开始按压。',
        real: '<strong style="color:#FF8B5B;">您不用自己去找 AED</strong>——系统已同步调度压缩、AED 与记录协作角色。<br>放下手机，跟着语音指引准备开始按压。',
      },
      start: '已喊人 · 立即开始',
    },

    step2: {
      action: '判断意识 · 5 秒',
      quote: '"喂！你怎么啦？"',
      detail: '拍打患者两侧肩膀，在耳边大声呼喊。观察是否有反应。',
      pause: '有反应 · 暂停',
    },

    step3: {
      action: '判断呼吸 · 默数 7 秒',
      detail: '把脸贴近患者口鼻，同时看胸口起伏、听呼吸。',
      pause: '有正常呼吸 · 暂停',
    },

    /** 步骤4：胸外按压。 */
    cpr: {
      totalLabel: '总坚持',
      roundLabel: '本组',
      roundsLabel: '完成组数',
      /** 节拍器主数字：**未开始**时显示的字样（开始后显示 `0`..`30` 数字，不翻译）。 */
      pressNumIdle: '准备',
      /**
       * 节拍器副标签的三档状态（`pressLabelState` 驱动）。
       * ⚠️ 代码里是**动态拼 key**（`rescue.cpr.pressLabel.${state}`），静态扫描器抓不到
       * ⇒ `rescue-i18n.test.ts` 里**显式枚举**这三个 key 断言可解析。
       */
      pressLabel: {
        idle: '点圆圈可重置',
        hint: '跟屏幕数字按压',
        reset: '已重置',
      },
      keyNum: '按压要点',
      keyText: '双掌交叠 · 胸骨中下段 · 下压 5-6cm',
      /** `v-html`：整句含 `<strong>`。 */
      keyDetail: '手臂保持<strong style="color:#FF8B5B;">伸直</strong>，借上半身重量。',
      callHelper: '叫人协助',
      aedReady: 'AED 连好了',
      media: '拍照/录像 · 发送现场情况给 120',
    },

    /** AED 阶段三档（0 分析 / 1 建议电击 / 2 电击完成）。 */
    aed: {
      label0: 'AED 分析中 · 停止按压',
      label1: 'AED 建议电击 · 再次离开',
      label2: '电击完成 · 立即恢复按压',
      quote0: '所有人离开患者！',
      quote1: '"离开！按下电击键！"',
      quote2: '"立即按压！"',
      /** `v-html`：含 `<strong>`。仅 phase 2 有内容，其余为空串（由代码控制，非翻译）。 */
      detail2: '电击已完成。<strong style="color:#FF8B5B;">不要等待心跳</strong>，立即从 1 开始重新按压 30 次。',
      cancel: '取消 · 继续按压',
    },

    /** 步骤5：人工呼吸。 */
    vent: {
      actionLabel: '人工呼吸 · {round} / 2',
      round1: '第 1 次',
      round2: '第 2 次',
      s1: { title: '仰头抬下巴', sub: '让气道打开' },
      s2: { title: '检查口腔', sub: '清除可见异物' },
      s3: { title: '捏住鼻子', sub: '嘴包嘴密封' },
      s4: { title: '吹一口气', sub: '看到胸部鼓起即可' },
    },

    loop: {
      actionLabel: '完成 {rounds} 个 CPR 循环',
      quote: '继续 30 按压 + 2 人工呼吸',
      /** `v-html`：含 `<strong>`。 */
      detail: '持续循环到 120 急救员到达。<strong style="color:#FF8B5B;">不要停下！</strong>',
      start: '立即开始下一组',
    },

    /** 确认弹层（BottomSheet）。 */
    confirm: {
      title: { drill: '⚠️ 演习模式 · 免责确认', real: '⚠️ 责任与义务确认' },
      drillTitle: '本次为演习，不会真实拨打 120',
      drillDesc: '请放心按照语音指引完成全流程练习',
      body: {
        drill: '您即将进入 CPR 心肺复苏流程演习。系统将模拟呼叫 120、通知附近志愿者等操作，帮助您熟悉真实急救场景下的每一步。',
        real: '您即将启动真实紧急救援流程。系统将自动呼叫 120、通知附近志愿者，并记录本次触发的时间与账号用于反滥用（不记录精确位置）。',
      },
      check: {
        drill: '我已理解这是演习模式，不会真实拨打 120',
        real: '我已阅读并理解《善意救助免责声明》',
      },
      /** 勾选项文案的**固定后缀**（与两种 check 文案拼接，故独立成 key）。 */
      lawSuffix: '（《民法典》第 184 条）',
      start: { drill: '开始 CPR 演习', real: '确认启动 CPR' },
    },

    /** `uni.showToast` 文案（含 `abort()` 的中断提示）。 */
    toast: {
      drillCall: '演习模式 · 不会真实呼叫 120',
      calling: '正在呼叫 120...',
      drillPaused: '演习暂停',
      paused: '已暂停',
      /** `{state}` = 暂停档，`{reason}` = 中断原因；**整句一个 key**（分隔符随语言变化）。 */
      abortedWithReason: '{state}：{reason}',
      reason: {
        responded: '有反应',
        breathing: '有正常呼吸',
      },
    },

    /**
     * 语音**整句**（设计 §10.2 收口：P0-2 只本地化了计数词，整句仍是中文）。
     * ⚠️ 这是**朗读文本**：标点习惯与屏幕文案不同 —— zh 用「。」断句，en 用自然停顿。
     */
    voice: {
      step1Drill: '演习模式。系统已模拟调度。现场清空，准备按压。',
      step1: '系统已调度。现场清空，准备按压。',
      step2: '拍打患者两侧肩膀，在耳边大声呼喊。观察是否有反应。',
      aed0: '所有人离开患者。AED 正在分析心率。',
      aed1: '离开。按下电击键。',
      step5: '仰头抬下巴，让气道打开。检查口腔，清除可见异物。捏住鼻子，嘴包嘴密封，吹一口气。',
      loop: '继续三十次按压，加两次人工呼吸。不要停下。',
    },
  },

  /**
   * `pages/guide/index.vue` —— 急救知识**分步指引详情页**（独立页面）。
   *
   * ⚠️ 与 `rescue.guides.*` 的区别（勿混用）：
   * `rescue.guides` 是决策页上跳转过来的**入口卡片**（只有 `title` / `desc`）；
   * 本域是**指引页自身**的完整内容（标题 + 逐步 `title`/`detail` + 注意事项），
   * 且多一个 `seizure`（癫痫急救）。二者语义相近但**职责不同**，故各自独立成域。
   *
   * ⚠️ `guides.<type>.steps` 是**索引键对象**（`s1`..`sN`），**不是"对象数组"**：
   * §3.3 不变量要求叶值 = 非空字符串 / 非空字符串数组。写成对象数组会**同时丢掉两层守卫**：
   * ① 类型层（`en-US: MessageSchema`）看不到数组**长度** ⇒ en 少一项不报错；
   * ② `i18n.test.ts` 的 `en ⊇ zh` 键完整性把整个数组当**一个叶** ⇒ 看不到内部逐项。
   * 页面侧用 `computed` 把 `s1`..`sN` **组装成有序数组**再渲染（照 P0-3 `ventSteps` 模式）。
   */
  guide: {
    /** 步骤徽标：`第 {n} 步`。 */
    stepTag: '第 {n} 步',
    navPrev: '← 上一步',
    navNext: '下一步 →',
    navDone: '✓ 完成',
    /** 注意事项折叠开关。 */
    warnToggle: '⚠️ 注意事项',
    call: '呼叫 120',
    legal: '🛡 善意救助免责 · 《民法典》184 条',
    /** `uni.showToast`：演示模式呼叫提示。 */
    toastCalling: '演示模式：正在呼叫 120...',
    /**
     * 语音**整句**：当前步骤的 `title` + `detail` 合成一句朗读。
     * ⚠️ 必须**整句一个 key + 具名插值**（§3.3 第 4 条）：连接符随语言变化
     * （zh 用「，」，en 用 `, `），**禁止**在代码里 `title + '，' + detail` 拼装。
     */
    voice: {
      step: '{title}，{detail}',
    },
    /** 6 类急救场景的完整指引（`type` 与路由参数一致）。 */
    guides: {
      bleeding: {
        title: '大出血',
        steps: {
          s1: { title: '直接压迫止血', detail: '用干净纱布或毛巾用力按压伤口' },
          s2: { title: '抬高受伤部位', detail: '将出血部位抬高至心脏水平以上' },
          s3: { title: '加压包扎固定', detail: '用绷带紧紧缠绕，但不要过紧' },
          s4: { title: '勿移除浸透敷料', detail: '在上面叠加新的，不要揭开旧的' },
          s5: { title: '止血带（最后手段）', detail: '扎在伤口近心端 5-7cm 处，记录时间' },
        },
        warnings: ['戴手套或塑料袋隔离，勿直接接触血液', '异物刺入体内不要拔除，周围垫高固定', '密切观察面色呼吸，休克迹象告知 120'],
      },
      heimlich: {
        title: '异物窒息',
        steps: {
          s1: { title: '确认窒息', detail: '患者无法说话、双手抓喉、面色发紫' },
          s2: { title: '站到背后环抱', detail: '一只手握拳，置于肚脐上方两指处' },
          s3: { title: '向上冲击腹部', detail: '另一只手抓拳，快速向内向上冲击 ×5 次' },
          s4: { title: '检查口腔', detail: '每次冲击后查看口腔，有异物则取出' },
          s5: { title: '交替循环', detail: '5 次冲击 + 检查口腔，重复至异物排出' },
          s6: { title: '失去意识 → CPR', detail: '平放患者，立即胸外按压并呼叫 120' },
        },
        warnings: ['孕妇/肥胖者改为胸部冲击（握拳置胸骨中段）', '婴儿：5 次拍背 + 5 次压胸交替', '能咳嗽的患者鼓励继续咳，不要干预'],
      },
      fracture: {
        title: '骨折外伤',
        steps: {
          s1: { title: '不要移动患者', detail: '除非现场有立即危险，保持原位不动' },
          s2: { title: '夹板固定', detail: '用木板/杂志固定骨折处上下两个关节' },
          s3: { title: '垫软物缓冲', detail: '夹板与身体间用衣物垫好，避免压迫' },
          s4: { title: '悬吊固定上肢', detail: '手臂骨折用三角巾做悬吊，保持水平' },
          s5: { title: '冷敷消肿', detail: '冰袋敷伤处周围，每次 15-20 分钟' },
        },
        warnings: ['疑似脊柱损伤：严禁移动！保持头颈躯干直线', '开放性骨折：不要试图推回骨头', '不要给患者进食饮水（可能需急诊手术）'],
      },
      transport: {
        title: '伤员搬运',
        steps: {
          s1: { title: '评估现场安全', detail: '确保自身安全后再接近，仅必要时移动' },
          s2: { title: '固定头颈', detail: '一人双手夹住耳朵，保持头颈躯干直线' },
          s3: { title: '多人同步翻身', detail: '一人喊口令，所有人整体轴向翻动' },
          s4: { title: '硬板转移', detail: '用门板/桌面贴紧一侧，轴向滚到板上' },
          s5: { title: '全身固定', detail: '绷带固定额头→胸部→骨盆→大腿→小腿' },
        },
        warnings: ['脊柱损伤绝对禁止：扶起、抱起、抬头抬脚', '搬运途中保持平稳避免颠簸', '密切观察呼吸意识，随时准备 CPR'],
      },
      psychological: {
        title: '紧急心理干预',
        steps: {
          s1: { title: '确保安全', detail: '带离危险环境，保障基本需求（水、保暖）' },
          s2: { title: '温柔接触', detail: '平静语调，自报身份，蹲下同高度' },
          s3: { title: '倾听不打断', detail: '允许所有情绪，不说"别哭""坚强点"' },
          s4: { title: '提供确定信息', detail: '告知现状/谁在帮忙/接下来如何' },
          s5: { title: '转移注意力', detail: '深呼吸 → 握拳放松 → 说出 3 样看到的东西' },
        },
        warnings: ['不要强迫回忆创伤细节', '不做无法兑现的承诺', '出现严重精神症状时保护自身安全并求助'],
      },
      seizure: {
        title: '癫痫急救',
        steps: {
          s1: { title: '保持冷静计时', detail: '记录发作开始时间。超过 5 分钟呼叫 120' },
          s2: { title: '清除危险物', detail: '移开尖锐硬物，头部下方垫软物' },
          s3: { title: '不要按住患者', detail: '不压四肢不阻止抽搐，不往嘴里塞东西' },
          s4: { title: '侧卧位恢复', detail: '抽搐停止后转侧卧位，便于排出分泌物' },
          s5: { title: '守在旁边', detail: '发作后可能意识模糊，温和安抚告知' },
        },
        warnings: ['绝对不要往嘴里塞任何东西', '不要强行喂水喂药', '超过 5 分钟/连续发作/水中/孕妇/首次 → 120'],
      },
    },
  },

  /**
   * `pages/aed/index.vue` —— **独立 AED 探索地图页**（演习横幅 / 探索进度 / 附近雷达 / 快速预览）。
   *
   * ⚠️ 与 `rescue.aed.*` 的区别（勿混用）：`rescue.aed` 是 SOS 流程内**内联的 AED 阶段**
   * （分析 / 建议电击 / 电击完成三档提示）；本域是**独立的 AED 地图页**，二者无关。
   */
  aed: {
    /** 顶部演习横幅。 */
    drillBanner: '演习模式 · 探索 AED 随时可取',
    home: '首页',
    /** 探索者身份行 `{tier} 探索者` 的固定后缀。 */
    explorerTier: '探索者',
    /**
     * 等级名（与 `user.profile.tier` 取值一致）。
     * ⚠️ 本页自渲染等级，**不复用** `userStore.tierLabel`（后者只返回中文，会让英文界面出现中文）；
     * 未在表内的 tier 渲染空串（与原 `tierLabel` 的 `|| ''` 行为一致）。
     */
    tier: { gold: '金牌', silver: '银牌', bronze: '铜牌', diamond: '钻石' },
    /** 探索进度：`{discovered} / {total} 台已发现`（整句一个 key，禁止拼装）。 */
    progress: '{discovered} / {total} 台已发现',
    /** 地图浮标：`{count} 台 AED 在附近`。 */
    nearby: '{count} 台 AED 在附近',
    radarTitle: '🔭 附近雷达',
    /** AED 状态标签（`status`：available / maintenance / in_use；本页把非 available 一律显示"维护中"）。 */
    status: { available: '可用', maintenance: '维护中' },
    viewDetail: '查看详情',
    checkIn: '📸 打卡',
    /** 地点标签：`indoor` 为 false 时显示。 */
    outdoor: '户外',
  },
}
