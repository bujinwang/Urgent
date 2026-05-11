import db, { initDb } from './db'

initDb()

// Clear existing data
db.exec('DELETE FROM users; DELETE FROM tasks; DELETE FROM aed_devices; DELETE FROM news; DELETE FROM courses; DELETE FROM volunteers; DELETE FROM rescue_records; DELETE FROM rescue_cases; DELETE FROM atlas_cards; DELETE FROM stats;')

// ---- User ----
db.prepare(`INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'user_001', '陆远', '陆', 'gold', 2340, '深圳', 'SZ-012',
  JSON.stringify(['CPR-AHA', 'AED-Operator']), 12
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
const aeds = [
  ['aed_001', '深圳湾公园 AED', '深圳湾公园南门入口', 22.517, 113.947, 80, 'available', '2025-05-01', 98],
  ['aed_002', '海岸城购物中心 AED', '海岸城 B1 层电梯旁', 22.518, 113.942, 320, 'available', '2025-04-28', 95],
  ['aed_003', '人才公园 AED', '人才公园北门保安室', 22.522, 113.952, 450, 'available', '2025-05-03', 100],
  ['aed_004', '南山区政府 AED', '南山区政府一楼大厅', 22.533, 113.930, 680, 'available', '2025-04-20', 88],
  ['aed_005', '南山书城 AED', '南山书城二楼服务台', 22.519, 113.938, 520, 'available', '2025-05-02', 92],
  ['aed_006', '深圳湾体育中心 AED', '春茧体育馆一楼', 22.521, 113.955, 600, 'available', '2025-04-25', 96],
  ['aed_007', '创维大厦 AED', '创维大厦 A 座大堂', 22.536, 113.948, 750, 'available', '2025-05-05', 99],
  ['aed_008', '腾讯滨海大厦 AED', '腾讯滨海大厦一楼', 22.524, 113.940, 400, 'available', '2025-04-30', 100],
]
const insertAed = db.prepare('INSERT INTO aed_devices (id, name, address, lat, lng, distance, status, last_check, battery_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
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
const vols = [
  ['v001', '陆远', '陆', 'gold', 2340, 12, '深圳', 1],
  ['v002', '陈敏', '陈', 'diamond', 5120, 38, '深圳', 2],
  ['v003', '王芳', '王', 'gold', 1890, 9, '广州', 3],
  ['v004', '李强', '李', 'gold', 1780, 15, '深圳', 4],
  ['v005', '赵丽', '赵', 'silver', 920, 5, '北京', 5],
  ['v006', '张伟', '张', 'silver', 850, 7, '上海', 6],
  ['v007', '孙静', '孙', 'silver', 780, 4, '深圳', 7],
  ['v008', '周明', '周', 'bronze', 520, 2, '广州', 8],
  ['v009', '吴婷', '吴', 'bronze', 480, 3, '深圳', 9],
  ['v010', '郑磊', '郑', 'bronze', 350, 1, '深圳', 10],
]
const insertVol = db.prepare('INSERT INTO volunteers (id, name, avatar, tier, points, rescue_count, city, rank_pos) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
for (const v of vols) insertVol.run(...v)

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

console.log('[Seed] Database seeded with mock data')
process.exit(0)
