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
