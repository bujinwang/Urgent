/**
 * 救援案例 API — Mock
 *
 * 每个案例对应一条成功救援的详细记录，
 * 包含时间线、参与志愿者、救援结果等结构化信息。
 */

export interface CaseHero {
  id: number
  avatar: string
  name: string
  role: string
  color: string
}

export interface CaseTimelineItem {
  time: string
  text: string
}

export interface RescueCase {
  id: string
  tag: string
  tagClass: 'success'
  title: string
  date: string
  location: string
  duration: string
  resultIcon: string
  resultTitle: string
  resultText: string
  timeline: CaseTimelineItem[]
  heroes: CaseHero[]
  /** 关联的新闻 ID，用于从新闻详情页跳转 */
  newsId?: string
}

const MOCK_CASES: RescueCase[] = [
  {
    id: 'case_park',
    tag: '✓ 成功案例',
    tagClass: 'success',
    title: '深圳湾公园 · 心脏骤停紧急救援',
    date: '2026-05-03',
    location: '深圳湾公园南门',
    duration: '救援时长 8分钟',
    resultIcon: '💚',
    resultTitle: '救援成功！',
    resultText: '患者已恢复自主心跳，送医后生命体征稳定。',
    timeline: [
      { time: '14:32', text: '患者张先生（45岁）在深圳湾公园慢跑时突然倒地。' },
      { time: '14:32', text: '路人李女士（急救侠SZ-023）5秒内响应，确认无意识无呼吸，启动CPR。' },
      { time: '14:33', text: '系统自动呼叫120，调度3名志愿者携带AED赶赴现场。最近AED仅120米。' },
      { time: '14:35', text: '第1名志愿者到达接替按压。AED到达，分析心律建议电击。' },
      { time: '14:36', text: 'AED电击1次后，患者恢复自主心律。继续CPR维持循环。' },
      { time: '14:40', text: '120到达，患者已恢复意识，生命体征稳定，送往北大深圳医院。' },
    ],
    heroes: [
      { id: 1, avatar: '李', name: '李女士', role: 'SZ-023 · 按压手', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
      { id: 2, avatar: '王', name: '王先生', role: 'SZ-045 · AED手', color: 'linear-gradient(135deg,#1F8A5B,#147547)' },
      { id: 3, avatar: '张', name: '张护士', role: 'SZ-002 · 记录员', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
      { id: 4, avatar: '陈', name: '陈医生', role: 'SZ-001 · 指导', color: 'linear-gradient(135deg,#C8A656,#B8941A)' },
    ],
    newsId: 'live_001',
  },
  {
    id: 'case_mall',
    tag: '✓ 成功案例',
    tagClass: 'success',
    title: '龙岗商场 · 老人晕倒多名志愿者协作',
    date: '2026-04-28',
    location: '龙岗万科广场',
    duration: '救援时长 7分钟',
    resultIcon: '💚',
    resultTitle: '救援成功！',
    resultText: 'AED电击一次后老人恢复心跳，送医后情况稳定。',
    timeline: [
      { time: '16:15', text: '72岁陈奶奶在商场3楼突然晕倒，家属大声呼救。' },
      { time: '16:15', text: '商场急救侠赵先生（SZ-007）在附近购物，收到APP推送立即响应。' },
      { time: '16:16', text: '系统同时通知2名附近志愿者，商场AED在1楼服务台旁。' },
      { time: '16:18', text: '赵先生开始CPR，1楼AED被商场保安取到送上3楼。' },
      { time: '16:21', text: 'AED分析建议电击，一次电击后老人恢复自主呼吸。' },
      { time: '16:22', text: '120到达，老人已恢复意识，被送往龙岗中心医院。' },
    ],
    heroes: [
      { id: 1, avatar: '赵', name: '赵先生', role: 'SZ-007 · 按压手', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
      { id: 2, avatar: '刘', name: '刘保安', role: '商场安保 · AED取送', color: 'linear-gradient(135deg,#1F8A5B,#147547)' },
      { id: 3, avatar: '孙', name: '孙女士', role: 'SZ-019 · 记录员', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
    ],
    newsId: 'article_002',
  },
  {
    id: 'case_tech',
    tag: '✓ 成功案例',
    tagClass: 'success',
    title: '南山科技园 · 程序员心脏骤停同事施救',
    date: '2026-04-22',
    location: '南山科技园',
    duration: '救援时长 9分钟',
    resultIcon: '💚',
    resultTitle: '救援成功！',
    resultText: '同事CPR维持7分钟直到AED到达，患者送医后康复。',
    timeline: [
      { time: '21:40', text: '程序员小刘加班时突然从椅子滑落，同事发现其无意识无呼吸。' },
      { time: '21:40', text: '同事小陈参加过急救侠培训，立即开始CPR并让其他人打120。' },
      { time: '21:42', text: '系统推送附近AED位置，大楼保安取得AED后跑步送上12楼。' },
      { time: '21:47', text: 'AED到达，分析后建议电击，一次电击后患者恢复心跳。' },
      { time: '21:49', text: '120到达接手，患者已恢复自主呼吸，送南山医院进一步治疗。' },
    ],
    heroes: [
      { id: 1, avatar: '陈', name: '小陈', role: '同事 · 按压手', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
      { id: 2, avatar: '黄', name: '黄保安', role: '大楼安保 · AED取送', color: 'linear-gradient(135deg,#1F8A5B,#147547)' },
      { id: 3, avatar: '林', name: '林同事', role: '拨打120 · 引导', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
    ],
    newsId: 'article_004',
  },
]

export function getCaseById(id: string): RescueCase | undefined {
  return MOCK_CASES.find((c) => c.id === id)
}

export function getCaseByNewsId(newsId: string): RescueCase | undefined {
  return MOCK_CASES.find((c) => c.newsId === newsId)
}

export function getCasesList(): RescueCase[] {
  return MOCK_CASES
}

export default function () {
  return { code: 0, data: MOCK_CASES, message: 'ok' }
}
