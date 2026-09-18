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
    /** P0-1 收尾：写操作被服务端拒绝（403）时的可见反馈（此前静默/假成功）。 */
    noPermission: '无权执行此操作',
    /** P0-1 收尾：写操作失败但非权限问题的通用可见反馈。 */
    actionFailed: '操作失败，请稍后重试',
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

    /**
     * `pages/aed/detail.vue` —— AED **设备详情页**（与地图页 `pages/aed/index.vue` 同域不同页）。
     *
     * ⚠️ 后端返回的**展示数据**（`aed.name` / `address` / `model` / `findingInstructions` /
     * 打卡记录 `ci.userName` / `ci.comment` / 责任人 `custodian.*`）**不在本期范围**，
     * 见设计 §13 D6 / §13.1。本域只覆盖**前端静态文案**。
     * ⚠️ 写进后端的**审计 payload**（取用 `notes` / 打卡 `comment`）刻意**不在**本域，
     * 见 `src/constants/audit-notes.ts`（设计 §13 D3）。
     */
    detail: {
      /** `indoor` 为 false 时的地点标签。 */
      outdoor: '户外',
      nav: '导航前往',
      checkin: '打卡验证',
      retake: '重拍',
      checkinFormTitle: '📋 填写打卡信息',
      checkinPhotoTitle: '📸 正在拍照…',
      statusOk: '✅ 设备完好',
      statusIssue: '⚠️ 有问题',
      tipLabel: '💡 找设备提示（帮助其他人快速定位）',
      tipPlaceholder: '例如：从南门进，保安亭左侧绿色箱子…',
      submit: '提交打卡',
      howToFind: '🔍 如何找到',
      deviceInfo: '🔬 设备信息',
      /** 设备信息网格的字段名。 */
      label: {
        model: '型号',
        serial: '编号',
        batteryExpiry: '电池有效期',
        electrodeExpiry: '电极片有效期',
        lastMaintenance: '最近维护',
        lastCheck: '最近打卡',
      },
      /** 责任人卡片（含前端自写兜底文案，见设计 §13 D4）。 */
      custodian: {
        title: '👤 设备责任人',
        /** 头像占位字符（无 custodian 快照时）。 */
        avatarFallback: '侠',
        nameFallback: '平台登记责任人',
        roleFallback: '联系方式经确认授权后可见',
        notify: '📞 通知责任人',
      },
      /** 责任人联动状态卡。 */
      link: {
        title: '📣 责任人联动',
        pickup: '登记取用（先取用后留痕）',
        statusLabel: '状态',
        countdownLabel: '倒计时',
        confirmPickup: '确认取用',
        withdraw: '撤回信息共享',
        note: '「确认授权」仅表示责任人已知晓并同意取用，不会远程改变设备状态。',
        noCustodian: '该设备暂无责任人，可直接取用并留痕。',
      },
      /** 打卡时间线（`{n}` = 记录条数）。 */
      timeline: {
        title: '📋 打卡记录（{n}）',
        ok: '✅ 完好',
        issue: '⚠️ 有问题',
        emptyTitle: '📋 打卡记录',
      },
      empty: {
        title: '尚无打卡记录',
        sub: '成为第一个打卡验证的急救侠！',
      },
      /** 顶部状态徽标（`statusLabel`）。 */
      status: {
        maintenance: '🔧 维护中',
        verified: '✅ 已验证',
        discovered: '📍 已发现',
        available: '⚡ 可用',
      },
      /** 责任人联动**状态文本**（`caStatusText`，与 store `status` 取值对应）。 */
      ca: {
        sent: '已通知责任人，等待确认授权',
        pending: '正在通知责任人…',
        unreachable: '未能触达责任人（待其主动确认）',
        acknowledged: '责任人已确认授权，请取用 AED',
        rejected: '责任人已拒绝，可直接取用并留痕',
        expired: '责任人未在时限内响应，可直接取用并留痕',
        timeout: '已超时',
      },
      /** PIPL 信息共享同意弹窗（`uni.showModal` 的 title/content/confirmText）。 */
      consent: {
        title: '信息共享同意',
        content: '为帮助现场急救联络，将把你的姓名与位置共享给该 AED 责任人。你可随时在求助详情中撤回。是否同意？',
        confirm: '同意',
      },
      /** 设备未找到页。 */
      notFound: {
        title: '设备未找到',
        sub: '该 AED 设备可能已被移除或链接无效',
        back: '返回 AED 地图',
      },
      /** `uni.showToast` 文案。 */
      toast: {
        cameraDenied: '相机权限未开启',
        checkinOk: '✅ 打卡成功 +30⭐',
        checkinIssue: '⚠️ 已上报问题 +15⭐',
        consentCancelled: '已取消，可直接取用 AED',
        notified: '已通知责任人',
        consentRequired: '需先同意信息共享',
        /**
         * D1（设计 §13）：**后端** `res.message` 为空或非 zh-CN 时的本地化通用兜底。
         * ⚠️ 后端 message 恒为中文（`未登录` / `请求过于频繁`…），en-US 下必须走本文案。
         */
        notifyFailed: '通知失败',
        pickupOk: '已登记取用，请尽快取用设备',
        pickupFailed: '取用登记失败，请直接取用设备',
        withdrawOk: '已撤回信息共享',
        withdrawFailed: '撤回失败',
      },
    },
  },

  /**
   * `pages/drill/index.vue` —— 急救演习列表页（即将开始 / 已完成 / 训练记录）。
   *
   * ⚠️ 后端 / 用户数据（演习 `title` / `description` / `location` / `organizerName`、
   * 训练记录 `notes`、组织者名）**不在本期范围**，见设计 §13 D6 / §13.1。
   * 本域只覆盖前端静态文案 + 前端自写的表单默认值（D5）。
   */
  drill: {
    title: '急救演习',
    /** 顶部分类页签。 */
    tab: { upcoming: '即将开始', completed: '已完成', records: '训练记录' },
    join: '🤝 报名',
    complete: '✅ 完成演习',
    /** 演习状态标签（`statusLabel`，与 `d.status` 取值对应）。 */
    status: { upcoming: '即将开始', completed: '已完成' },
    /** 场景标签（`scenarioLabel`，与 `d.scenario` 取值对应）。 */
    scenario: {
      cpr: 'CPR 心肺复苏',
      aed: 'AED 使用',
      trauma: '创伤急救',
      choking: '异物窒息',
      mass: '群体伤',
    },
    /** 人数：`{current}/{max} 人`（整句一个 key，禁止拼装）。 */
    participants: '{current}/{max} 人',
    /** 积分奖励：`🎁 +{points} 分`。 */
    pointsReward: '🎁 +{points} 分',
    /** 训练记录卡片的状态标签。 */
    recordTrained: '已训练',
    /** 训练记录组织者行：`组织者: {name}`（`{name}` 为后端数据）。 */
    organizerLine: '组织者: {name}',
    /** 空列表文案。 */
    empty: { completed: '暂无已完成演习', upcoming: '暂无演习', records: '暂无训练记录' },
    /** 发起演习弹窗（D5：`defaultLocation` 是前端默认输入值，为过裸 CJK 守卫而抽 key）。 */
    form: {
      title: '发起演习',
      label: {
        title: '标题',
        description: '描述',
        scenario: '场景',
        date: '日期',
        location: '地点',
        maxParticipants: '人数上限',
      },
      defaultLocation: '深圳湾公园',
      submit: '发起',
    },
    /** `uni.showToast` 文案。 */
    toast: { joined: '已报名', pointsAwarded: '积分已发放', created: '已创建' },
  },

  /**
   * tabBar 4 个 tab 的文字（`uni.setTabBarItem`）。
   *
   * ⚠️ **值必须与 `pages.json` 的 `tabBar.list[].text` 逐字一致**（zh 侧）：
   * `pages.json` 是静态声明、**不在 Vue 响应式树内** ⇒ 语言切换时它**不会**自动更新，
   * 必须由 `src/utils/tabbar-locale.ts` 显式调 `uni.setTabBarItem` 同步。
   * 键名固定 4 个（顺序 / pagePath 见 `TABBAR_ITEMS`），与 `tabBar.list` 一一对应。
   */
  tabbar: {
    home: '首页',
    /** 专有名词，两种语言都不翻译。 */
    aed: 'AED',
    learn: '学习',
    mine: '我的',
  },

  /**
   * 原生导航栏标题（`uni.setNavigationBarTitle`）—— 只收录**文案已本地化**的页面。
   *
   * ⚠️ 值必须与 `pages.json` 里对应页的 `style.navigationBarTitleText` **逐字一致**，
   * 否则切回中文时标题会"变样"（该对齐关系由 `src/__tests__/nav-title-locale.test.ts` 守护）。
   * ⚠️ `rescue` / `guide` / `aed/detail` 是 `navigationStyle: 'custom'`（自绘导航栏、
   * 无原生标题栏）⇒ **不在此组**。
   */
  nav: {
    aedIndex: '附近 AED',
    drill: '急救演习',
    mine: '我的徽章',
    hours: '我的服务时长',
    serviceCert: '我的服务证明',
  },

  /**
   * `pages/cert/index.vue` —— 「我的」页（tabBar 第 4 项）。
   *
   * ⚠️ 语言切换入口放在本域（PRD §8 / 设计 §3.2 第 3 条）：**不得进 SOS 主流程**。
   * ⚠️ `tierLabel` 现由本域 `mine.tier.*` 驱动且**必须在 `computed` 内调 `t()`** ——
   * 模块级字面量映射只求值一次 ⇒ 语言冻结（设计 §11.1）。
   */
  mine: {
    /** 顶部资料统计三格（`label` 为固定后缀）。 */
    statRescues: '参与救援',
    statPoints: '积分',
    statCerts: '认证',
    /** 证书卡：`{tier} 急救侠`（整句 + 具名插值，禁止代码拼接）。 */
    certTier: '{tier} 急救侠',
    certFallbackName: '急救认证',
    issuer: '急救侠平台认证',
    certsHeld: '持有证书',
    /**
     * 计数单位：`{n} 项`（证书数，两处复用）/ `{n} 次`（救援数、打卡数）。
     * 抽成整体而非「数字 + 单位」拼接（§3.3 第 4 条）。
     */
    certCountValue: '{n} 项',
    countTimes: '{n} 次',
    level: '等级',
    /** 无认证时的证书卡。 */
    newcomer: '新人',
    noCert: '暂无认证',
    noCertHint: '完成培训即可获得认证',
    /** 电子证书 QR 卡。 */
    qrTitle: '电子证书验证',
    qrDesc: '扫码可在线验证证书真伪及志愿者资质',
    /** 功能入口网格（`actions.*` = 标题，`*Sub` = 副标题）。 */
    actions: {
      certs: '认证记录',
      rescueStats: '救援统计',
      leaderboard: '排行榜',
      manual: '急救手册',
      interests: '兴趣方向',
      uploadCert: '登记证书',
      pushSettings: '通知设置',
      org: '机构管理',
    },
    manualSub: '6 种急症',
    interestsSub: '选择你的模块',
    uploadCertSub: '上传已有认证',
    pushSettingsSub: '推送订阅管理',
    /** 底部按钮 / 弹层 / toast。 */
    logout: '退出登录',
    changePwd: '修改密码',
    /** `uni.showModal` 认证记录弹层的固定说明（标题复用 `actions.certs`）。 */
    certsModalBody: '所有认证均在有效期内。',
    gotIt: '知道了',
    toastLoggedOut: '已退出登录',
    /** AED 打卡区块。 */
    checkinTitle: '我的 AED 打卡',
    checkinEmpty: '还没有 AED 打卡记录',
    checkinExplore: '去探索 AED →',
    /** 未登录（游客）引导。 */
    guestTitle: '登录后解锁全部功能',
    guestDesc: '管理证书 · 参与救援 · 加入社区',
    guestBtn: '立即登录',
    /**
     * 等级名（与 `user.profile.tier` 取值一致）。
     * 未收录的 tier **回落原始值**（保持原 `|| tier` 行为）；键必须与 `tier` 取值对齐。
     */
    tier: { gold: '金牌', silver: '银牌', bronze: '铜牌', diamond: '钻石' },
    /** 语言切换入口。**各语言下都写语言自己的名字**（自名，便于用户辨认，故 en 下也会出现中文）。 */
    lang: {
      title: '语言',
      zh: '简体中文',
      en: 'English',
      switched: '已切换为{lang}',
    },
  },
  /**
   * F4 P0-3：「我的服务时长」。
   * ⚠️ 措辞（用户已拍板）：**不得**出现「符合国家标准 / 国标 / 官方」；证明一律表述为「平台出具、非实名认证」。
   */
  hours: {
    title: '我的服务时长',
    total: '累计服务时长',
    minutes: '{n} 分钟',
    breakdownTitle: '分项',
    detailTitle: '服务明细',
    empty: '暂无服务记录',
    loadFailed: '加载服务时长失败',
    generate: '生成证明',
    exportCsv: '导出 CSV',
    retry: '重试',
    prev: '上一页',
    next: '下一页',
    page: '第 {page} 页',
    /** 分项来源（与后端 `activity_type` 取值一致）。P0 实际只有 `rescue_task`，布局须数据驱动。 */
    activity: {
      rescue_task: '救援任务',
      drill: '演练',
      training: '培训',
      aed_checkin: 'AED 巡检',
      manual: '人工登记',
    },
  },
  /** F4 P0-4：证明生成 / 列表 / 打印 / 编号验真 / 自撤。 */
  serviceCert: {
    title: '我的服务证明',
    docTitle: '志愿服务记录证明（急救侠平台出具）',
    disclaimer: '本证明由平台出具，非实名认证',
    empty: '暂无证明',
    generate: '生成证明',
    generating: '生成中…',
    createFailed: '生成证明失败',
    period: '{from} 至 {to}',
    totalMinutes: '共 {n} 分钟',
    print: '打印 / 导出 PDF',
    revoke: '撤销',
    revokeConfirm: '确定撤销该证明？撤销后本证明不再生效。',
    revoked: '该证明已撤销',
    revokeFailed: '撤销证明失败',
    verifyTitle: '证明编号验真',
    verifyPlaceholder: '输入证明编号',
    verify: '验真',
    verifyValid: '证明有效',
    verifyRevoked: '该证明已作废',
    verifyNotFound: '未找到该编号对应的证明',
    verifyFailed: '验真失败，请稍后重试',
    rangeFrom: '起始日期',
    rangeTo: '结束日期',
    rangeHint: '格式 YYYY-MM-DD',
    invalidRange: '日期格式或区间不正确',
    listTitle: '我的证明',
    verifyInputLabel: '证明编号',
    printHint: '请在浏览器中打印',
    loadFailed: '加载服务证明失败',
  },
}
