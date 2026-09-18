/**
 * 限流器工厂（★ v1.3，§11.10 / §7-11）。
 *
 * **为什么独立成模块**：`routes/*` 需要把限流器作为**路由级中间件**引入
 * （`router.<method>(path, limiter, handler)`），而 `app.ts` 又要 `import` 这些 router
 * ⇒ 若工厂仍留在 `app.ts`，会形成 `app.ts → routes/* → app.ts` 的**循环依赖**
 * （ESM 下可能拿到未初始化绑定 ⇒ 启动即崩，且堆栈指向无辜模块，同 F2 `tabbar-locale` 的 TDZ 教训）。
 * 故工厂必须**独立于此模块**，`app.ts` 与各 router **各自** import。
 *
 * ⚠️ **一律路由级挂载**：`router.<method>(path, limiter, handler)`。
 * **禁止** `app.use(prefix, limiter)` 前缀挂载 —— Express 的 `app.use(path, …)` 是**前缀匹配**，
 * 会**误伤同前缀的其它路由**（实测：`/api/volunteer/service-certificates` 前缀会连 `GET /me`、
 * `POST /` 一起限流）；若在限流器内部用 `req.path` 区分路由，则**依赖相对路径语义**、
 * 挂载点一变即**静默失效**。
 */
import rateLimit from 'express-rate-limit'

/**
 * 测试模式（`:memory:` 或 `NODE_ENV=test`）下限流一律豁免。
 *
 * ⚠️ 用**函数**而非模块级常量：避免「模块求值早于 `process.env.DB_PATH` 被设置」的**导入顺序陷阱**
 * （测试里 `setup.ts` 先设 `DB_PATH=':memory:'` 再 import app；若此处是常量，任何提前 import 本模块的
 * 测试文件都会把 `isTestMode` 求值成 `false` ⇒ 限流在测试中**意外生效**）。工厂的 `force=true` 可绕过豁免。
 */
export function isTestMode(): boolean {
  return process.env.DB_PATH === ':memory:' || process.env.NODE_ENV === 'test'
}

/** 阿里云短信状态报告回调：限流参数（导出以便单测断言）。 */
export const SMS_REPORT_LIMIT = { windowMs: 60 * 1000, max: 60 } as const

/** 阿里云短信状态报告回调限流中间件（公开端点，沿用测试豁免模式）。
 * `force=true` 时**绕过测试豁免**，返回真实限流器（供测试注入验证）。
 * 阈值可用 env `SMS_REPORT_MINUTE_LIMIT` 覆盖（与其它限流器一致）。 */
export function createSmsReportLimiter(force = false) {
  if (isTestMode() && !force) return (req: any, _res: any, next: any) => next()
  const n = parseInt(process.env.SMS_REPORT_MINUTE_LIMIT || '', 10)
  const max = Number.isFinite(n) && n > 0 ? n : SMS_REPORT_LIMIT.max
  return rateLimit({
    windowMs: SMS_REPORT_LIMIT.windowMs,
    max,
    message: { code: -1, message: '请求过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

/**
 * 匿名端点的**按 IP 小时限流**（复用测试豁免模式）；`force=true` 绕过豁免（供测试）。
 * 阈值可用 env 覆盖（缺省用 `def`）。仅**限频**，**不加登录要求**（保持"急救现场无需注册"）。
 */
export function createHourlyIpLimiter(envKey: string, def: number, force = false) {
  if (isTestMode() && !force) return (req: any, _res: any, next: any) => next()
  const n = parseInt(process.env[envKey] || '', 10)
  const max = Number.isFinite(n) && n > 0 ? n : def
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max,
    message: { code: -1, message: '操作过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

/**
 * 阈值缺省值（导出以便单测断言）。
 *
 * `sosEvent` = 120 次/小时/IP，明显高于其它匿名端点，是**唯一的"故意放宽"**，理由（详见设计文档 §4）：
 * 1. 本端点**无任何外部调用**（不发短信、不推送、不写盘）⇒ **无放大效应**，滥用风险有界在磁盘增长。
 * 2. 上报是旁路且失败静默 ⇒ 撞限流的代价是"丢一条记录"，而阈值定低损失的是**最需要留痕**的那部分
 *    （共享出口 IP 的医院/学校/企业 NAT，以及网络抖动）。
 * 3. 与 `inquire`（5 次/小时）不同，合法调用频率**不由客户端控制**：一次真实急救 = 一次用户主动触发，
 *    而同一出口 IP 背后可能站着成百上千人。
 */
export const ANON_LIMITS = { mediaUpload: 10, inquire: 5, sosEvent: 120 } as const

/** 服务证明**验真**端点默认阈值（次/小时/IP，Q7；导出以便单测断言）。 */
export const SERVICE_CERT_VERIFY_HOURLY_LIMIT = 60

/** 验真端点限流器的 env 键（阈值可 env 覆盖）。 */
export const SERVICE_CERT_VERIFY_LIMIT_ENV = 'SERVICE_CERT_VERIFY_HOURLY_LIMIT'
