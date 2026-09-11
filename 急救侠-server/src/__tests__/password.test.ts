import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { server, seedTestData, db } from './setup'
import { hashPassword, verifyPassword, isHashed, HASH_PREFIX } from '../services/password'

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads')
const createdFiles: string[] = []

afterAll(() => {
  for (const p of createdFiles) {
    try { fs.rmSync(p, { force: true }) } catch { /* 忽略 */ }
  }
})

describe('口令哈希工具（安全收敛 A）', () => {
  it('hashPassword 输出带版本前缀的哈希，非明文', () => {
    const h = hashPassword('pw123456')
    expect(h.startsWith(HASH_PREFIX)).toBe(true)
    expect(h).not.toContain('pw123456')
    expect(isHashed(h)).toBe(true)
    expect(isHashed('pw123456')).toBe(false)
  })

  it('verifyPassword round-trip / 错误口令 / 非法输入', () => {
    const h = hashPassword('pw123456')
    expect(verifyPassword('pw123456', h)).toBe(true)
    expect(verifyPassword('wrong', h)).toBe(false)
    expect(verifyPassword('pw123456', 's1$bad')).toBe(false)
    expect(verifyPassword('pw123456', 'pw123456')).toBe(false) // 明文不是哈希，返回 false
    expect(verifyPassword('pw123456', '')).toBe(false)
  })

  it('兼容历史 govAuth 的 salt:hash 格式（gov 行为等价）', () => {
    const salt = crypto.randomBytes(16).toString('hex')
    const legacy = `${salt}:${crypto.scryptSync('govpass', salt, 64).toString('hex')}`
    expect(verifyPassword('govpass', legacy)).toBe(true)
    expect(verifyPassword('nope', legacy)).toBe(false)
  })
})

describe('口令入库与登录（安全收敛 A，端到端）', () => {
  beforeEach(() => { seedTestData() })

  const PHONE = '13600136000'
  const PWD = 'pw123456'

  it('注册后库中存的是哈希（非明文）', async () => {
    const res = await request(server).post('/api/auth/register').send({ phone: PHONE, password: PWD })
    expect(res.status).toBe(200)
    const row = db.prepare('SELECT password FROM users WHERE id = ?').get('u_' + PHONE) as { password: string }
    expect(row.password.startsWith(HASH_PREFIX)).toBe(true)
    expect(row.password).not.toBe(PWD)
  })

  it('正确口令登录成功 / 错误口令失败', async () => {
    await request(server).post('/api/auth/register').send({ phone: PHONE, password: PWD })
    const ok = await request(server).post('/api/auth/login').send({ phone: PHONE, password: PWD })
    expect(ok.body.code).toBe(0)
    const bad = await request(server).post('/api/auth/login').send({ phone: PHONE, password: 'wrong-pw' })
    expect(bad.body.code).toBe(-1)
  })

  it('存量明文用户：登录成功后透明升级为哈希，且可再次登录', async () => {
    // 造一个「存量明文」账号
    db.prepare('INSERT INTO users (id,name,avatar,tier,points,city,volunteer_id,certifications,rescue_count,password) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run('u_' + PHONE, '存量用户', '存', 'bronze', 0, '', 'PH-1360', '[]', 0, PWD)

    const legacyBefore = db.prepare('SELECT password FROM users WHERE id = ?').get('u_' + PHONE) as { password: string }
    expect(legacyBefore.password).toBe(PWD) // 确为明文

    const login = await request(server).post('/api/auth/login').send({ phone: PHONE, password: PWD })
    expect(login.body.code).toBe(0)

    const after = db.prepare('SELECT password FROM users WHERE id = ?').get('u_' + PHONE) as { password: string }
    expect(after.password.startsWith(HASH_PREFIX)).toBe(true) // 已升级
    expect(after.password).not.toBe(PWD)

    const again = await request(server).post('/api/auth/login').send({ phone: PHONE, password: PWD })
    expect(again.body.code).toBe(0) // 升级后仍可登录
  })

  it('change-password 存哈希，且新口令可登录', async () => {
    await request(server).post('/api/auth/register').send({ phone: PHONE, password: PWD })
    const login = await request(server).post('/api/auth/login').send({ phone: PHONE, password: PWD })
    const token = login.body.data.token as string

    const res = await request(server)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: PHONE, oldPassword: PWD, newPassword: 'newpw123' })
    expect(res.body.code).toBe(0)

    const row = db.prepare('SELECT password FROM users WHERE id = ?').get('u_' + PHONE) as { password: string }
    expect(row.password.startsWith(HASH_PREFIX)).toBe(true)

    const relogin = await request(server).post('/api/auth/login').send({ phone: PHONE, password: 'newpw123' })
    expect(relogin.body.code).toBe(0)
  })

  it('reset-password 存哈希（需本人令牌，F1 之后）', async () => {
    const reg = await request(server).post('/api/auth/register').send({ phone: PHONE, password: PWD })
    expect(reg.body.code).toBe(0)
    const res = await request(server)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${reg.body.data.token as string}`)
      .send({ phone: PHONE, newPassword: 'resetpw1' })
    expect(res.body.code).toBe(0)
    const row = db.prepare('SELECT password FROM users WHERE id = ?').get('u_' + PHONE) as { password: string }
    expect(row.password.startsWith(HASH_PREFIX)).toBe(true)
  })
})

describe('安全收敛 C/D/F：body 上限 / 安全头 / 上传校验', () => {
  beforeEach(() => { seedTestData() })

  it('C: 超大 JSON body 被拒（413）', async () => {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ phone: '13800138000', password: 'pw123456', pad: 'x'.repeat(1_100_000) })
    expect(res.status).toBe(413)
  })

  it('D: 安全响应头存在（helmet）', async () => {
    const res = await request(server).get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBeDefined()
    expect(res.headers['referrer-policy']).toBeDefined()
  })

  it('F: /api/upload 拒绝非 data URL / 非白名单类型', async () => {
    const notDataUrl = await request(server).post('/api/upload').send({ image: 'aGVsbG8=' })
    expect(notDataUrl.status).toBe(400)
    const badMime = await request(server)
      .post('/api/upload')
      .send({ image: 'data:application/pdf;base64,' + Buffer.from('x').toString('base64') })
    expect(badMime.status).toBe(400)
  })

  it('F: /api/upload 接受白名单图片并返回可访问 URL', async () => {
    const res = await request(server)
      .post('/api/upload')
      .send({ image: 'data:image/png;base64,' + Buffer.from('fake-png-bytes').toString('base64') })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.url).toMatch(/^\/uploads\/upload_/)
    createdFiles.push(path.join(UPLOADS_DIR, path.basename(res.body.data.url as string)))
  })
})
