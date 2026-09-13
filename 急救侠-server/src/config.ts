import crypto from 'crypto'

/**
 * 急救侠 共享配置
 *
 * 环境变量在模块加载时一次性捕获，所有模块通过此文件读取。
 */

// ---- 业务 JWT 密钥（安全收敛 B）----
// 生产环境**必须**显式配置：缺失即 fail-fast 阻止启动（不再使用可预测的弱默认值）。
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('[config] 生产环境必须配置 JWT_SECRET（拒绝以弱默认密钥启动）')
}
export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') {
  console.warn('[config] JWT_SECRET 未配置，已生成进程级随机密钥（生产必须显式配置；重启会使已签发令牌失效）')
}
export const WECHAT_APPID = process.env.WECHAT_APPID || ''
export const WECHAT_SECRET = process.env.WECHAT_SECRET || ''
export const DB_PATH = process.env.DB_PATH || './data/jiujiaxia.db'
export const PORT = parseInt(process.env.PORT || '3001', 10)

// ---- 阿里云短信（AED 责任人联动「推送失败 → 即时短信降级」，P1）----
// 配置门控：前 4 项**任一为空**即视为功能关闭（降级为既有行为），dev/test 静默、不打 warn。
// 生产启用需：企业实名 + 短信签名/模板报备，拿到真实值后填入（见 .env.example）。
export const ALIYUN_SMS_ACCESS_KEY_ID = process.env.ALIYUN_SMS_ACCESS_KEY_ID || ''
export const ALIYUN_SMS_ACCESS_KEY_SECRET = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || ''
export const ALIYUN_SMS_SIGN_NAME = process.env.ALIYUN_SMS_SIGN_NAME || ''
export const ALIYUN_SMS_TEMPLATE_CODE = process.env.ALIYUN_SMS_TEMPLATE_CODE || ''
export const ALIYUN_SMS_REGION = process.env.ALIYUN_SMS_REGION || 'cn-hangzhou'

// ---- 阿里云语音降级（AED 责任人联动：短信状态报告「未送达」→ 语音呼叫，P1）----
// 配置门控：`ALIYUN_VOICE_TTS_CODE`（+ 上方 AK/SK）齐备才算开启；缺失即降级为既有行为。
// 主叫号（`ALIYUN_VOICE_CALLER_NUMBER`）**可选**：留空 = **公共模式**（公共号码池调度，无需购买号码）；
// 填值 = **专属模式**（须与实际购买号码一致，且 TTS 模板「外呼模式」必须匹配）。
export const ALIYUN_VOICE_TTS_CODE = process.env.ALIYUN_VOICE_TTS_CODE || ''
export const ALIYUN_VOICE_CALLER_NUMBER = process.env.ALIYUN_VOICE_CALLER_NUMBER || ''
// 短信状态报告回调验真密钥：未配置 → 回调端点整体关闭（返回 404，不暴露端点存在）。
export const ALIYUN_SMS_REPORT_SECRET = process.env.ALIYUN_SMS_REPORT_SECRET || ''

// ---- 反代信任跳数（安全：IP 限流依赖**真实客户端 IP**）----
// 生产链路：Caddy(443) → nginx(web:80) → server ⇒ **2 跳**。必须与**真实链路一致**：
//   设**过多** = 允许客户端伪造 `X-Forwarded-For` 绕过限流；设 `0` = 关闭（服务被直接暴露时用）。
//   绝不使用 `true`（express-rate-limit 会因过宽报错，且允许伪造 XFF）。
export const TRUST_PROXY_HOPS = (() => {
  const n = parseInt(process.env.TRUST_PROXY_HOPS || '', 10)
  return Number.isFinite(n) && n >= 0 ? n : 2
})()

// ---- 政府数据监管看板（P2-8）----
// 政府访问令牌**必须**使用独立密钥：绝不回落到业务 `JWT_SECRET`
// （否则 gov 令牌可通过业务 authMiddleware 验签 → 违反「互不通用」锁定决策）。
// 未显式配置时生成**进程级随机密钥**，保证与业务密钥不同（重启后 gov 令牌失效，生产请显式配置）。
export const GOV_JWT_SECRET = process.env.GOV_JWT_SECRET || crypto.randomBytes(32).toString('hex')
export const GOV_TOKEN_TTL = process.env.GOV_TOKEN_TTL || '12h'

if (!process.env.GOV_JWT_SECRET && process.env.NODE_ENV !== 'test') {
  console.warn('[config] GOV_JWT_SECRET 未配置，已生成进程级随机密钥（生产环境请显式配置，否则重启将使政府令牌失效）')
}
