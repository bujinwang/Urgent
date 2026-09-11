/**
 * 救援记录 API — 真实接口（GET /api/records/list、GET /api/records/:id）
 *
 * 说明：后端结构缺少 duration/timeline 等字段，由显式映射函数用安全默认补齐；
 * 单条取数直接调用后端已补齐的 `GET /api/records/:id`。
 */

import { request } from './index'

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

/** 后端 `/api/records/list` 返回的原始结构。 */
export interface ApiRescueRecord {
  id: string
  type: string
  date: string
  location: string
  role: string
  squad: string[]
  result: string
}

const RECORD_TYPES: readonly string[] = ['cpr', 'aed', 'assist']

function asRecordType(t: string): RescueRecord['type'] {
  return RECORD_TYPES.includes(t) ? (t as RescueRecord['type']) : 'assist'
}

const OUTCOME_MAP: Record<string, RescueRecord['outcome']> = {
  '成功': 'success',
  '部分成功': 'partial',
  '移交': 'transferred',
}

const OUTCOME_LABEL: Record<RescueRecord['outcome'], string> = {
  success: '救援成功',
  partial: '部分成功',
  transferred: '安全移交',
}

const SQUAD_COLORS = [
  'linear-gradient(135deg,#C0392B,#8B2A1F)',
  'linear-gradient(135deg,#F59E0B,#D97706)',
  'linear-gradient(135deg,#4A90E2,#2563EB)',
  'linear-gradient(135deg,#1F8A5B,#147547)',
]

/** 后端记录 → 视图模型（显式映射，禁用 `as any`）。 */
export function mapRescueRecord(raw: ApiRescueRecord | null | undefined): RescueRecord {
  if (!raw) throw new Error('救援记录不存在')
  const squadNames = raw.squad || []
  const type = asRecordType(raw.type)
  const outcome = OUTCOME_MAP[raw.result] || 'transferred'
  return {
    id: raw.id,
    type,
    title: raw.location || raw.id,
    address: raw.location,
    date: raw.date,
    duration: '',
    outcome,
    outcomeLabel: OUTCOME_LABEL[outcome] || raw.result,
    role: raw.role,
    roleLabel: raw.role,
    squadCount: squadNames.length,
    aedUsed: type === 'aed',
    timeline: [],
    squad: squadNames.map((name, i) => ({
      name,
      role: '参与救援',
      avatar: (name || '?').charAt(0),
      color: SQUAD_COLORS[i % SQUAD_COLORS.length],
    })),
  }
}

/** 获取救援记录列表（按日期倒序）。失败时抛出，由调用方呈现错误。 */
export async function fetchRecords(): Promise<RescueRecord[]> {
  const raw = await request<ApiRescueRecord[]>({ url: '/records/list' })
  const list = (raw || []).map(mapRescueRecord)
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/** 获取单条记录（后端 GET /api/records/:id）。 */
export async function fetchRecordById(id: string): Promise<RescueRecord> {
  const raw = await request<ApiRescueRecord | null>({ url: `/records/${id}` })
  return mapRescueRecord(raw)
}
