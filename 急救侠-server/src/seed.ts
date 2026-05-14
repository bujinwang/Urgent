import db, { initDb } from './db'

initDb()

// Disable FK checks for seeding
db.pragma('foreign_keys = OFF')

// Clear existing data
db.exec('DELETE FROM users; DELETE FROM tasks; DELETE FROM aed_devices; DELETE FROM news; DELETE FROM courses; DELETE FROM volunteers; DELETE FROM rescue_records; DELETE FROM rescue_cases; DELETE FROM atlas_cards; DELETE FROM stats;')

// ---- User ----
db.prepare(`INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count, public_id, is_leader, affiliation, is_public)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'user_001', '陆远', '陆', 'gold', 2340, '深圳', 'SZ-012',
  JSON.stringify(['CPR-AHA', 'AED-Operator']), 12, 'J9X2K7', 1, '蓝天救援队', 1
)

// ---- Stats ----
db.prepare(`INSERT INTO stats (id, certified_rescuers, networked_aeds, monthly_rescues, online_volunteers, aeds_within_1km)
  VALUES (1, ?, ?, ?, ?, ?)`).run(12847, 3256, 89, 3, 12)

// ---- Active Task ----
db.prepare(`INSERT INTO tasks (id, type, address, distance, lat, lng, volunteers_needed, volunteers_responded, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'task_001', 'cpr', '深圳湾公园南门', 100, 22.517, 113.947, 3, 3, 'active', new Date().toISOString()
)

// ---- AED Devices (8) ----
const aeds: any[][] = [
  ['aed_001', '深圳湾公园 AED', '深圳湾公园南门入口', 22.517, 113.947, 80, 'available', '2025-05-01', 98,
    '迈瑞 BeneHeart C1', 'MR-2024-C100382', '2027-08-15', '2027-06-20', '2025-05-01',
    0, '', '24 小时（户外设备）', '从南门进入，直行约 50 米看到保安亭。AED 柜在保安亭左侧绿色铁箱内，箱体标有「AED 自动体外除颤器」字样。',
    '李明', '138****6789', '公园管理处 · 安全主管', 'admin', '2025-05-01', 0, ''],
  ['aed_002', '海岸城购物中心 AED', '海岸城 B1 层电梯旁', 22.518, 113.942, 320, 'available', '2025-04-28', 95,
    '飞利浦 HeartStart FRx', 'PH-2025-FR0872', '2027-11-03', '2027-09-18', '2025-04-28',
    1, 'B1', '10:00 – 22:00', '从正门进入，直行至中心服务台。AED 在服务台右侧墙上橙色柜中，柜门有「AED」大字标识。',
    '张芳', '139****8901', '商场运营部 · 物业经理', '', '', 0, ''],
  ['aed_003', '人才公园 AED', '人才公园北门保安室', 22.522, 113.952, 450, 'available', '2025-05-03', 100,
    '迈瑞 BeneHeart C2', 'MR-2025-C200156', '2028-01-20', '2027-12-10', '2025-05-02',
    1, 'B1', '06:00 – 23:00', '从体育中心正门进入，乘电梯下行至 B1。出电梯厅右转，AED 在电梯厅对面白色墙面上。',
    '陈工', '136****3456', '体育中心设施部', '', '', 0, ''],
  ['aed_004', '南山区政府 AED', '南山区政府一楼大厅', 22.533, 113.930, 680, 'maintenance', '2025-04-20', 88,
    '日本光电 AED-3100', 'NK-2024-A31042', '2026-12-01', '2026-10-15', '2025-04-15',
    1, '1F', '09:00 – 18:00', '进入大厅后右转，AED 在服务台旁白色柜中。',
    '王磊', '137****2345', '区政府后勤部', '', '', 0, ''],
  ['aed_005', '南山书城 AED', '南山书城二楼服务台', 22.519, 113.938, 520, 'available', '2025-05-02', 92,
    '迈瑞 BeneHeart C1', 'MR-2025-C100521', '2028-03-10', '2028-01-05', '2025-04-20',
    1, '2F', '09:00 – 21:00', '乘扶梯上 2F，服务台在扶梯正对面。AED 柜在服务台左侧。',
    '周老师', '135****7890', '书城行政部', '', '', 0, ''],
  ['aed_006', '深圳湾体育中心 AED', '春茧体育馆一楼', 22.521, 113.955, 600, 'available', '2025-04-25', 96,
    '飞利浦 HeartStart FRx', 'PH-2025-FR0901', '2027-12-01', '2027-10-15', '2025-04-25',
    1, '1F', '06:00 – 23:00', '从体育馆正门进入大厅，AED 在前台右侧红色柜中。',
    '刘主管', '136****4567', '体育中心运营部', '', '', 0, ''],
  ['aed_007', '创维大厦 AED', '创维大厦 A 座大堂', 22.536, 113.948, 750, 'available', '2025-05-05', 99,
    '迈瑞 BeneHeart C2', 'MR-2025-C200201', '2028-06-01', '2028-04-01', '2025-05-05',
    1, '1F', '08:00 – 20:00', '进入 A 座大堂，AED 在前台后面墙上。',
    '赵经理', '138****5678', '创维行政部', '', '', 0, ''],
  ['aed_008', '腾讯滨海大厦 AED', '腾讯滨海大厦一楼', 22.524, 113.940, 400, 'available', '2025-04-30', 100,
    '飞利浦 HeartStart FRx', 'PH-2025-FR0920', '2028-03-01', '2028-01-15', '2025-04-30',
    1, '1F', '24 小时（大堂区域）', '从正门进入大堂，AED 在右侧电梯厅旁的橙色柜中。',
    '孙经理', '139****6789', '腾讯行政部', '', '', 0, ''],
  // Mobile AED — car-mounted
  ['aed_009', '🚗 陆远的车载 AED', '车辆移动中 · 跟随手机 GPS', 22.517, 113.947, 200, 'available', '2025-05-12', 100,
    '迈瑞 BeneHeart C1', 'MR-2025-C100999', '2028-01-01', '2027-12-01', '2025-05-01',
    0, '', '24 小时（车载，随时可取）', '联系陆远获取当前车辆位置',
    '陆远', '138****0001', '急救侠志愿者', 'admin', '2025-05-12', 1, 'user_001'],
]
const insertAed = db.prepare('INSERT INTO aed_devices (id, name, address, lat, lng, distance, status, last_check, battery_level, model, serial_number, battery_expiry, electrode_expiry, last_maintenance, indoor, floor, open_hours, finding_instructions, custodian_name, custodian_phone, custodian_role, reported_by, reported_at, is_mobile, linked_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
for (const a of aeds) insertAed.run(...a)

// ---- News (17 items) ----
const newsData = [
  { id: 'n001', title: '深圳湾公园 AED 成功救援一例', type: 'story', category: 'recommend', time: '2小时前', locName: '深圳湾公园', locLat: 22.517, locLng: 113.947, tags: ['成功案例'], isLive: 0, isUrgent: 0, body: '今天下午，一位60岁男性在深圳湾公园晨跑时突然倒地，附近志愿者接到系统通知后3分钟内携带AED赶到现场……' },
  { id: 'n002', title: 'CPR 急救培训在南山社区', type: 'video', category: 'video', time: '4小时前', locName: '南山社区', locLat: 22.533, locLng: 113.930, tags: ['培训'], isLive: 0, isUrgent: 0, body: '南山社区中心今天举办了 CPR 急救培训课程，30多位社区居民参与学习。', videoUrl: '/static/news/video_cpr.mp4' },
  { id: 'n003', title: '海岸城现场直播：志愿者演练', type: 'live', category: 'nearby', time: '进行中', locName: '海岸城', locLat: 22.518, locLng: 113.942, tags: ['直播', '演练'], isLive: 1, isUrgent: 0 },
  { id: 'n004', title: '广州天河 CBD 救援现场', type: 'live', category: 'nearby', time: '进行中', locName: '广州天河', locLat: 23.129, locLng: 113.327, tags: ['直播', '救援'], isLive: 1, isUrgent: 0 },
  { id: 'n005', title: '王阿姨的救援故事', type: 'story', category: 'volunteer', time: '昨天', locName: '深圳福田', locLat: 22.543, locLng: 114.058, tags: ['志愿者故事'], isLive: 0, isUrgent: 0, body: '王阿姨今年58岁，退休后加入了急救侠志愿者……' },
  { id: 'n006', title: '技术升级：AI辅助调度系统上线', type: 'article', category: 'recommend', time: '昨天', locName: '深圳', locLat: 22.543, locLng: 114.058, tags: ['技术'], isLive: 0, isUrgent: 0, body: '急救侠平台今日上线了基于AI的智能调度系统……' },
  { id: 'n007', title: '海姆立克法教学视频', type: 'video', category: 'video', time: '前天', locName: '线上', locLat: 22.543, locLng: 114.058, tags: ['教学', '海姆立克'], isLive: 0, isUrgent: 0, body: '海姆立克急救法是应对异物窒息的必备技能。', videoUrl: '/static/news/video_heimlich.png' },
  { id: 'n008', title: '福田区新增8台AED设备', type: 'article', category: 'recommend', time: '前天', locName: '深圳福田', locLat: 22.543, locLng: 114.058, tags: ['AED'], isLive: 0, isUrgent: 0, body: '福田区政府与急救侠合作，在区内公共场所新增部署8台AED设备。' },
  { id: 'n009', title: '夜间巡逻志愿者招募', type: 'photo', category: 'volunteer', time: '3天前', locName: '深圳南山区', locLat: 22.533, locLng: 113.930, tags: ['招募'], isLive: 0, isUrgent: 0, body: '急救侠计划在深圳南山区启动夜间巡逻项目，现招募志愿者。' },
  { id: 'n010', title: 'AED地图覆盖全国100城', type: 'map', category: 'recommend', time: '3天前', locName: '北京', locLat: 39.904, locLng: 116.407, tags: ['AED', '地图'], isLive: 0, isUrgent: 0, body: '急救侠AED地图服务已覆盖全国100个城市，可查询超过5万台AED设备位置。' },
  { id: 'n011', title: '120急救中心合作签约', type: 'article', category: 'recommend', time: '4天前', locName: '深圳', locLat: 22.543, locLng: 114.058, tags: ['合作'], isLive: 0, isUrgent: 0, body: '急救侠与深圳市120急救中心正式签署合作协议。' },
  { id: 'n012', title: '张先生：从路人到急救侠', type: 'story', category: 'volunteer', time: '4天前', locName: '深圳宝安', locLat: 22.555, locLng: 113.883, tags: ['志愿者故事'], isLive: 0, isUrgent: 0, body: '张先生分享了他从普通路人变成急救志愿者的故事……' },
  { id: 'n013', title: '广州北京路志愿巡逻', type: 'photo', category: 'nearby', time: '5天前', locName: '广州北京路', locLat: 23.125, locLng: 113.267, tags: ['巡逻'], isLive: 0, isUrgent: 0 },
  { id: 'n014', title: 'CPR按压节奏练习工具上线', type: 'article', category: 'recommend', time: '5天前', locName: '线上', locLat: 22.543, locLng: 114.058, tags: ['工具', 'CPR'], isLive: 0, isUrgent: 0, body: '急救侠App新增了CPR按压节奏练习工具，帮助用户掌握每分钟100-120次的按压频率。' },
  { id: 'n015', title: '深圳CBD高楼急救演练', type: 'video', category: 'video', time: '6天前', locName: '深圳福田CBD', locLat: 22.543, locLng: 114.058, tags: ['演练'], isLive: 0, isUrgent: 0, body: '深圳福田CBD组织高层建筑急救演练，模拟电梯故障时如何在楼梯间进行CPR。' },
  { id: 'n016', title: '2025年度急救侠表彰大会', type: 'photo', category: 'recommend', time: '1周前', locName: '深圳会展中心', locLat: 22.526, locLng: 114.066, tags: ['表彰'], isLive: 0, isUrgent: 0, body: '2025年度急救侠表彰大会在深圳会展中心举行，12位志愿者获得"金牌急救侠"称号。' },
  { id: 'n017', title: 'AED夜间地图上线', type: 'article', category: 'recommend', time: '1周前', locName: '深圳', locLat: 22.543, locLng: 114.058, tags: ['AED', '夜间'], isLive: 0, isUrgent: 0, body: '急救侠推出了AED夜间可用地图，标注了24小时可用的AED设备位置。' },
]
const insertNews = db.prepare('INSERT INTO news (id, title, type, category, time, location_name, location_lat, location_lng, tags, is_live, is_urgent, body, image_url, video_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
for (const n of newsData) {
  insertNews.run(n.id, n.title, n.type, n.category, n.time, n.locName, n.locLat, n.locLng, JSON.stringify(n.tags), n.isLive, n.isUrgent, n.body || null, n.imageUrl || null, (n as any).videoUrl || null)
}

// ---- Courses ----
const courses = [
  ['course_001', 'CPR 心肺复苏基础', '知识库', '15分钟', 1, 1.0, '❤️'],
  ['course_002', 'AED 使用指南', '知识库', '10分钟', 0, 0.6, '⚡'],
  ['course_003', '海姆立克急救法', '知识库', '8分钟', 0, 0.0, '🫁'],
  ['course_004', '创伤止血包扎', '培训课程', '20分钟', 0, 0.3, '🩹'],
  ['course_005', '骨折固定与搬运', '培训课程', '25分钟', 0, 0.0, '🦴'],
  ['course_006', '紧急心理干预', '培训课程', '12分钟', 0, 0.0, '🧠'],
]
const insertCourse = db.prepare('INSERT INTO courses (id, title, category, duration, completed, progress, icon) VALUES (?, ?, ?, ?, ?, ?, ?)')
for (const c of courses) insertCourse.run(...c)

// ---- Volunteers (top 10) ----
// Fields: id, name, avatar, tier, points, rescue_count, city, rank_pos,
//         role, coach_specialties, coach_certifications, coach_bio, coach_available
const vols = [
  { id:'v001', name:'陆远', avatar:'陆', tier:'gold', points:2340, rescue:12, city:'深圳', rank:1,
    role:'volunteer', specialties:'[]', certs:'[]', bio:'', available:1 },
  { id:'v002', name:'陈敏', avatar:'陈', tier:'diamond', points:5120, rescue:38, city:'深圳', rank:2,
    role:'coach', specialties:'["CPR","AED","First Aid"]', certs:'["AHA-BLS-Instructor","Red-Cross-FA-Trainer"]', bio:'10年急救培训经验，AHA认证导师。擅长心肺复苏和AED操作培训，已培训超过200名志愿者。', available:1 },
  { id:'v003', name:'王芳', avatar:'王', tier:'gold', points:1890, rescue:9, city:'广州', rank:3,
    role:'volunteer', specialties:'[]', certs:'[]', bio:'', available:1 },
  { id:'v004', name:'李强', avatar:'李', tier:'gold', points:1780, rescue:15, city:'深圳', rank:4,
    role:'coach', specialties:'["CPR","Trauma Care"]', certs:'["AHA-BLS-Instructor"]', bio:'退役消防员，拥有丰富的现场急救经验。专注于CPR和创伤急救培训。', available:1 },
  { id:'v005', name:'赵丽', avatar:'赵', tier:'silver', points:920, rescue:5, city:'北京', rank:5,
    role:'volunteer', specialties:'[]', certs:'[]', bio:'', available:1 },
  { id:'v006', name:'张伟', avatar:'张', tier:'silver', points:850, rescue:7, city:'上海', rank:6,
    role:'coach', specialties:'["AED","Emergency Response"]', certs:'["Red-Cross-FA-Trainer","ERC-BLS"]', bio:'红十字会认证培训师，擅长AED使用教学和应急响应流程培训。', available:1 },
  { id:'v007', name:'孙静', avatar:'孙', tier:'silver', points:780, rescue:4, city:'深圳', rank:7,
    role:'volunteer', specialties:'[]', certs:'[]', bio:'', available:1 },
  { id:'v008', name:'周明', avatar:'周', tier:'bronze', points:520, rescue:2, city:'广州', rank:8,
    role:'volunteer', specialties:'[]', certs:'[]', bio:'', available:1 },
  { id:'v009', name:'吴婷', avatar:'吴', tier:'bronze', points:480, rescue:3, city:'深圳', rank:9,
    role:'volunteer', specialties:'[]', certs:'[]', bio:'', available:1 },
  { id:'v010', name:'郑磊', avatar:'郑', tier:'bronze', points:350, rescue:1, city:'深圳', rank:10,
    role:'volunteer', specialties:'[]', certs:'[]', bio:'', available:1 },
]
const insertVol = db.prepare('INSERT INTO volunteers (id, name, avatar, tier, points, rescue_count, city, rank_pos, role, coach_specialties, coach_certifications, coach_bio, coach_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
for (const v of vols) insertVol.run(v.id, v.name, v.avatar, v.tier, v.points, v.rescue, v.city, v.rank, v.role, v.specialties, v.certs, v.bio, v.available)

// ---- Rescue Records ----
const records = [
  ['rec_001', 'CPR', '2025-05-01', '深圳湾公园', '按压员', '["陆远","陈敏","王芳"]', '成功'],
  ['rec_002', 'AED取用', '2025-04-28', '海岸城', 'AED手', '["李强","赵丽"]', '成功'],
  ['rec_003', '辅助', '2025-04-20', '人才公园', '记录员', '["张伟","孙静","周明"]', '转送120'],
]
const insertRecord = db.prepare('INSERT INTO rescue_records (id, type, date, location, role, squad, result) VALUES (?, ?, ?, ?, ?, ?, ?)')
for (const r of records) insertRecord.run(...r)

// ---- Rescue Cases ----
const cases = [
  ['case_001', '深圳湾公园心脏骤停救援', '老年男性晨跑时突发心脏骤停，志愿者3分钟到场实施CPR+AED，成功恢复心跳。', '2025-05-01', '深圳湾公园南门', '成功复律，转送医院', '["陆远","陈敏","王芳"]', '详细记录：患者60岁男性，倒地后2分钟内CPR启动，4分钟内AED到位，电击一次后恢复窦性心律。120到场后转运至南山医院。'],
  ['case_002', '海岸城异物窒息救援', '儿童在餐厅被食物噎住，志愿者用海姆立克法成功解除窒息。', '2025-04-28', '海岸城B1层', '成功解除窒息', '["李强","赵丽"]', '详细记录：5岁女童在餐厅被肉丸噎住，志愿者李强用海姆立克法3次操作成功排出异物。'],
  ['case_003', '人才公园摔伤骨折固定', '游客在人才公园跑步时摔倒导致左前臂疑似骨折，志愿者进行固定后送医。', '2025-04-20', '人才公园北门', '成功固定，送医', '["张伟","孙静","周明"]', '详细记录：25岁男性跑步时摔倒，左前臂畸形，志愿者使用夹板固定后等待120送医。'],
]
const insertCase = db.prepare('INSERT INTO rescue_cases (id, title, summary, date, location, result, volunteers, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
for (const c of cases) insertCase.run(...c)

// ---- Organizations ----
db.prepare("INSERT OR IGNORE INTO organizations (id, name, type, admin_user_id) VALUES (?, ?, ?, ?)").run('org_001', '深圳南山中学', 'school', 'user_001')
db.prepare("INSERT OR IGNORE INTO organizations (id, name, type, admin_user_id) VALUES (?, ?, ?, ?)").run('org_002', '创维集团', 'company', 'user_001')
db.prepare("INSERT OR IGNORE INTO organizations (id, name, type, admin_user_id) VALUES (?, ?, ?, ?)").run('org_003', '深圳市野生动植物保护管理处', 'conservation', 'user_001')

// ---- Organization Members ----
const insertOrgMember = db.prepare('INSERT OR IGNORE INTO organization_members (id, org_id, user_id, role) VALUES (?, ?, ?, ?)')
insertOrgMember.run('om_001', 'org_001', 'user_001', 'admin')
insertOrgMember.run('om_002', 'org_001', 'v002', 'manager')
insertOrgMember.run('om_003', 'org_001', 'v003', 'member')
insertOrgMember.run('om_004', 'org_001', 'v005', 'member')
insertOrgMember.run('om_005', 'org_001', 'v007', 'member')
insertOrgMember.run('om_006', 'org_002', 'user_001', 'admin')
insertOrgMember.run('om_007', 'org_002', 'v004', 'manager')
insertOrgMember.run('om_008', 'org_002', 'v006', 'member')
insertOrgMember.run('om_009', 'org_002', 'v008', 'member')
insertOrgMember.run('om_010', 'org_002', 'v010', 'member')
insertOrgMember.run('om_011', 'org_003', 'user_001', 'admin')

// ---- Certificates ----
const insertCert = db.prepare('INSERT OR IGNORE INTO certificates (id, user_id, type, issuer, issue_date, expiry_date, status, file_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
insertCert.run('cert_001', 'user_001', 'CPR', 'AHA', '2025-03-15', '2027-03-15', 'active', '')
insertCert.run('cert_002', 'user_001', 'AED', 'AHA', '2025-03-15', '2027-03-15', 'active', '')
insertCert.run('cert_003', 'v002', 'CPR', 'AHA', '2024-06-01', '2026-06-01', 'active', '')
insertCert.run('cert_004', 'v002', 'First Aid', 'Red Cross', '2024-06-01', '2026-06-01', 'active', '')
insertCert.run('cert_005', 'v003', 'CPR', 'ERC', '2025-01-10', '2026-05-20', 'expiring', '')
insertCert.run('cert_006', 'v004', 'CPR', 'AHA', '2024-08-20', '2026-08-20', 'active', '')
insertCert.run('cert_007', 'v005', 'CPR', 'Red Cross', '2024-04-01', '2026-04-01', 'expired', '')
insertCert.run('cert_008', 'v006', 'AED', 'ERC', '2025-02-15', '2026-06-15', 'active', '')
insertCert.run('cert_009', 'v007', 'CPR', 'AHA', '2025-05-01', '2026-05-30', 'expiring', '')
insertCert.run('cert_010', 'v010', 'CPR', 'Red Cross', '2025-07-01', '2027-07-01', 'active', '')

// ---- Atlas Cards (8) ----
const atlasItems = [
  ['atlas_001', 'CPR 心肺复苏', '基础技能', '在心脏骤停时通过胸外按压和人工呼吸维持生命体征。', '["确认环境安全","判断意识和呼吸","呼救并取AED","开始胸外按压","开放气道人工呼吸","持续循环至AED到达"]', '❤️', null],
  ['atlas_002', 'AED 使用', '基础技能', '自动体外除颤器的使用步骤。', '["打开AED电源","按语音提示贴电极片","确保无人接触患者","按下电击键","电击后立即恢复CPR"]', '⚡', null],
  ['atlas_003', '海姆立克急救法', '基础技能', '针对异物窒息的腹部冲击急救法。', '["站在患者身后","拳头顶住患者腹部","用另一只手握住拳头","快速向上向内冲击","重复直到异物排出"]', '🫁', null],
  ['atlas_004', '创伤止血包扎', '进阶技能', '处理各种外伤出血的止血和包扎方法。', '["按压止血","清洁伤口","敷料覆盖","绷带包扎","抬高受伤部位"]', '🩹', null],
  ['atlas_005', '骨折固定', '进阶技能', '骨折临时固定的方法。', '["检查受伤部位","准备夹板材料","固定骨折两端","悬吊手臂（上肢）","等待专业救援"]', '🦴', null],
  ['atlas_006', '伤员搬运', '进阶技能', '安全搬运伤员的技巧，避免二次损伤。', '["评估伤情","固定颈部（疑脊柱损伤）","选择合适的搬运方法","平稳搬运","持续观察伤员状态"]', '🚑', null],
  ['atlas_007', '紧急心理干预', '进阶技能', '在急救现场安抚伤员情绪的方法。', '["自我介绍取得信任","保持平静的语调","告知正在进行的急救措施","转移注意力","提供心理安全感"]', '🧠', null],
  ['atlas_008', '人工呼吸技术', '基础技能', '正确的口对口人工呼吸操作。', '["仰头抬下巴打开气道","检查口腔清除异物","捏住患者鼻翼","嘴包嘴密封","吹一口气看胸廓起伏"]', '💨', null],
]
const insertAtlas = db.prepare('INSERT INTO atlas_cards (id, title, category, description, steps, icon, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)')
for (const a of atlasItems) insertAtlas.run(...a)

// ---- AED Managers ----
const insertAm = db.prepare('INSERT OR IGNORE INTO aed_managers (id, aed_id, user_id, user_name, role) VALUES (?, ?, ?, ?, ?)')
insertAm.run('am_001', 'aed_001', 'user_001', '陆远', 'primary')
insertAm.run('am_002', 'aed_001', 'v002', '陈敏', 'backup')
insertAm.run('am_003', 'aed_002', 'v004', '李强', 'primary')
insertAm.run('am_004', 'aed_003', 'v002', '陈敏', 'primary')
insertAm.run('am_005', 'aed_004', 'v006', '张伟', 'primary')
insertAm.run('am_006', 'aed_005', 'user_001', '陆远', 'primary')
insertAm.run('am_007', 'aed_006', 'v004', '李强', 'backup')
insertAm.run('am_008', 'aed_007', 'user_001', '陆远', 'backup')

// ---- AED Maintenance ----
const insertMt = db.prepare('INSERT OR IGNORE INTO aed_maintenance (id, aed_id, type, date, performed_by, notes, next_due) VALUES (?, ?, ?, ?, ?, ?, ?)')
insertMt.run('mt_001', 'aed_001', 'inspection', '2025-05-01', '陆远', '季度巡检，设备正常', '2025-08-01')
insertMt.run('mt_002', 'aed_001', 'battery_replacement', '2025-01-15', '陈敏', '更换电池组，原电池已使用2年', '2027-01-15')
insertMt.run('mt_003', 'aed_002', 'inspection', '2025-04-28', '李强', '设备正常，标识清晰', '2025-07-28')
insertMt.run('mt_004', 'aed_004', 'repair', '2025-04-15', '张伟', '电极片连接器松动，已紧固', '2025-05-15')
insertMt.run('mt_005', 'aed_002', 'electrode_replacement', '2025-03-01', '李强', '更换成人电极片', '2027-03-01')

// ---- AED Pickups ----
const insertPu = db.prepare('INSERT OR IGNORE INTO aed_pickups (id, aed_id, user_id, user_name, pickup_time, return_time, mission_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
insertPu.run('pu_001', 'aed_001', 'v003', '王芳', '2025-05-01 09:30:00', '2025-05-01 10:45:00', 'task_001', '深圳湾公园救援任务取用')
insertPu.run('pu_002', 'aed_002', 'v005', '赵丽', '2025-04-28 14:20:00', '2025-04-28 15:10:00', '', '海岸城突发救援')
insertPu.run('pu_003', 'aed_001', 'v007', '孙静', '2025-05-03 11:00:00', null, 'task_003', '正在使用中')

// ---- AED Certifications ----
const insertAc = db.prepare('INSERT OR IGNORE INTO aed_certifications (id, aed_id, type, name, issuer, issue_date, expiry_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
insertAc.run('ac_001', 'aed_001', 'manufacturer', 'CFDA 医疗器械注册证', '国家药监局', '2024-03-01', '2029-03-01', 'active')
insertAc.run('ac_002', 'aed_001', 'manufacturer', 'CE 认证 (MDR 2017/745)', '欧盟公告机构', '2024-03-15', '2029-03-15', 'active')
insertAc.run('ac_003', 'aed_001', 'platform', '急救侠设备认证', '急救侠平台', '2025-05-01', '2026-05-01', 'active')
insertAc.run('ac_004', 'aed_002', 'manufacturer', 'FDA 510(k) Clearance', '美国 FDA', '2023-06-01', '2028-06-01', 'active')
insertAc.run('ac_005', 'aed_002', 'platform', '急救侠设备认证', '急救侠平台', '2025-04-28', '2026-04-28', 'active')
insertAc.run('ac_006', 'aed_004', 'platform', '急救侠设备认证', '急救侠平台', '2025-04-15', '2026-04-15', 'active')
insertAc.run('ac_007', 'aed_003', 'manufacturer', 'CFDA 医疗器械注册证', '国家药监局', '2025-01-01', '2030-01-01', 'active')
insertAc.run('ac_008', 'aed_003', 'platform', '急救侠设备认证', '急救侠平台', '2025-05-02', '2026-05-02', 'active')

// ---- AED Audit Log ----
const insertAl = db.prepare('INSERT OR IGNORE INTO aed_audit_log (id, aed_id, event_type, description, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
insertAl.run('al_001', 'aed_001', 'device_created', '新增 AED: 深圳湾公园 AED', 'admin', '管理员', '2025-01-01 08:00:00')
insertAl.run('al_002', 'aed_001', 'manager_assigned', '指派管理者: 陆远 (primary)', 'admin', '管理员', '2025-01-01 08:05:00')
insertAl.run('al_003', 'aed_001', 'certification_added', '添加认证: CFDA 医疗器械注册证 (manufacturer)', 'admin', '管理员', '2025-03-01 10:00:00')
insertAl.run('al_004', 'aed_001', 'maintenance', 'battery_replacement: 更换电池组 (执行人: 陈敏)', 'v002', '陈敏', '2025-01-15 14:30:00')
insertAl.run('al_005', 'aed_001', 'checkin', '志愿者 张急救 打卡: ok', 'u_002', '张急救', '2025-05-01 15:20:00')
insertAl.run('al_006', 'aed_001', 'pickup', 'AED 被 王芳 取用 (任务: task_001)', 'v003', '王芳', '2025-05-01 09:30:00')
insertAl.run('al_007', 'aed_001', 'return', 'AED 已归还', 'v003', '王芳', '2025-05-01 10:45:00')
insertAl.run('al_008', 'aed_001', 'maintenance', 'inspection: 季度巡检，设备正常 (执行人: 陆远)', 'user_001', '陆远', '2025-05-01 11:00:00')
insertAl.run('al_009', 'aed_002', 'device_created', '新增 AED: 海岸城购物中心 AED', 'admin', '管理员', '2025-01-10 09:00:00')
insertAl.run('al_010', 'aed_002', 'pickup', 'AED 被 赵丽 取用', 'v005', '赵丽', '2025-04-28 14:20:00')

// ---- Notifications ----
const insertNotif = db.prepare('INSERT OR IGNORE INTO notifications (id, org_id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
insertNotif.run('n_001', 'org_001', 'v002', 'certificate', '陈敏 获得新证书', '陈敏 获得了 First Aid 认证 (Red Cross)，有效期至 2026-06-01', '2025-05-10 09:00:00')
insertNotif.run('n_002', 'org_001', 'v007', 'certificate', '孙静 获得新证书', '孙静 获得了 CPR 认证 (AHA)，有效期至 2026-05-30', '2025-05-08 14:30:00')
insertNotif.run('n_003', 'org_001', 'v003', 'certificate', '王芳 证书即将到期', '王芳 的 CPR 认证 (ERC) 将于 2026-05-20 到期，请及时续证', '2025-05-12 08:00:00')
insertNotif.run('n_004', 'org_002', 'v006', 'certificate', '张伟 获得新证书', '张伟 获得了 AED 认证 (ERC)，有效期至 2026-06-15', '2025-05-01 11:00:00')

// ---- Volunteer Locations ----
const insertLoc = db.prepare('INSERT OR IGNORE INTO volunteer_locations (id, user_id, user_name, lat, lng) VALUES (?, ?, ?, ?, ?)')
insertLoc.run('vl_user_001', 'user_001', '陆远', 22.517, 113.947)
insertLoc.run('vl_v002', 'v002', '陈敏', 22.518, 113.942)
insertLoc.run('vl_v003', 'v003', '王芳', 22.543, 114.058)
insertLoc.run('vl_v004', 'v004', '李强', 22.521, 113.955)
insertLoc.run('vl_v005', 'v005', '赵丽', 22.533, 113.930)

// ---- Volunteer Groups ----
db.prepare("INSERT OR IGNORE INTO volunteer_groups (id, name, description, created_by) VALUES (?, ?, ?, ?)").run('grp_001', '深圳湾急救小队', '深圳湾公园周边志愿者协作群', 'user_001')
db.prepare("INSERT OR IGNORE INTO volunteer_groups (id, name, description, created_by) VALUES (?, ?, ?, ?)").run('grp_002', 'CPR 学习互助组', 'CPR 技能交流与复训组织', 'v002')
const insertGm = db.prepare('INSERT OR IGNORE INTO group_members (id, group_id, user_id, user_name) VALUES (?, ?, ?, ?)')
insertGm.run('gm_101', 'grp_001', 'user_001', '陆远')
insertGm.run('gm_102', 'grp_001', 'v002', '陈敏')
insertGm.run('gm_103', 'grp_001', 'v003', '王芳')
insertGm.run('gm_201', 'grp_002', 'v002', '陈敏')
insertGm.run('gm_202', 'grp_002', 'v004', '李强')

// ---- Group Messages ----
const insertGmsg = db.prepare('INSERT OR IGNORE INTO group_messages (id, group_id, user_id, user_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
insertGmsg.run('gmsg_01', 'grp_001', 'user_001', '陆远', '欢迎加入深圳湾急救小队！大家互相照应 🤝', '2025-05-01 10:00:00')
insertGmsg.run('gmsg_02', 'grp_001', 'v002', '陈敏', '今天下午在深圳湾公园有 AED 巡检，谁有空？', '2025-05-01 10:05:00')
insertGmsg.run('gmsg_03', 'grp_001', 'v003', '王芳', '我可以，大概 3 点到', '2025-05-01 10:08:00')

// ---- Direct Messages ----
const insertMsg = db.prepare('INSERT OR IGNORE INTO messages (id, from_user_id, from_user_name, to_user_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
insertMsg.run('msg_01', 'v003', '王芳', 'user_001', '陆远你好，想请教一下 CPR 按压频率的问题', '2025-05-10 14:00:00')
insertMsg.run('msg_02', 'user_001', '陆远', 'v003', '王芳你好！标准频率是 100-120 次/分钟，用 APP 里的节拍器练很方便', '2025-05-10 14:05:00')

// ---- External Certifications ----
const insertEc = db.prepare('INSERT OR IGNORE INTO external_certifications (id, user_id, type, issuer, cert_number, issue_date, expiry_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
insertEc.run('ec_001', 'user_001', '蓝天救援队队员证', '蓝天救援队', 'BSR-2024-0882', '2024-03-01', '2027-03-01', 'verified')
insertEc.run('ec_002', 'user_001', '应急救援员（四级）', '国家应急管理部', 'YJJ-2024-1201', '2024-06-01', '2027-06-01', 'verified')
insertEc.run('ec_003', 'v002', '红十字救护师资证', '中国红十字会', 'RC-2025-0156', '2025-01-01', '2028-01-01', 'pending')
insertEc.run('ec_004', 'v004', '蓝天救援队队员证', '蓝天救援队', 'BSR-2024-0912', '2024-05-01', '2027-05-01', 'verified')

// ---- Affiliation for volunteers (蓝天队员) ----
db.prepare("UPDATE users SET affiliation = '蓝天救援队' WHERE id = 'v002'")
db.prepare("UPDATE users SET affiliation = '蓝天救援队' WHERE id = 'v004'")

// ---- Emergency Mobilization ----
db.prepare("INSERT OR IGNORE INTO emergency_mobilizations (id, title, description, type, address, lat, lng, volunteers_needed, volunteers_responded, leader_id, leader_name, status, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('mob_001', '深圳湾水域搜救演练', '蓝天救援队季度水上搜救演练，需要至少8名队员参与', 'rescue', '深圳湾公园南门', 22.517, 113.947, 8, 2, 'user_001', '陆远', 'active', 'admin', '2025-05-10 09:00:00')
db.prepare('INSERT OR IGNORE INTO mobilization_volunteers (id, mobilization_id, user_id, user_name) VALUES (?,?,?,?)').run('mv_001', 'mob_001', 'v002', '陈敏')
db.prepare('INSERT OR IGNORE INTO mobilization_volunteers (id, mobilization_id, user_id, user_name) VALUES (?,?,?,?)').run('mv_002', 'mob_001', 'v004', '李强')

// ---- Trail Hikers ----
db.prepare("UPDATE users SET volunteer_type = 'trail' WHERE id IN ('v003', 'v005', 'v008')")
const insertTrail = db.prepare('INSERT OR IGNORE INTO user_trails (id, user_id, user_name, total_distance, total_elevation, hikes_completed, last_hike_date, longest_hike, badge) VALUES (?,?,?,?,?,?,?,?,?)')
insertTrail.run('ut_v003', 'v003', '王芳', 420, 8500, 28, '2025-05-08', 35, '⛰️ 山野达人')
insertTrail.run('ut_v005', 'v005', '赵丽', 680, 14200, 45, '2025-05-10', 52, '🏔️ 雪山行者')
insertTrail.run('ut_v008', 'v008', '周明', 180, 3800, 12, '2025-04-30', 22, '🥾 徒步爱好者')

// ---- Trail Events ----
db.prepare("INSERT OR IGNORE INTO trail_events (id, title, description, route, distance, elevation, difficulty, date, meeting_point, lat, lng, max_participants, current_participants, organizer_id, organizer_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('te_001', '梧桐山夜爬训练', '夜间爬山耐力训练，头灯必备', '梧桐山北门→好汉坡→山顶→原路返回', 12, 900, 'hard', '2025-05-20 19:00', '梧桐山北门', 22.56, 114.21, 15, 2, 'v005', '赵丽')
db.prepare('INSERT OR IGNORE INTO trail_event_participants (id, event_id, user_id, user_name) VALUES (?,?,?,?)').run('tp_001', 'te_001', 'v005', '赵丽')
db.prepare('INSERT OR IGNORE INTO trail_event_participants (id, event_id, user_id, user_name) VALUES (?,?,?,?)').run('tp_002', 'te_001', 'v003', '王芳')

// ---- Drill Events ----
db.prepare("UPDATE users SET is_organizer = 1 WHERE id IN ('user_001', 'v002')")
db.prepare("INSERT OR IGNORE INTO drill_events (id, title, description, scenario, date, location, lat, lng, max_participants, current_participants, organizer_id, organizer_name, status, points_reward) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('dr_001', '社区 CPR 急救演习', '模拟心脏骤停场景，练习 CPR+AED 全流程', 'cpr', '2025-05-25 14:00', '南山社区中心广场', 22.533, 113.930, 12, 3, 'user_001', '陆远', 'upcoming', 50)
// A completed drill with training records
db.prepare("INSERT OR IGNORE INTO drill_events (id, title, description, scenario, date, location, lat, lng, max_participants, current_participants, organizer_id, organizer_name, status, points_reward) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('dr_000', 'AED 操作专项训练', 'AED 开机、贴片、电击全流程模拟', 'aed', '2025-05-05 10:00', '深圳湾公园', 22.517, 113.947, 10, 3, 'user_001', '陆远', 'completed', 50)
db.prepare("INSERT OR IGNORE INTO drill_events (id, title, description, scenario, date, location, lat, lng, max_participants, current_participants, organizer_id, organizer_name, status, points_reward) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('dr_002', '创伤急救模拟训练', '模拟交通事故现场，练习止血包扎和骨折固定', 'trauma', '2025-05-18 09:00', '深圳湾公园东门', 22.517, 113.947, 8, 2, 'v002', '陈敏', 'upcoming', 50)
db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id, user_name, attended) VALUES (?,?,?,?,?)').run('dp_000a', 'dr_000', 'user_001', '陆远', 1)
db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id, user_name, attended) VALUES (?,?,?,?,?)').run('dp_000b', 'dr_000', 'v003', '王芳', 1)
db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id, user_name, attended) VALUES (?,?,?,?,?)').run('dp_000c', 'dr_000', 'v005', '赵丽', 1)
db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id, user_name) VALUES (?,?,?,?)').run('dp_001', 'dr_001', 'user_001', '陆远')
db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id, user_name) VALUES (?,?,?,?)').run('dp_002', 'dr_001', 'v003', '王芳')
db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id, user_name) VALUES (?,?,?,?)').run('dp_003', 'dr_001', 'v005', '赵丽')
db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id, user_name) VALUES (?,?,?,?)').run('dp_004', 'dr_002', 'v002', '陈敏')
db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id, user_name) VALUES (?,?,?,?)').run('dp_005', 'dr_002', 'v004', '李强')

// ---- Training Records (from completed drill) ----
db.prepare('INSERT OR IGNORE INTO training_records (id, user_id, user_name, scenario, date, organizer_id, organizer_name, drill_id, notes) VALUES (?,?,?,?,?,?,?,?,?)').run('tr_001', 'user_001', '陆远', 'aed', '2025-05-05', 'user_001', '陆远', 'dr_000', 'AED 操作专项训练')
db.prepare('INSERT OR IGNORE INTO training_records (id, user_id, user_name, scenario, date, organizer_id, organizer_name, drill_id, notes) VALUES (?,?,?,?,?,?,?,?,?)').run('tr_002', 'v003', '王芳', 'aed', '2025-05-05', 'user_001', '陆远', 'dr_000', 'AED 操作专项训练')
db.prepare('INSERT OR IGNORE INTO training_records (id, user_id, user_name, scenario, date, organizer_id, organizer_name, drill_id, notes) VALUES (?,?,?,?,?,?,?,?,?)').run('tr_003', 'v005', '赵丽', 'aed', '2025-05-05', 'user_001', '陆远', 'dr_000', 'AED 操作专项训练')

// ---- Wildlife Reports ----
db.prepare("UPDATE users SET volunteer_type = 'medical,wildlife,disaster' WHERE id = 'user_001'")
db.prepare("INSERT OR IGNORE INTO wildlife_reports (id, user_id, user_name, category, species, description, lat, lng, location, status) VALUES (?,?,?,?,?,?,?,?,?,?)").run('wr_001', 'user_001', '陆远', 'wildlife', '黑脸琵鹭', '深圳湾红树林湿地发现一只疑似受伤的黑脸琵鹭，左翅无法展开，需专业救助', 22.517, 113.947, '深圳湾红树林保护区', 'reported')
db.prepare("INSERT OR IGNORE INTO wildlife_reports (id, user_id, user_name, category, species, description, lat, lng, location, status) VALUES (?,?,?,?,?,?,?,?,?,?)").run('wr_002', 'user_001', '陆远', 'wildlife', '穿山甲', '路边发现一只中华穿山甲，疑似被车辆碰撞，有外伤出血', 22.533, 113.930, '南山社区路边', 'assigned')
// Pet reports — open to all volunteers
db.prepare("INSERT OR IGNORE INTO wildlife_reports (id, user_id, user_name, category, species, description, lat, lng, location, status) VALUES (?,?,?,?,?,?,?,?,?,?)").run('wr_003', 'v003', '王芳', 'pet', '橘猫', '小区门口发现一只受伤的流浪橘猫，左后腿跛行，疑似被车撞', 22.533, 113.930, '南山社区北门', 'reported')
db.prepare("INSERT OR IGNORE INTO wildlife_reports (id, user_id, user_name, category, species, description, lat, lng, location, status) VALUES (?,?,?,?,?,?,?,?,?,?)").run('wr_004', 'v005', '赵丽', 'pet', '流浪狗', '深圳湾公园遛弯时看到一只流浪狗，有项圈但无主人，疑似走失', 22.517, 113.947, '深圳湾公园草坪', 'reported')

// ---- Wildlife Rescue Task ----
db.prepare("INSERT OR IGNORE INTO wildlife_rescue_tasks (id, report_id, title, species, description, address, lat, lng, volunteers_needed, volunteers_responded, leader_id, leader_name, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run('wl_001', 'wr_002', '穿山甲救助转运', '穿山甲', '路边发现受伤穿山甲，需捕捉后转运至野生动物救护中心', '南山社区路边', 22.533, 113.930, 3, 1, 'user_001', '陆远', 'active')

// ---- Stray Animals ----
db.prepare("INSERT OR IGNORE INTO stray_animals (id, name, species, color, size, features, photos, location, lat, lng, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run('sa_001', '小橘', '橘猫', '橘色白腹', '中型', '左耳有缺口，尾巴末端弯曲', '', '南山社区北门附近', 22.533, 113.930, 'v003')
db.prepare("INSERT OR IGNORE INTO stray_animals (id, name, species, color, size, features, photos, location, lat, lng, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run('sa_002', '大黄', '中华田园犬', '黄色', '大型', '有红色旧项圈，右后腿轻微跛行', '', '深圳湾公园草坪', 22.517, 113.947, 'v005')

// ---- Animal Care Records ----
db.prepare('INSERT OR IGNORE INTO animal_care_records (id, animal_id, user_id, user_name, care_type, description, created_at) VALUES (?,?,?,?,?,?,?)').run('acr_001', 'sa_001', 'v003', '王芳', 'feeding', '喂了猫粮和清水，小橘吃了不少', '2025-05-10 08:30:00')
db.prepare('INSERT OR IGNORE INTO animal_care_records (id, animal_id, user_id, user_name, care_type, description, created_at) VALUES (?,?,?,?,?,?,?)').run('acr_002', 'sa_001', 'v005', '赵丽', 'feeding', '带了罐头，小橘很喜欢', '2025-05-11 18:00:00')
db.prepare('INSERT OR IGNORE INTO animal_care_records (id, animal_id, user_id, user_name, care_type, description, created_at) VALUES (?,?,?,?,?,?,?)').run('acr_003', 'sa_001', 'v005', '赵丽', 'checkup', '观察左后腿仍有跛行，需要进一步检查', '2025-05-11 18:10:00')
db.prepare('INSERT OR IGNORE INTO animal_care_records (id, animal_id, user_id, user_name, care_type, description, created_at) VALUES (?,?,?,?,?,?,?)').run('acr_004', 'sa_002', 'v005', '赵丽', 'feeding', '投喂狗粮', '2025-05-12 07:00:00')

// ---- Animal Health Records ----
db.prepare('INSERT OR IGNORE INTO animal_health_records (id, animal_id, user_id, user_name, check_type, findings, vet_name, created_at) VALUES (?,?,?,?,?,?,?,?)').run('ahr_001', 'sa_001', 'v003', '王芳', 'general', '左后腿软组织挫伤，无骨折。已做简单包扎，建议限制活动一周', '瑞鹏宠物医院·李医生', '2025-05-12 14:00:00')

// ---- Video Posts ----
db.prepare("INSERT OR IGNORE INTO video_posts (id,user_id,user_name,user_avatar,title,description,category,duration,view_count,like_count) VALUES (?,?,?,?,?,?,?,?,?,?)").run('vp_001','v002','李强','李','CPR 黄金四分钟完整演示','从判断意识到 AED 电击，完整还原一次成功的心脏骤停救援','training','04:32',8920,1340)
db.prepare("INSERT OR IGNORE INTO video_posts (id,user_id,user_name,user_avatar,title,description,category,duration,view_count,like_count) VALUES (?,?,?,?,?,?,?,?,?,?)").run('vp_002','v003','王芳','王','救助被车撞伤的小狗','路人发现后立即呼叫急救侠，志愿者们合力将小狗送往宠物医院','animal','01:58',4560,890)
db.prepare("INSERT OR IGNORE INTO video_posts (id,user_id,user_name,user_avatar,title,description,category,duration,view_count,like_count) VALUES (?,?,?,?,?,?,?,?,?,?)").run('vp_003','v001','陈敏','陈','AED 使用全流程','跟练！3分钟从开机到放电，普通人也能救命','training','03:15',12300,2100)
db.prepare("INSERT OR IGNORE INTO video_posts (id,user_id,user_name,user_avatar,title,description,category,duration,view_count,like_count) VALUES (?,?,?,?,?,?,?,?,?,?)").run('vp_004','v006','张伟','张','深圳湾公园溺水救援','游客发现有人溺水，急救侠志愿者3分钟抵达现场施救','rescue','06:10',7800,1560)
db.prepare("INSERT OR IGNORE INTO video_posts (id,user_id,user_name,user_avatar,title,description,category,duration,view_count,like_count) VALUES (?,?,?,?,?,?,?,?,?,?)").run('vp_005','v005','赵丽','赵','献血后的急救包','一次献血能救三个人？赵丽带你参观深圳血液中心','daily','02:45',3200,670)
db.prepare("INSERT OR IGNORE INTO video_posts (id,user_id,user_name,user_avatar,title,description,category,duration,view_count,like_count) VALUES (?,?,?,?,?,?,?,?,?,?)").run('vp_006','v002','李强','李','户外徒步急救小技巧','崴脚、中暑、蛇咬伤——梧桐山徒步急救实战','training','05:20',5600,980)
db.prepare("INSERT OR IGNORE INTO video_posts (id,user_id,user_name,user_avatar,title,description,category,duration,view_count,like_count) VALUES (?,?,?,?,?,?,?,?,?,?)").run('vp_007','v003','王芳','王','流浪猫咪绝育全过程','TNR计划：诱捕-绝育-放归，控制流浪猫数量的科学方法','animal','08:00',2200,540)
db.prepare("INSERT OR IGNORE INTO video_posts (id,user_id,user_name,user_avatar,title,description,category,duration,view_count,like_count) VALUES (?,?,?,?,?,?,?,?,?,?)").run('vp_008','v001','陈敏','陈','急救侠的一天','跟急救侠陈敏在医院急诊室和志愿者服务中度过的24小时','daily','12:00',9300,1890)

// ---- Task Media (CPR task live updates) ----
db.prepare("INSERT OR IGNORE INTO task_media (id,task_id,user_id,user_name,user_avatar,type,content,created_at) VALUES (?,?,?,?,?,?,?,?)").run('tm_001','task_001','v002','李强','李','status','📍 我已到达现场，正在评估患者状况','2026-05-13 23:10:00')
db.prepare("INSERT OR IGNORE INTO task_media (id,task_id,user_id,user_name,user_avatar,type,content,created_at) VALUES (?,?,?,?,?,?,?,?)").run('tm_002','task_001','v002','李强','李','status','🫀 确认无意识无呼吸，立即开始 CPR 胸外按压','2026-05-13 23:10:30')
db.prepare("INSERT OR IGNORE INTO task_media (id,task_id,user_id,user_name,user_avatar,type,content,created_at) VALUES (?,?,?,?,?,?,?,?)").run('tm_003','task_001','v006','张伟','张','status','⚡ AED 已取出，正在前往现场，预计1分钟','2026-05-13 23:11:00')
db.prepare("INSERT OR IGNORE INTO task_media (id,task_id,user_id,user_name,user_avatar,type,content,created_at) VALUES (?,?,?,?,?,?,?,?)").run('tm_004','task_001','v006','张伟','张','status','✅ AED 到达！正在贴电极片，准备分析心律','2026-05-13 23:12:00')
db.prepare("INSERT OR IGNORE INTO task_media (id,task_id,user_id,user_name,user_avatar,type,content,created_at) VALUES (?,?,?,?,?,?,?,?)").run('tm_005','task_001','v006','张伟','张','text','⚡ 建议电击！所有人离开患者——按下电击键！','2026-05-13 23:12:15')
db.prepare("INSERT OR IGNORE INTO task_media (id,task_id,user_id,user_name,user_avatar,type,content,created_at) VALUES (?,?,?,?,?,?,?,?)").run('tm_006','task_001','v006','张伟','张','status','❤️ 电击成功！患者恢复自主心律，120 已到达','2026-05-13 23:14:00')
db.prepare("INSERT OR IGNORE INTO task_media (id,task_id,user_id,user_name,user_avatar,type,content,created_at) VALUES (?,?,?,?,?,?,?,?)").run('tm_007','task_002','v001','陈敏','陈','status','⚡ 我是陈敏，AED 在手，距太平金融大厦 200m 跑步中','2026-05-13 23:15:00')
db.prepare("INSERT OR IGNORE INTO task_media (id,task_id,user_id,user_name,user_avatar,type,content,created_at) VALUES (?,?,?,?,?,?,?,?)").run('tm_008','task_002','v001','陈敏','陈','status','✅ 已到达 15F，现场已有同事在做 CPR，我在准备 AED','2026-05-13 23:16:00')

// ---- Rescue Replays ----
db.prepare("INSERT OR IGNORE INTO rescue_replays (id,task_id,title,description,address,scene_type,patient_age,patient_gender,volunteers_count,duration,outcome,like_count,comment_count,bookmark_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('rp_001','task_001','深圳湾公园心脏骤停救援','50岁男性游客跑步中突发心脏骤停，3名急救侠志愿者4分钟内完成CPR+AED，患者恢复自主心律后交120送医','深圳湾公园南门','outdoor','50','男',3,'4分钟','成功',156,23,89)
db.prepare("INSERT OR IGNORE INTO rescue_replays (id,task_id,title,description,address,scene_type,patient_age,patient_gender,volunteers_count,duration,outcome,like_count,comment_count,bookmark_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('rp_002','task_002','福田CBD AED紧急送达','35岁女性办公室晕倒，同事CPR+AED火速送达，教科书式办公楼救援','福田CBD太平金融大厦','office','35','女',2,'8分钟','成功',98,15,42)

// ---- Replay Comments ----
db.prepare("INSERT OR IGNORE INTO replay_comments (id,replay_id,user_id,user_name,user_avatar,content) VALUES (?,?,?,?,?,?)").run('rc_001','rp_001','v006','张伟','张','教科书般的救援！从响应到AED只有2分钟，为所有志愿者点赞 👍')
db.prepare("INSERT OR IGNORE INTO replay_comments (id,replay_id,user_id,user_name,user_avatar,content) VALUES (?,?,?,?,?,?)").run('rc_002','rp_001','v005','赵丽','赵','看了回放学到了很多，特别是AED贴电极片的时机把握 💪')
db.prepare("INSERT OR IGNORE INTO replay_comments (id,replay_id,user_id,user_name,user_avatar,content) VALUES (?,?,?,?,?,?)").run('rc_003','rp_002','v003','王芳','王','办公室急救太重要了，建议每个企业都配备AED')

// ---- Live Sessions ----
db.prepare("INSERT OR IGNORE INTO live_sessions (id,task_id,user_id,user_name,user_avatar,device_info) VALUES (?,?,?,?,?,?)").run('live_001','task_001','v002','李强','李','iPhone 15')
db.prepare("INSERT OR IGNORE INTO live_sessions (id,task_id,user_id,user_name,user_avatar,device_info) VALUES (?,?,?,?,?,?)").run('live_002','task_001','v006','张伟','张','Xiaomi 14')

console.log('[Seed] Database seeded with mock data')
process.exit(0)
