/**
 * 新闻 API — Mock（视频/图集/直播/志愿者故事）
 */

export interface NewsAuthor {
  name: string
  avatar: string
  isVolunteer: boolean
  rescueCount?: number
  badge?: string
}

export interface NewsStats {
  views: number
  likes: number
  comments: number
  shares?: number
}

export interface LiveStats {
  volunteers: number
  duration: string
  status: 'ongoing' | 'completed'
}

export interface NewsItem {
  id: string
  type: 'video' | 'photo' | 'live' | 'story' | 'article' | 'map'
  title: string
  excerpt: string
  body?: string
  coverImage?: string
  videoUrl?: string
  videoDuration?: string
  photos?: string[]
  mapCenter?: { lat: number; lng: number }
  mapMarkers?: Array<{ lat: number; lng: number; label: string }>
  location: { name: string; distance?: number }
  time: string
  author?: NewsAuthor
  stats: NewsStats
  tags: string[]
  isLive?: boolean
  liveStats?: LiveStats
  featured?: boolean
  category: 'recommend' | 'video' | 'nearby' | 'volunteer'
  /** 关联的救援案例 ID，用于跳转到 case-detail 结构化案例页 */
  caseId?: string
}

const MOCK_NEWS: NewsItem[] = [
  // === 直播救援 ===
  {
    id: 'live_001',
    type: 'live',
    title: '直播 · 深圳湾公园心脏骤停救援',
    excerpt: '3 名急救侠已响应，1 人正在 CPR 按压，AED 已送达现场。系统持续更新救援进展…',
    body: '下午 3 点 12 分，深圳湾公园南门附近一名约 50 岁男性突然倒地失去意识。\n\n3 点 13 分，急救侠系统通过智能调度，向事发地 1km 内的 8 名注册志愿者同时发送求助通知。\n\n3 点 14 分，3 名志愿者确认响应：王志愿（CPR 按压手，距离 240m）、张急救（AED 手，距离 100m）、赵老师（记录员，距离 310m）。\n\n3 点 17 分，张急救携带 AED 到达现场，设备开机并完成电极片贴附。\n\n3 点 18 分，AED 分析建议电击，一次电击后患者恢复自主心律。\n\n3 点 25 分，120 急救车到达，患者被送往南山医院进一步治疗。\n\n本次救援从系统响应到 AED 电击仅用时 5 分钟，远低于全国平均 8.2 分钟的院外救援响应时间。',
    coverImage: '/static/news/live_rescue.png',
    location: { name: '深圳湾公园南门', distance: 1.2 },
    time: '2 分钟前',
    author: { name: '急救侠系统', avatar: '急', isVolunteer: false },
    stats: { views: 1240, likes: 89, comments: 23 },
    tags: ['正在救援', 'CPR', 'AED'],
    isLive: true,
    liveStats: { volunteers: 3, duration: '6 分钟', status: 'ongoing' },
    featured: true,
    category: 'recommend',
    caseId: 'case_park',
  },
  // === 短视频 ===
  {
    id: 'video_001',
    type: 'video',
    title: '60 秒学会胸外按压：真人演示正确手势与发力',
    excerpt: '两乳头连线中点，掌根交叠，手臂伸直，借上半身重量垂直下压 5-6 厘米。跟着节拍器练起来！',
    body: '胸外按压（CPR）是抢救心脏骤停患者最重要的技能。\n\n第一步：定位。找到两乳头连线的中点，即胸骨中下段。\n\n第二步：手势。双手掌根交叠，十指相扣，手臂完全伸直。\n\n第三步：发力。借上半身重量垂直下压，深度 5-6 厘米，频率 100-120 次/分钟。\n\n第四步：回弹。每次按压后让胸廓完全回弹，掌根不要离开胸壁。\n\n记住口诀：「用力压、快快压、少中断、全回弹」。每 30 次按压配合 2 次人工呼吸，持续循环直到 AED 到达或 120 接手。\n\n研究表明，高质量的胸外按压可以使院外心脏骤停的生存率提高 2-3 倍。现在就跟着视频练习吧！',
    coverImage: '/static/news/video_cpr.png',
    videoUrl: '/static/news/video_cpr.mp4',
    videoDuration: '01:02',
    location: { name: '深圳市急救培训中心' },
    time: '3 小时前',
    author: { name: '急救侠官方', avatar: '急', isVolunteer: false },
    stats: { views: 8920, likes: 1340, comments: 156, shares: 420 },
    tags: ['CPR教学', '视频教程', '急救技能'],
    category: 'video',
  },
  {
    id: 'video_002',
    type: 'video',
    title: 'AED 使用全流程：3 分钟从开机到电击',
    excerpt: '看完就会用！揭开盖子自动开机 → 贴电极片 → 听语音分析心律 → 按下电击键。全程跟练。',
    body: 'AED（自动体外除颤器）是普通人也能使用的救命设备，全程有语音提示。\n\n第一步：开机。打开 AED 盖子或按下电源键，设备会自动开机并开始语音引导。\n\n第二步：贴电极片。取出电极片，按照图示贴在患者裸露的胸部——一片在右锁骨下方，一片在左胸外侧。\n\n第三步：分析心律。AED 会自动分析患者心律，此时所有人必须离开患者。设备会判断是否需要电击。\n\n第四步：电击。如 AED 提示建议电击，确保无人接触患者后按下闪烁的电击按钮。\n\n第五步：立即恢复 CPR。电击后不要等待心跳恢复，立即从胸外按压开始，持续 2 分钟后再让 AED 分析。\n\n记住：AED 不会电击不需要电击的人，请放心使用！每延迟 1 分钟除颤，生存率下降 7-10%。',
    coverImage: '/static/news/video_aed.png',
    videoUrl: '/static/news/video_aed.mp4',
    videoDuration: '03:15',
    location: { name: '福田区 AED 培训点' },
    time: '昨天',
    author: { name: '急救侠官方', avatar: '急', isVolunteer: false },
    stats: { views: 6540, likes: 980, comments: 87 },
    tags: ['AED', '视频教程', '急救设备'],
    category: 'video',
  },
  // === 图集 ===
  {
    id: 'photo_001',
    type: 'photo',
    title: '福田 CBD 午休生死救援 · 全程影像记录',
    excerpt: '白领李先生用餐时突然倒地，同楼急救侠王女士 5 秒内响应。从 CPR 到 AED 电击，9 张照片还原救援全过程。',
    body: '中午12点15分，福田CBD太平金融大厦B1层餐厅，35岁的李先生用餐时突然倒地，面色青紫。正在同一楼层用餐的王志愿女士听到呼救声，立即冲向现场。作为急救侠金牌志愿者，她在5秒内完成评估：无意识、无呼吸、无脉搏——立即启动CPR。\n\n与此同时，大厦保安通过急救侠APP一键报警，系统自动向800米范围内的4名志愿者发出求助。3分钟后，另一名志愿者携带AED到达，电击一次后李先生恢复心跳。\n\n120急救车于12点28分到达，李先生被送往北大深圳医院。目前已脱离危险，家属通过APP向两位志愿者发来感谢信。\n\n这次救援再次证明：黄金4分钟内的CPR+AED，是心脏骤停患者存活的关键。',
    coverImage: '/static/news/photo_rescue.png',
    photos: [
      '/static/news/photo_rescue_1.png',
      '/static/news/photo_rescue_2.png',
      '/static/news/photo_rescue_3.png',
      '/static/news/photo_rescue_4.png',
    ],
    location: { name: '福田 CBD · 太平金融大厦' },
    time: '2026-05-01',
    author: { name: '现场记录员', avatar: '记', isVolunteer: true, rescueCount: 8, badge: '金牌' },
    stats: { views: 3450, likes: 567, comments: 89 },
    tags: ['成功案例', '图集', 'CBD'],
    category: 'recommend',
  },
  {
    id: 'photo_002',
    type: 'photo',
    title: 'AED 设备巡检日：志愿者的一天',
    excerpt: '每月 15 日是急救侠 AED 巡检日，跟随志愿者张急救的脚步，看看 AED 日常维护都做些什么。',
    body: '每月15日是急救侠志愿者网络的「AED巡检日」。这一天，分布在深圳各片区的志愿者会对自己负责的AED设备进行全面检查。\n\n早上9点，金牌志愿者张急救从科技园出发，今天他要巡检片区内的8台AED。每个巡检点需要完成：检查设备外观是否完好、确认电源指示灯正常、检查电极片有效期、清洁设备表面、拍照打卡上传系统。\n\n「很多人不知道，AED的电极片有2-3年的有效期，过期后导电性能会下降。」张急救边检查边记录，「我们的巡检数据会实时同步到急救中心，确保每一台AED随时可用。」\n\n上午11点半，8台AED全部巡检完毕。系统显示，深圳全市今日共有237名志愿者完成了1,892台AED的巡检，设备完好率达99.6%。',
    coverImage: '/static/news/photo_patrol.png',
    photos: [
      '/static/news/photo_patrol_1.png',
      '/static/news/photo_patrol_2.png',
      '/static/news/photo_patrol_3.png',
    ],
    location: { name: '南山区 · 科技园片区' },
    time: '2026-04-15',
    author: { name: '张急救', avatar: '张', isVolunteer: true, rescueCount: 12, badge: '金牌' },
    stats: { views: 2180, likes: 340, comments: 45 },
    tags: ['AED巡检', '图集', '志愿者日常'],
    category: 'volunteer',
  },
  // === 地图热点 ===
  {
    id: 'map_001',
    type: 'map',
    title: '本月救援热力图：深圳心脏骤停高发区域',
    excerpt: '过去 30 天全市共发生 89 起心脏骤停事件。深圳湾公园、华强北、科技园为高发区域。点击查看你身边的救援热点。',
    body: '急救侠数据团队发布2026年4月深圳心脏骤停救援热力图。数据显示，过去30天全市共接到89起心脏骤停求助，平均每日约3起。\n\n高发区域TOP3：深圳湾公园（12起）、华强北商圈（9起）、科技园片区（8起）。其中深圳湾公园的高发时间段集中在周末下午，可能与户外运动人群密集有关。\n\n值得关注的是，89起事件中，有67起在急救侠志愿者到达前已有旁观者启动CPR，志愿者响应中位时间仅3.2分钟，AED在5分钟内送达率达78%。\n\n数据团队建议：深圳湾公园和深圳湾体育中心应在高峰期增派志愿者驻点，华强北商圈可考虑在电子市场各楼层增设AED设备。',
    coverImage: '/static/news/map_heat.png',
    mapCenter: { lat: 22.543, lng: 114.058 },
    mapMarkers: [
      { lat: 22.516, lng: 113.946, label: '深圳湾' },
      { lat: 22.547, lng: 114.085, label: '华强北' },
      { lat: 22.538, lng: 113.956, label: '科技园' },
    ],
    location: { name: '深圳市' },
    time: '2026-05-03',
    author: { name: '急救侠数据团队', avatar: '数', isVolunteer: false },
    stats: { views: 5670, likes: 234, comments: 67 },
    tags: ['数据报告', '热力图', '救援分布'],
    category: 'recommend',
  },
  // === 志愿者故事 ===
  {
    id: 'story_001',
    type: 'story',
    title: '从路人到金牌急救侠：王志愿的 12 次救援',
    excerpt: '两年前在地铁站目睹有人倒地却束手无策，王志愿下决心学习急救。如今他已成功参与 12 次救援，成为深圳急救侠金牌志愿者。',
    body: '两年前的一个普通工作日，王志愿在地铁站目睹一名中年男子倒地。人群围了一圈，有人打120，有人在喊「有没有医生」，但没有一个人上前施救。\n\n「我当时完全不知道该怎么办，只能干着急。」王志愿回忆道，「那种无力感至今难忘。」当天晚上，他就在网上搜索急救培训，第二天报名了红十字会的CPR+AED认证课程。\n\n拿到证书后，王志愿注册成为急救侠志愿者。第一次响应是在培训后的第三周——科技园附近一名快递员中暑倒地。他按照训练流程评估、按压，直到120到达。\n\n两年来，王志愿参与了12次救援，全部成功。他说：「急救不是什么高深的技能，普通人花半天时间就能学会。你永远不知道，下一个倒下的会不会是你的亲人。」',
    coverImage: '/static/news/story_wang.png',
    location: { name: '深圳 · 南山区' },
    time: '2026-04-28',
    author: { name: '王志愿', avatar: '王', isVolunteer: true, rescueCount: 12, badge: '金牌' },
    stats: { views: 4320, likes: 890, comments: 134 },
    tags: ['志愿者故事', '金牌', '人物'],
    category: 'volunteer',
  },
  {
    id: 'story_002',
    type: 'story',
    title: '退休医生陈阿姨：66 岁仍坚持每月巡检 20 台 AED',
    excerpt: '从三甲医院退休后，陈阿姨加入急救侠志愿者网络，负责南山片区的 AED 设备维护。她说："退休了没事干，能为大家做点事很开心。"',
    body: '66岁的陈阿姨是急救侠志愿者网络中年龄最大的活跃志愿者之一。退休前，她是深圳市人民医院急诊科的副主任医师，有30多年的急救经验。\n\n退休后，陈阿姨觉得自己「还能做点事」。2024年，她在社区公告栏看到急救侠招募志愿者的消息，立即报名。考虑到她的年龄，组织安排她负责南山片区的AED设备巡检和维护——这项工作不需要高强度体力，但需要细心和责任心。\n\n「每个月20台，一台都不能少。」陈阿姨说，「AED就像是救命稻草，必须保证随时能拉起来。」她还利用自己的专业知识，定期在社区开展急救培训，教街坊邻居基本的CPR技能。\n\n「退休了不是等着别人来照顾你，」陈阿姨笑着说，「我还能照顾别人呢。」',
    coverImage: '/static/news/story_chen.png',
    location: { name: '深圳 · 南山区' },
    time: '2026-04-20',
    author: { name: '陈阿姨', avatar: '陈', isVolunteer: true, rescueCount: 5, badge: '银牌' },
    stats: { views: 3890, likes: 1200, comments: 203 },
    tags: ['志愿者故事', '银牌', 'AED维护'],
    category: 'volunteer',
  },
  // === 资讯文章 ===
  {
    id: 'article_001',
    type: 'article',
    title: '深圳 120 与急救侠联动，救援响应时间缩短 40%',
    excerpt: '自急救侠网络上线以来，深圳市院外心脏骤停平均救援响应时间从 8.2 分钟缩短至 4.9 分钟。卫健委表示将继续扩大志愿者网络…',
    body: '深圳市卫健委近日发布数据：自急救侠志愿者网络与120急救中心实现系统联动以来，深圳市院外心脏骤停的平均救援响应时间从8.2分钟缩短至4.9分钟，缩短40%。\n\n联动机制的核心是「一键多端」：当120接到心脏骤停求助时，系统同时向事发地1公里范围内的所有急救侠志愿者推送求助通知，志愿者在APP上点击响应后即可导航前往。\n\n统计显示，自联动上线以来，累计有3,247名志愿者参与过至少一次急救响应，其中23%的救援中志愿者比120更早到达现场并启动CPR，为后续救治争取了宝贵时间。\n\n卫健委相关负责人表示，将把急救侠模式推广到广州、东莞等珠三角城市，目标在2027年实现大湾区院外心脏骤停救援响应时间中位数降至4分钟以内。',
    coverImage: '/static/news/article_120.png',
    location: { name: '深圳' },
    time: '2026-05-02',
    author: { name: '深圳卫健委', avatar: '卫', isVolunteer: false },
    stats: { views: 2340, likes: 156, comments: 34 },
    tags: ['政策', '120联动', '卫健委'],
    category: 'recommend',
  },
  {
    id: 'article_002',
    type: 'article',
    title: '龙岗商场老人晕倒，3 名急救侠同时响应',
    excerpt: '72 岁老人逛商场时突然晕倒，附近 3 名急救侠通过 APP 同时收到求助，AED 电击一次后老人恢复心跳，送医后情况稳定。',
    body: '4月28日下午4点，72岁的刘老先生在龙岗万科广场三楼购物时突然晕倒。商场工作人员立即拨打120，并通过急救侠APP发送求助。\n\n系统在刘老先生倒地后32秒内向附近1公里内的志愿者推送求助。几乎同时，3名在商场周边的志愿者收到通知：距离300米的李女士（CPR手）、距离450米的王先生（AED手）、距离600米的陈先生（辅助）。\n\n李女士3分钟到达，立即开始CPR。王先生4分钟后携带商场二楼的AED到达，设备分析建议电击。一次电击后，刘老先生恢复自主心跳。\n\n120急救车于4点18分到达，老人被送往龙岗中心医院。主治医生表示：「志愿者在黄金4分钟内启动的CPR和AED除颤，是老人存活且无脑损伤的关键因素。」',
    coverImage: '/static/news/article_mall.png',
    location: { name: '龙岗 · 万科广场' },
    time: '2026-04-28',
    author: { name: '急救侠新闻', avatar: '闻', isVolunteer: false },
    stats: { views: 3451, likes: 234, comments: 56 },
    tags: ['成功案例', '商场', '多志愿者'],
    category: 'recommend',
    caseId: 'case_mall',
  },
  {
    id: 'article_003',
    type: 'article',
    title: '急救侠获深圳市卫健委官方推荐，覆盖用户突破 50 万',
    excerpt: '深圳市卫健委发文推荐急救侠网络，鼓励市民参与急救培训。目前注册志愿者已超过 12,000 人，联网 AED 超过 5,000 台…',
    body: '深圳市卫健委近日正式发文，将急救侠志愿者网络列为「深圳市公共卫生应急体系社会力量核心平台」，向全市企事业单位和市民推荐使用。\n\n据统计，急救侠APP上线18个月以来，注册用户突破50万，活跃志愿者超过12,000人，联网AED设备超过5,000台，覆盖深圳10个行政区的核心商圈、地铁站、公园、学校等公共场所。\n\n卫健委相关负责人表示：「急救侠的『志愿者+智能调度+AED地图』模式，有效弥补了院前急救的『空白期』，是社会力量参与公共卫生应急的优秀实践。」\n\n平台运营方透露，下一阶段将重点推进三项工作：与交警铁骑建立联动机制（铁骑配备AED）、接入120急救中心实时调度系统、启动「急救侠进校园」百校计划。',
    coverImage: '/static/news/article_recommend.png',
    location: { name: '深圳' },
    time: '2026-04-25',
    author: { name: '急救侠新闻', avatar: '闻', isVolunteer: false },
    stats: { views: 5678, likes: 345, comments: 78 },
    tags: ['里程碑', '卫健委', '用户增长'],
    category: 'recommend',
  },
  {
    id: 'article_004',
    type: 'article',
    title: '南山科技园程序员心脏骤停，同事 CPR 撑到 AED 到达',
    excerpt: '加班期间突发心脏骤停，同组同事因参加过急救侠培训，立即启动 CPR 并呼唤附近 AED，为 120 争取了宝贵的 7 分钟…',
    body: '4月22日晚11点，南山科技园某互联网公司28岁的程序员小林在加班时突然倒地，失去意识。幸运的是，同组的同事刘先生一个月前刚参加了急救侠组织的企业急救培训。\n\n刘先生立即让其他同事拨打120，自己按照培训所学：确认无意识、无呼吸后，立刻开始胸外按压。按压约2分钟后，另一名同事从公司前台取来了大楼配备的AED。\n\nAED分析心律后建议电击，一次电击后小林恢复心跳。刘先生继续按压至120到达。从倒地到AED第一次电击，整个过程不到5分钟。\n\n小林送医后诊断为「心源性猝死」，因抢救及时，3天后苏醒，无神经损伤。主治医生感叹：「如果不是同事第一时间做了CPR和电击，这条命就没了。」',
    coverImage: '/static/news/article_tech.png',
    location: { name: '南山 · 科技园' },
    time: '2026-04-22',
    author: { name: '急救侠新闻', avatar: '闻', isVolunteer: false },
    stats: { views: 2156, likes: 178, comments: 45 },
    tags: ['成功案例', '科技园', 'CPR'],
    category: 'recommend',
    caseId: 'case_tech',
  },
  // === 扩展 8 条 ===
  {
    id: 'video_003', type: 'video',
    title: '海姆立克急救法：1 分钟学会异物窒息处置',
    excerpt: '剪刀石头布口诀！站在背后环抱，向上向内冲击。成人、儿童、婴儿三种手法一次学会。',
    body: '异物窒息是日常生活中最常见的急症之一，每年因气道阻塞死亡的人数远超想象。海姆立克急救法是每个人都应该掌握的技能。\n\n口诀「剪刀石头布」：剪刀——找到肚脐上方两指的位置；石头——一手握拳，拳心向内；布——另一手包住拳头，快速向上向内冲击。\n\n成人急救：站在背后环抱，重复冲击直到异物排出。婴儿急救：将婴儿面朝下放在前臂，用掌根击打背部5次，再翻转按压胸部5次，交替进行。自救：用椅背或桌角顶住腹部向上冲击。\n\n记住一个重要原则：如果患者能咳嗽或说话，不要干预——让他们自己咳出来。只有在完全不能呼吸、不能说话、面色发紫时才立即施救。',
    coverImage: '/static/news/video_heimlich.png', videoDuration: '01:28',
    location: { name: '深圳市急救培训中心' }, time: '5 小时前',
    author: { name: '急救侠官方', avatar: '急', isVolunteer: false },
    stats: { views: 5210, likes: 876, comments: 67 }, tags: ['海姆立克', '视频教程'], category: 'video',
  },
  {
    id: 'video_004', type: 'video',
    title: '志愿者第一视角：AED 打卡巡检全记录',
    excerpt: '跟着金牌志愿者张急救，从出发到找到 AED、检查电池电极片、拍照打卡的全过程。真实记录，超实用！',
    body: 'AED巡检看似简单，实则有严格的流程和要求。金牌志愿者张急救用第一视角记录了一次完整的巡检打卡。\n\n出发前：确认巡检任务清单、检查手机电量、带上巡检工具包（包含备用电池、清洁布、新电极片）。\n\n到达现场：指南针定位AED位置→拍照记录设备整体外观→打开设备检查指示灯→取出电极片检查有效期→用清洁布擦拭设备表面→使用测试键验证设备自检→通过APP提交巡检报告。\n\n「最容易忽略的是电极片有效期，」张急救提醒，「有些AED放在户外，高温会加速电极片老化，巡检时一定要仔细检查。」整套流程约8分钟完成。\n\n每位AED手志愿者每月至少需要巡检5-10台设备，确保深圳的AED网络始终处于可用状态。',
    coverImage: '/static/news/video_patrol.png', videoDuration: '05:42',
    location: { name: '南山区 · 科技园' }, time: '昨天',
    author: { name: '张急救', avatar: '张', isVolunteer: true, rescueCount: 12, badge: '金牌' },
    stats: { views: 3890, likes: 670, comments: 134 }, tags: ['AED巡检', '志愿者', 'Vlog'], category: 'video',
  },
  {
    id: 'photo_003', type: 'photo',
    title: '深圳急救侠年度大会：500 名志愿者齐聚',
    excerpt: '2026 年度急救侠志愿者大会在深圳会展中心举行，表彰年度最佳志愿者，颁发新认证证书。',
    body: '2026年4月10日，深圳急救侠年度志愿者大会在深圳会展中心隆重举行。来自全市10个行政区的500余名志愿者代表参加。\n\n大会表彰了年度优秀志愿者：金牌志愿者王志愿以12次成功救援获得「年度最佳救援手」称号；66岁的陈阿姨荣获「银发志愿者特别贡献奖」；外卖骑手张强获得「最佳响应奖」，他3次在送餐途中响应求助，最快到达记录仅30秒。\n\n市卫健委领导在大会上宣布：深圳将启动「急救侠千人计划」，目标在2027年前培养1,000名持证急救志愿者，实现全市每个社区至少拥有3名急救侠。\n\n大会还发布了急救侠2.0版本，新增AI语音急救指导、AR-AED导航、志愿者积分商城等功能。',
    photos: ['/static/news/photo_gala_1.png', '/static/news/photo_gala_2.png', '/static/news/photo_gala_3.png'],
    location: { name: '深圳会展中心' }, time: '2026-04-10',
    author: { name: '急救侠新闻', avatar: '闻', isVolunteer: false },
    stats: { views: 8760, likes: 1200, comments: 234 }, tags: ['年度大会', '图集', '志愿者'], category: 'volunteer',
  },
  {
    id: 'story_003', type: 'story',
    title: '外卖小哥张强：送餐途中顺便救人，已成功 3 次',
    excerpt: '张强是一名美团外卖骑手，也是急救侠银牌志愿者。他利用送餐熟悉街巷的优势，3 次在配送途中响应紧急求助，最快 30 秒到达现场。',
    body: '张强是深圳福田区的一名美团外卖骑手，也是一名急救侠银牌志愿者。他的故事证明：急救技能在任何人手中都能发挥作用。\n\n「送外卖让我对福田每一条街巷都了如指掌。」张强说。2025年他利用工作之余学习了CPR+AED认证，加入急救侠网络。他的优势是「永远在路上」——无论求助发生在哪个角落，他都可能比其他人更快到达。\n\n第一次救援发生在华强北，一名老年人在电子市场晕倒。张强正在附近取餐，看到APP通知后30秒到达，成为第一个到达的志愿者，立即启动CPR。第二次和第三次救援分别在车公庙和购物公园。\n\n「同事们都叫我『救人外卖哥』，」张强笑着说，「其实我的想法很简单：如果哪天我的家人倒下了，我也希望附近有人能帮忙。」',
    coverImage: '/static/news/story_zhang.png',
    location: { name: '深圳 · 福田区' }, time: '2026-04-12',
    author: { name: '张强', avatar: '强', isVolunteer: true, rescueCount: 3, badge: '银牌' },
    stats: { views: 6540, likes: 2100, comments: 345 }, tags: ['志愿者故事', '银牌', '外卖骑手'], category: 'volunteer',
  },
  {
    id: 'article_005', type: 'article',
    title: '深圳 AED 地图新增 200 台设备，地铁站全覆盖',
    excerpt: '深圳市急救中心宣布，地铁全线网 118 个站点已全部配备 AED，加上商场、公园、学校等公共场所，全市 AED 总数突破 5,200 台…',
    body: '深圳市急救中心宣布，随着地铁11号线最后一台AED完成安装调试，深圳地铁全线网118个站点已实现AED全覆盖。加上此前已完成配备的公交枢纽、机场和高铁站，深圳公共交通场所AED总量达1,200台。\n\n统计显示，深圳全市公共场所AED设备总数已突破5,200台，每10万人口拥有AED数量约30台，远超全国平均水平（不足5台），接近日本（约55台）的水平。商场、公园、学校、社区服务中心等公共场所均已纳入AED地图。\n\n急救中心负责人表示，下一步目标是在2027年实现「3分钟AED覆盖圈」——即核心城区任何位置3分钟步行范围内至少有一台AED可用。\n\n市民可通过急救侠APP实时查看身边AED位置，也可以申请在居住小区或工作单位增设AED设备。',
    coverImage: '/static/news/article_aed_map.png',
    location: { name: '深圳' }, time: '2026-04-18',
    author: { name: '深圳急救中心', avatar: '救', isVolunteer: false },
    stats: { views: 4530, likes: 289, comments: 56 }, tags: ['AED', '地铁', '覆盖'], category: 'recommend',
  },
  {
    id: 'article_006', type: 'article',
    title: '急救侠志愿者深夜救助醉酒倒地男子',
    excerpt: '凌晨 1 点，一名男子在街头醉酒倒地失去意识。路过的急救侠志愿者李先生立即上前评估，确认无生命危险后守候至 120 到达…',
    body: '4月8日凌晨1点，福田车公庙某酒吧外，一名20多岁的男子疑因饮酒过量倒地不起。路过的急救侠志愿者李先生发现后立即上前。\n\n李先生按照急救侠培训标准流程：首先确认环境安全，然后评估患者意识、呼吸和脉搏。经检查，患者有呼吸和脉搏，但意识不清，口鼻周围有呕吐物——存在窒息风险。\n\n李先生将患者侧卧（恢复体位），清理口腔异物，保持呼吸道通畅。同时拨打120并守在旁边观察患者状态变化。约15分钟后120到达，患者被送往医院。\n\n李先生事后分享经验：「不是所有倒地的人都需要CPR。急救侠培训教我们『先评估、再施救』，对醉酒者最重要的是防窒息——侧卧位保命。」',
    coverImage: '/static/news/article_night.png',
    location: { name: '福田 · 车公庙' }, time: '2026-04-08',
    author: { name: '急救侠新闻', avatar: '闻', isVolunteer: false },
    stats: { views: 2890, likes: 456, comments: 89 }, tags: ['成功案例', '深夜', '醉酒'], category: 'recommend',
  },
  {
    id: 'map_002', type: 'map',
    title: '深圳 AED 设备年龄分布：3 年内新设备占 67%',
    excerpt: '数据显示深圳超过三分之二的 AED 设备采购于近 3 年内，设备年轻化程度全国领先。南山区新设备占比最高达 78%。',
    body: '急救侠数据团队发布深圳AED设备年龄分析报告。截至2026年4月，全市5,200台AED中，3年内采购的新设备占比67%，设备年轻化程度全国领先。\n\n区域分布：南山区新设备占比最高达78%，得益于科技企业密集、企业AED配置意识强；罗湖区因老城区建设较早，5年以上设备占比较高为22%，已列入年度更新计划。\n\n设备类型：95%为全自动AED（一键操作），5%为半自动（需手动按键电击）。品牌方面，国产设备占比达61%，其中迈瑞和鱼跃为两大主力品牌。\n\n报告提醒：AED电极片和电池有有效期（通常2-5年），建议市民在使用急救侠APP查看AED时，留意设备巡检状态，优先选择「最近巡检」的设备。',
    mapCenter: { lat: 22.543, lng: 114.058 },
    mapMarkers: [{ lat: 22.55, lng: 113.93, label: '南山' }, { lat: 22.54, lng: 114.06, label: '福田' }, { lat: 22.57, lng: 114.13, label: '罗湖' }],
    location: { name: '深圳市' }, time: '2026-04-05',
    author: { name: '急救侠数据团队', avatar: '数', isVolunteer: false },
    stats: { views: 3210, likes: 178, comments: 34 }, tags: ['数据报告', 'AED设备', '分布'], category: 'recommend',
  },
  {
    id: 'live_002', type: 'live',
    title: '直播 · 福田 CBD 写字楼紧急救援',
    excerpt: '一名 35 岁男性在办公室突然晕倒，同事已开始 CPR，AED 正在送往途中。2 名志愿者已响应，120 预计 5 分钟到达…',
    body: '下午2点08分，福田CBD嘉里建设广场22层，一名35岁男性员工在办公室突然倒地失去意识。同事立即拨打120并启动急救侠求助。\n\n2点09分，急救侠系统向800米范围内的6名志愿者推送求助。2名志愿者确认响应：陈急救（AED手，嘉里建设广场1层，距离50m）、李志愿（CPR手，对面写字楼，距离200m）。\n\n2点12分，李志愿到达22层，立即接手同事正在进行的CPR。陈急救携带1层大厅AED赶赴现场。\n\n2点14分，AED到达，分析心律后建议电击。一次电击后患者恢复自主心律。\n\n2点20分，120急救车到达，患者被送往北京大学深圳医院。目前患者生命体征稳定，正在进一步检查中。',
    coverImage: '/static/news/live_cbd.png',
    location: { name: '福田 CBD · 嘉里建设广场', distance: 0.8 }, time: '刚刚',
    author: { name: '急救侠系统', avatar: '急', isVolunteer: false },
    stats: { views: 890, likes: 45, comments: 12 }, tags: ['正在救援', 'CBD', 'CPR'],
    isLive: true, liveStats: { volunteers: 2, duration: '3 分钟', status: 'ongoing' }, category: 'nearby',
  },
]

export function getNewsList(): NewsItem[] {
  return MOCK_NEWS
}

export function getNewsByCategory(category: string): NewsItem[] {
  if (category === 'recommend') return MOCK_NEWS
  return MOCK_NEWS.filter((n) => n.category === category)
}

export function getNewsById(id: string): NewsItem | undefined {
  return MOCK_NEWS.find((n) => n.id === id)
}

export default function () {
  return { code: 0, data: MOCK_NEWS, message: 'ok' }
}
