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
    coverImage: '/static/news/article_mall.png',
    location: { name: '龙岗 · 万科广场' },
    time: '2026-04-28',
    author: { name: '急救侠新闻', avatar: '闻', isVolunteer: false },
    stats: { views: 3451, likes: 234, comments: 56 },
    tags: ['成功案例', '商场', '多志愿者'],
    category: 'recommend',
  },
  {
    id: 'article_003',
    type: 'article',
    title: '急救侠获深圳市卫健委官方推荐，覆盖用户突破 50 万',
    excerpt: '深圳市卫健委发文推荐急救侠网络，鼓励市民参与急救培训。目前注册志愿者已超过 12,000 人，联网 AED 超过 5,000 台…',
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
    coverImage: '/static/news/article_tech.png',
    location: { name: '南山 · 科技园' },
    time: '2026-04-22',
    author: { name: '急救侠新闻', avatar: '闻', isVolunteer: false },
    stats: { views: 2156, likes: 178, comments: 45 },
    tags: ['成功案例', '科技园', 'CPR'],
    category: 'recommend',
  },
  // === 扩展 8 条 ===
  {
    id: 'video_003', type: 'video',
    title: '海姆立克急救法：1 分钟学会异物窒息处置',
    excerpt: '剪刀石头布口诀！站在背后环抱，向上向内冲击。成人、儿童、婴儿三种手法一次学会。',
    coverImage: '/static/news/video_heimlich.png', videoDuration: '01:28',
    location: { name: '深圳市急救培训中心' }, time: '5 小时前',
    author: { name: '急救侠官方', avatar: '急', isVolunteer: false },
    stats: { views: 5210, likes: 876, comments: 67 }, tags: ['海姆立克', '视频教程'], category: 'video',
  },
  {
    id: 'video_004', type: 'video',
    title: '志愿者第一视角：AED 打卡巡检全记录',
    excerpt: '跟着金牌志愿者张急救，从出发到找到 AED、检查电池电极片、拍照打卡的全过程。真实记录，超实用！',
    coverImage: '/static/news/video_patrol.png', videoDuration: '05:42',
    location: { name: '南山区 · 科技园' }, time: '昨天',
    author: { name: '张急救', avatar: '张', isVolunteer: true, rescueCount: 12, badge: '金牌' },
    stats: { views: 3890, likes: 670, comments: 134 }, tags: ['AED巡检', '志愿者', 'Vlog'], category: 'video',
  },
  {
    id: 'photo_003', type: 'photo',
    title: '深圳急救侠年度大会：500 名志愿者齐聚',
    excerpt: '2026 年度急救侠志愿者大会在深圳会展中心举行，表彰年度最佳志愿者，颁发新认证证书。',
    photos: ['/static/news/photo_gala_1.png', '/static/news/photo_gala_2.png', '/static/news/photo_gala_3.png'],
    location: { name: '深圳会展中心' }, time: '2026-04-10',
    author: { name: '急救侠新闻', avatar: '闻', isVolunteer: false },
    stats: { views: 8760, likes: 1200, comments: 234 }, tags: ['年度大会', '图集', '志愿者'], category: 'volunteer',
  },
  {
    id: 'story_003', type: 'story',
    title: '外卖小哥张强：送餐途中顺便救人，已成功 3 次',
    excerpt: '张强是一名美团外卖骑手，也是急救侠银牌志愿者。他利用送餐熟悉街巷的优势，3 次在配送途中响应紧急求助，最快 30 秒到达现场。',
    coverImage: '/static/news/story_zhang.png',
    location: { name: '深圳 · 福田区' }, time: '2026-04-12',
    author: { name: '张强', avatar: '强', isVolunteer: true, rescueCount: 3, badge: '银牌' },
    stats: { views: 6540, likes: 2100, comments: 345 }, tags: ['志愿者故事', '银牌', '外卖骑手'], category: 'volunteer',
  },
  {
    id: 'article_005', type: 'article',
    title: '深圳 AED 地图新增 200 台设备，地铁站全覆盖',
    excerpt: '深圳市急救中心宣布，地铁全线网 118 个站点已全部配备 AED，加上商场、公园、学校等公共场所，全市 AED 总数突破 5,200 台…',
    coverImage: '/static/news/article_aed_map.png',
    location: { name: '深圳' }, time: '2026-04-18',
    author: { name: '深圳急救中心', avatar: '救', isVolunteer: false },
    stats: { views: 4530, likes: 289, comments: 56 }, tags: ['AED', '地铁', '覆盖'], category: 'recommend',
  },
  {
    id: 'article_006', type: 'article',
    title: '急救侠志愿者深夜救助醉酒倒地男子',
    excerpt: '凌晨 1 点，一名男子在街头醉酒倒地失去意识。路过的急救侠志愿者李先生立即上前评估，确认无生命危险后守候至 120 到达…',
    coverImage: '/static/news/article_night.png',
    location: { name: '福田 · 车公庙' }, time: '2026-04-08',
    author: { name: '急救侠新闻', avatar: '闻', isVolunteer: false },
    stats: { views: 2890, likes: 456, comments: 89 }, tags: ['成功案例', '深夜', '醉酒'], category: 'recommend',
  },
  {
    id: 'map_002', type: 'map',
    title: '深圳 AED 设备年龄分布：3 年内新设备占 67%',
    excerpt: '数据显示深圳超过三分之二的 AED 设备采购于近 3 年内，设备年轻化程度全国领先。南山区新设备占比最高达 78%。',
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
