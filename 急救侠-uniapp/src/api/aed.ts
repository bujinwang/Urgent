/**
 * AED API — Mock（Pokémon GO 风格探索数据）
 */

export interface CheckInRecord {
  id: string
  userId: string
  userName: string
  photo: string
  date: string
  status: 'ok' | 'issue'
  comment: string
  findingTip?: string
}

export interface AedDevice {
  id: string
  name: string
  address: string
  distance: number
  lat: number
  lng: number
  status: 'available' | 'in_use' | 'maintenance'
  photo: string
  model: string
  serialNumber: string
  batteryExpiry: string
  electrodeExpiry: string
  lastMaintenance: string
  lastCheck: string
  indoor: boolean
  floor: string
  openHours: string
  findingInstructions: string
  custodian?: {
    name: string
    phone: string
    role: string
    avatar: string
  }
  checkIns: CheckInRecord[]
  discovered: boolean
  verified: boolean
}

const MOCK_AEDS: AedDevice[] = [
  {
    id: 'aed_001',
    name: '深圳湾公园管理处',
    address: '南门入口左侧 · 保安亭旁',
    distance: 120,
    lat: 22.516,
    lng: 113.946,
    status: 'available',
    photo: '/static/aed/aed_001.png',
    model: '迈瑞 BeneHeart C1',
    serialNumber: 'MR-2024-C100382',
    batteryExpiry: '2027-08-15',
    electrodeExpiry: '2027-06-20',
    lastMaintenance: '2026-05-01',
    lastCheck: '2026-05-01',
    indoor: false,
    floor: '',
    openHours: '24 小时（户外设备）',
    findingInstructions: '从南门进入，直行约 50 米看到保安亭。AED 柜在保安亭左侧绿色铁箱内，箱体标有「AED 自动体外除颤器」字样。24 小时可取，无需钥匙，打开箱门即自动通知责任人。',
    custodian: {
      name: '李明',
      phone: '138****6789',
      role: '公园管理处 · 安全主管',
      avatar: '李',
    },
    checkIns: [
      { id: 'ci_001', userId: 'u_002', userName: '张急救', photo: '/static/aed/checkin_001.png', date: '2026-05-01', status: 'ok', comment: '设备完好，电极片未过期', findingTip: '保安亭旁边有两条长椅，AED 箱子就在长椅后面。晚上有路灯照着，很显眼。' },
      { id: 'ci_002', userId: 'u_003', userName: '王志愿', photo: '/static/aed/checkin_002.png', date: '2026-04-15', status: 'ok', comment: '外壳有轻微划痕，功能正常', findingTip: '公园南门进来正对就是，不用拐弯。如果从北门来的话要穿过整个公园。' },
    ],
    discovered: true,
    verified: true,
  },
  {
    id: 'aed_002',
    name: '海岸城购物中心',
    address: '1F 服务台旁 · 电梯口右侧',
    distance: 240,
    lat: 22.518,
    lng: 113.944,
    status: 'available',
    photo: '/static/aed/aed_002.png',
    model: '飞利浦 HeartStart FRx',
    serialNumber: 'PH-2025-FR0872',
    batteryExpiry: '2027-11-03',
    electrodeExpiry: '2027-09-18',
    lastMaintenance: '2026-04-28',
    lastCheck: '2026-04-28',
    indoor: true,
    floor: '1F',
    openHours: '10:00 – 22:00',
    findingInstructions: '从正门（面朝深南大道）进入，直行至中心服务台（优衣库对面）。AED 在服务台右侧墙上的橙色柜中，柜门有「AED」大字标识。商场营业时间为 10:00-22:00，其他时间可从员工通道（B1 停车场入口）进入。',
    custodian: {
      name: '张芳',
      phone: '139****8901',
      role: '商场运营部 · 物业经理',
      avatar: '张',
    },
    checkIns: [
      { id: 'ci_003', userId: 'u_004', userName: '赵救援', photo: '/static/aed/checkin_003.png', date: '2026-04-28', status: 'ok', comment: '设备正常，标识清晰', findingTip: '服务台人多的时候可能被排队的人挡住，直接走到右侧就能看到橙色的柜子。' },
    ],
    discovered: true,
    verified: false,
  },
  {
    id: 'aed_003',
    name: '深圳湾体育中心',
    address: 'B1 停车场入口 · 电梯厅旁',
    distance: 380,
    lat: 22.519,
    lng: 113.950,
    status: 'available',
    photo: '/static/aed/aed_003.png',
    model: '迈瑞 BeneHeart C2',
    serialNumber: 'MR-2025-C200156',
    batteryExpiry: '2028-01-20',
    electrodeExpiry: '2027-12-10',
    lastMaintenance: '2026-05-02',
    lastCheck: '2026-05-02',
    indoor: true,
    floor: 'B1',
    openHours: '06:00 – 23:00',
    findingInstructions: '从体育中心正门进入，乘电梯下行至 B1。出电梯厅右转，AED 在电梯厅对面白色墙面上，配有绿色 AED 标识灯箱。停车场入口处也有指引牌指向「AED 急救设备」。',
    custodian: {
      name: '陈工',
      phone: '136****3456',
      role: '体育中心设施部',
      avatar: '陈',
    },
    checkIns: [],
    discovered: false,
    verified: false,
  },
  {
    id: 'aed_004',
    name: '欢乐海岸购物中心',
    address: '2F 电梯口 · 卫生间旁',
    distance: 520,
    lat: 22.521,
    lng: 113.943,
    status: 'maintenance',
    photo: '/static/aed/aed_004.png',
    model: '日本光电 AED-3100',
    serialNumber: 'NK-2024-A31042',
    batteryExpiry: '2026-12-01',
    electrodeExpiry: '2026-10-15',
    lastMaintenance: '2026-04-15',
    lastCheck: '2026-04-15',
    indoor: true,
    floor: '2F',
    openHours: '10:00 – 22:00',
    findingInstructions: '乘扶梯上 2F，出扶梯后左转往卫生间方向步行约 20 米。AED 在卫生间入口右侧墙上。⚠️ 当前设备维护中，如需急用请联系责任人王磊或前往 1F 海岸城 AED。',
    custodian: {
      name: '王磊',
      phone: '137****2345',
      role: '商场工程部',
      avatar: '王',
    },
    checkIns: [],
    discovered: false,
    verified: false,
  },
]

export function getNearbyAeds(lat?: number, lng?: number): AedDevice[] {
  return [...MOCK_AEDS].sort((a, b) => a.distance - b.distance)
}

export function getAedById(id: string): AedDevice | undefined {
  return MOCK_AEDS.find((a) => a.id === id)
}

export function getDiscoveredCount(): number {
  return MOCK_AEDS.filter((a) => a.discovered).length
}

export function getTotalCount(): number {
  return MOCK_AEDS.length
}

export default function (params?: Record<string, unknown>) {
  return {
    code: 0,
    data: MOCK_AEDS,
    message: 'ok',
  }
}
