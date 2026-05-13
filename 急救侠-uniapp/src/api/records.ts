/**
 * 救援记录 API — Mock
 *
 * 用户参与的历次救援记录，每条对应一次完整救援事件。
 */

export interface RescueRecord {
  id: string
  type: 'cpr' | 'aed' | 'assist'
  title: string
  address: string
  date: string
  duration: string
  outcome: 'success' | 'partial' | 'transferred'
  outcomeLabel: string
  role: string
  roleLabel: string
  squadCount: number
  aedUsed: boolean
  timeline: Array<{ time: string; text: string }>
  squad: Array<{ name: string; role: string; avatar: string; color: string }>
}

const MOCK_RECORDS: RescueRecord[] = [
  {
    id: 'rec_001',
    type: 'cpr',
    title: '深圳湾公园 · 心脏骤停救援',
    address: '深圳湾公园南门',
    date: '2026-05-03',
    duration: '8分钟',
    outcome: 'success',
    outcomeLabel: '救援成功 · 患者恢复心跳',
    role: 'aed',
    roleLabel: 'AED 手',
    squadCount: 4,
    aedUsed: true,
    timeline: [
      { time: '14:32', text: '患者张先生（45岁）在深圳湾公园慢跑时突然倒地。' },
      { time: '14:32', text: '路人李女士5秒内响应，确认无意识无呼吸，启动CPR。' },
      { time: '14:33', text: '系统调度3名志愿者。你作为AED手，从100m外取AED赶赴现场。' },
      { time: '14:35', text: '你携带AED到达，贴电极片、分析心律，建议电击。' },
      { time: '14:36', text: 'AED电击1次后患者恢复自主心律。继续CPR维持。' },
      { time: '14:40', text: '120到达，患者恢复意识，生命体征稳定，送北大深圳医院。' },
    ],
    squad: [
      { name: '李女士', role: '按压手', avatar: '李', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
      { name: '陆远', role: 'AED 手（你）', avatar: '陆', color: 'linear-gradient(135deg,#F59E0B,#D97706)' },
      { name: '张护士', role: '记录员', avatar: '张', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
      { name: '陈医生', role: '在线指导', avatar: '陈', color: 'linear-gradient(135deg,#C8A656,#B8941A)' },
    ],
  },
  {
    id: 'rec_002',
    type: 'cpr',
    title: '龙岗商场 · 老人晕倒协作救援',
    address: '龙岗万科广场 3F',
    date: '2026-04-28',
    duration: '7分钟',
    outcome: 'success',
    outcomeLabel: '救援成功 · AED电击1次后恢复',
    role: 'cpr',
    roleLabel: '按压手',
    squadCount: 3,
    aedUsed: true,
    timeline: [
      { time: '16:15', text: '72岁陈奶奶在商场3楼购物时突然晕倒，家属大声呼救。' },
      { time: '16:15', text: '你正在附近购物，收到APP推送后立即响应，30秒内到达现场。' },
      { time: '16:16', text: '确认无意识无呼吸，立即启动CPR。系统通知2名志愿者。' },
      { time: '16:18', text: '持续按压2分钟，商场保安将1楼AED送到3楼。' },
      { time: '16:21', text: 'AED分析建议电击，一次电击后老人恢复自主呼吸。' },
      { time: '16:22', text: '120到达，老人已恢复意识，送龙岗中心医院。' },
    ],
    squad: [
      { name: '陆远', role: '按压手（你）', avatar: '陆', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
      { name: '刘保安', role: 'AED 取送', avatar: '刘', color: 'linear-gradient(135deg,#F59E0B,#D97706)' },
      { name: '孙女士', role: '记录员', avatar: '孙', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
    ],
  },
  {
    id: 'rec_003',
    type: 'assist',
    title: '科技园 · 程序员心脏骤停夜间救援',
    address: '南山科技园 · 某写字楼12F',
    date: '2026-04-22',
    duration: '9分钟',
    outcome: 'success',
    outcomeLabel: '救援成功 · 同事CPR维持到AED到达',
    role: 'assist',
    roleLabel: '辅助 · 引导120',
    squadCount: 3,
    aedUsed: true,
    timeline: [
      { time: '21:40', text: '程序员小刘加班时突然从椅子滑落，同事发现其无意识无呼吸。' },
      { time: '21:40', text: '同事小陈立即开始CPR并拨打120。你收到系统推送后赶往现场。' },
      { time: '21:42', text: '你到达后协助小陈轮替按压，并到大楼门口引导120急救车。' },
      { time: '21:47', text: '大楼保安取AED跑步送上12楼，分析后建议电击。' },
      { time: '21:49', text: '一次电击后患者恢复心跳。120到达接手，送南山医院。' },
    ],
    squad: [
      { name: '小陈', role: '按压手', avatar: '陈', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
      { name: '黄保安', role: 'AED 取送', avatar: '黄', color: 'linear-gradient(135deg,#F59E0B,#D97706)' },
      { name: '陆远', role: '辅助引导（你）', avatar: '陆', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
    ],
  },
  {
    id: 'rec_004',
    type: 'cpr',
    title: '车公庙 · 深夜醉酒倒地救助',
    address: '福田车公庙 · 某酒吧外',
    date: '2026-04-08',
    duration: '15分钟',
    outcome: 'transferred',
    outcomeLabel: '安全移交 · 120接手送医',
    role: 'assist',
    roleLabel: '评估 · 守护',
    squadCount: 1,
    aedUsed: false,
    timeline: [
      { time: '01:10', text: '凌晨路过车公庙，发现一名男子倒地不起，周围无人。' },
      { time: '01:11', text: '上前评估：有呼吸、有脉搏但意识不清，口鼻周围有呕吐物。' },
      { time: '01:12', text: '将患者转为侧卧位，清理口腔异物，保持呼吸道通畅。' },
      { time: '01:15', text: '拨打120，守在旁边持续观察患者面色和呼吸变化。' },
      { time: '01:25', text: '120到达，向急救人员汇报评估情况，患者送医。' },
    ],
    squad: [
      { name: '陆远', role: '评估守护（你）', avatar: '陆', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
    ],
  },
  {
    id: 'rec_005',
    type: 'aed',
    title: '华强北 · 电子市场老人晕倒',
    address: '华强北 · 赛格电子市场',
    date: '2026-03-18',
    duration: '5分钟',
    outcome: 'partial',
    outcomeLabel: '部分成功 · CPR维持至120到达',
    role: 'aed',
    roleLabel: 'AED 手',
    squadCount: 2,
    aedUsed: true,
    timeline: [
      { time: '10:35', text: '华强北赛格电子市场一名老年人在购物时突然晕倒。' },
      { time: '10:36', text: '你正在附近送餐，收到通知后1分钟内到达，确认无意识无呼吸。' },
      { time: '10:37', text: '立即启动CPR，另一名志愿者从市场管理处取来AED。' },
      { time: '10:40', text: 'AED分析未建议电击（无可电击心律），持续CPR直到120到达。' },
      { time: '10:40', text: '120到达后使用高级生命支持，患者送医院后恢复脉搏。' },
    ],
    squad: [
      { name: '陆远', role: 'AED 手（你）', avatar: '陆', color: 'linear-gradient(135deg,#F59E0B,#D97706)' },
      { name: '周先生', role: '按压手', avatar: '周', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
    ],
  },
  {
    id: 'rec_006',
    type: 'cpr',
    title: '深圳湾体育中心 · AED巡检中发现患者',
    address: '深圳湾体育中心 B1',
    date: '2026-03-05',
    duration: '6分钟',
    outcome: 'success',
    outcomeLabel: '救援成功 · 及时发现并施救',
    role: 'cpr',
    roleLabel: '按压手 · 第一响应人',
    squadCount: 2,
    aedUsed: true,
    timeline: [
      { time: '09:45', text: '正在深圳湾体育中心B1进行AED月度巡检，听到呼救声。' },
      { time: '09:46', text: '发现一名健身者倒地，立即评估：无意识、无呼吸、无脉搏。' },
      { time: '09:47', text: '自身携带AED，立即开机，同时开始胸外按压（30:2）。' },
      { time: '09:49', text: 'AED分析建议电击，电击1次后继续按压2分钟。' },
      { time: '09:51', text: '患者恢复自主呼吸，120到达后送医院。' },
    ],
    squad: [
      { name: '陆远', role: '按压手（你）', avatar: '陆', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
      { name: '李教练', role: '辅助协助', avatar: '李', color: 'linear-gradient(135deg,#1F8A5B,#147547)' },
    ],
  },
]

export function getRescueRecords(): RescueRecord[] {
  return [...MOCK_RECORDS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

export function getRecordById(id: string): RescueRecord | undefined {
  return MOCK_RECORDS.find((r) => r.id === id)
}

export function getRecordCount(): number {
  return MOCK_RECORDS.length
}


import { request } from './index'

export async function fetchRecords(): Promise<RescueRecord[]> { return request({ url: '/records/list' }) }
export async function fetchRecordById(id: string): Promise<RescueRecord> { return request({ url: `/records/${id}` }) }

export default function () {
  return { code: 0, data: MOCK_RECORDS, message: 'ok' }
}
