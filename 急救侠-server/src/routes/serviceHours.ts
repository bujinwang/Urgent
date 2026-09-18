/**
 * 志愿服务时长 + 证明 路由（挂 `/api/volunteer`，T02 / §4.3）。
 *
 * | 端点 | 鉴权 | 说明 |
 * |---|---|---|
 * | `GET  /service-hours/me` | `authMiddleware` | 我的时长（分页 + 分项） |
 * | `POST /service-certificates` | `authMiddleware` | 选区间签发证明（★ v1.3 同区间幂等） |
 * | `GET  /service-certificates/me` | `authMiddleware` | 我的证明列表 |
 * | `POST /service-certificates/:certNo/revoke` | `authMiddleware` | ★ v1.3 本人自撤（非本人 403） |
 * | `GET  /service-certificates/:certNo` | **公开** | 编号验真（仅 5 字段、零 PII）；**路由级限流** |
 *
 * ⚠️ **路由顺序**：`GET /service-certificates/me` **必须**注册在 `GET /:certNo` **之前**，
 * 否则 `me` 会被当成编号匹配到 `:certNo`。
 *
 * ⚠️ **严格路由级**：所有限流器一律 `router.<method>(path, limiter, handler)`。
 * **禁止** `app.use(prefix, limiter)` 前缀挂载（Express 前缀匹配会误伤同前缀路由；§7-11 / §11.10）。
 * 为便于测试注入 `force=true` 的真实限流器，本模块导出**工厂** `createServiceHoursRouter(verifyLimiter?)`。
 *
 * ⚠️ **鉴权铁律（硬约束 #1）**：身份一律 `req.auth?.userId || req.auth?.openid`，
 * **绝不读 `req.body.userId`**。公开验真端点**不带鉴权**（第三方可匿名验真）。
 */
import { Router, type RequestHandler } from 'express'
import { success, error } from '../types'
import type { ActivityType } from '../types'
import { authMiddleware } from '../middleware/auth'
import {
  createHourlyIpLimiter,
  SERVICE_CERT_VERIFY_LIMIT_ENV,
  SERVICE_CERT_VERIFY_HOURLY_LIMIT,
} from '../middleware/rateLimit'
import { getUserHours } from '../services/serviceLog'
import { issue, listMine, verify, revokeForUser } from '../services/serviceCertificate'

/** 从 token 派生身份（硬约束 #1）。 */
function identityOf(req: { auth?: { userId?: string; openid?: string } }): string {
  return req.auth?.userId || req.auth?.openid || ''
}

const ACTIVITY_TYPES: readonly string[] = ['rescue_task', 'drill', 'training', 'aed_checkin', 'manual']

/**
 * 构造路由。`verifyLimiter` 可注入（供测试传入 `force=true` 的真实限流器）；默认取生产限流器。
 */
export function createServiceHoursRouter(
  verifyLimiter: RequestHandler = createHourlyIpLimiter(
    SERVICE_CERT_VERIFY_LIMIT_ENV,
    SERVICE_CERT_VERIFY_HOURLY_LIMIT
  )
): Router {
  const router = Router()

  /** `GET /service-hours/me` —— 我的服务时长（auth）。 */
  router.get('/service-hours/me', authMiddleware, (req, res) => {
    try {
      const userId = identityOf(req as never)
      const page = Number.parseInt(String(req.query.page ?? ''), 10)
      const pageSize = Number.parseInt(String(req.query.pageSize ?? ''), 10)
      const rawType = String(req.query.activityType ?? '')
      const activityType = ACTIVITY_TYPES.includes(rawType) ? (rawType as ActivityType) : undefined

      const view = getUserHours(userId, {
        page: Number.isFinite(page) ? page : undefined,
        pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
        activityType,
      })
      res.json(success(view))
    } catch (e: any) {
      res.status(500).json(error(e.message || '服务器错误'))
    }
  })

  /** `POST /service-certificates` —— 选区间签发证明（auth；同区间幂等返回既有编号）。 */
  router.post('/service-certificates', authMiddleware, (req, res) => {
    try {
      const userId = identityOf(req as never)
      const fromMs = Number(req.body?.periodFromMs)
      const toMs = Number(req.body?.periodToMs)

      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
        return res.status(400).json(error('区间参数非法'))
      }
      if (fromMs >= toMs) {
        return res.status(400).json(error('区间非法：起始须早于结束'))
      }

      const cert = issue({ userId, fromMs, toMs })
      if (!cert) {
        // 冷启动/无数据：明确 400，绝不返回 0 时长的"空证明"。
        return res.status(400).json(error('该区间无可用服务记录'))
      }
      res.json(success(cert))
    } catch (e: any) {
      res.status(500).json(error(e.message || '服务器错误'))
    }
  })

  /** `GET /service-certificates/me` —— 我的证明列表（auth）。⚠️ 必须早于 `GET /:certNo`。 */
  router.get('/service-certificates/me', authMiddleware, (req, res) => {
    try {
      res.json(success(listMine(identityOf(req as never))))
    } catch (e: any) {
      res.status(500).json(error(e.message || '服务器错误'))
    }
  })

  /**
   * `POST /service-certificates/:certNo/revoke` —— **本人自撤**（★ v1.3，§11.9）。
   *
   * 仅本人（非本人 403）；已作废 ⇒ 幂等 200。**只作废证明本身、台账不动**（语义 B）。
   */
  router.post('/service-certificates/:certNo/revoke', authMiddleware, (req, res) => {
    try {
      const userId = identityOf(req as never)
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : ''
      const r = revokeForUser(userId, req.params.certNo, reason)
      if (r.outcome === 'not_found') return res.status(404).json(error('证明不存在'))
      if (r.outcome === 'forbidden') return res.status(403).json(error('无权作废他人证明'))
      res.json(success({ certNo: r.certNo, status: 'revoked' }, r.outcome === 'revoked' ? '已作废' : '该证明已作废'))
    } catch (e: any) {
      res.status(500).json(error(e.message || '服务器错误'))
    }
  })

  /**
   * `GET /service-certificates/:certNo` —— 编号验真（**公开**、零 PII）。
   *
   * ★ v1.3：限流器是**本路由的中间件**（`verifyLimiter`），不依赖任何路径语义、不受挂载点变化影响。
   */
  router.get('/service-certificates/:certNo', verifyLimiter, (req, res) => {
    try {
      const view = verify(req.params.certNo)
      if (!view) return res.status(404).json(error('证明不存在'))
      res.json(success(view))
    } catch (e: any) {
      res.status(500).json(error(e.message || '服务器错误'))
    }
  })

  return router
}

/** 生产实例（`app.ts` 挂载）。 */
export const serviceHoursRouter = createServiceHoursRouter()
