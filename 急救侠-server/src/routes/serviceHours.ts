/**
 * 志愿服务时长 + 证明 路由（挂 `/api/volunteer`，T02 / §4.3）。
 *
 * | 端点 | 鉴权 | 说明 |
 * |---|---|---|
 * | `GET  /service-hours/me` | `authMiddleware` | 我的时长（分页 + 分项） |
 * | `POST /service-certificates` | `authMiddleware` | 选区间签发证明 |
 * | `GET  /service-certificates/me` | `authMiddleware` | 我的证明列表 |
 * | `GET  /service-certificates/:certNo` | **公开** | 编号验真（仅 5 字段、零 PII；限流在 app.ts） |
 *
 * ⚠️ **路由顺序**：`/service-certificates/me` **必须**注册在 `/:certNo` **之前**，
 * 否则 `me` 会被当成编号匹配到 `:certNo`。这是本文件最易写错处，勿调整顺序。
 *
 * ⚠️ **鉴权铁律（硬约束 #1）**：身份一律 `req.auth?.userId || req.auth?.openid`，
 * **绝不读 `req.body.userId`**。公开验真端点**不带鉴权**（第三方可匿名验真）。
 */
import { Router } from 'express'
import { success, error } from '../types'
import type { ActivityType } from '../types'
import { authMiddleware } from '../middleware/auth'
import { getUserHours } from '../services/serviceLog'
import { issue, listMine, verify } from '../services/serviceCertificate'

export const serviceHoursRouter = Router()

/** 从 token 派生身份（硬约束 #1）；无则以空串表示（调用方按需拒绝）。 */
function identityOf(req: { auth?: { userId?: string; openid?: string } }): string {
  return req.auth?.userId || req.auth?.openid || ''
}

const ACTIVITY_TYPES: readonly string[] = ['rescue_task', 'drill', 'training', 'aed_checkin', 'manual']

/** `GET /service-hours/me` —— 我的服务时长（auth）。 */
serviceHoursRouter.get('/service-hours/me', authMiddleware, (req, res) => {
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

/** `POST /service-certificates` —— 选区间签发证明（auth）。 */
serviceHoursRouter.post('/service-certificates', authMiddleware, (req, res) => {
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

/** `GET /service-certificates/me` —— 我的证明列表（auth）。⚠️ 必须早于 `/:certNo`。 */
serviceHoursRouter.get('/service-certificates/me', authMiddleware, (req, res) => {
  try {
    res.json(success(listMine(identityOf(req as never))))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/**
 * `GET /service-certificates/:certNo` —— 编号验真（**公开**、零 PII）。
 *
 * 限流**不在此处**：由 `app.ts` 在该前缀上按 IP 限流，且**只作用于本验真路径**
 * （见 `app.ts` 的 `createServiceCertVerifyLimiter`）。
 */
serviceHoursRouter.get('/service-certificates/:certNo', (req, res) => {
  try {
    const view = verify(req.params.certNo)
    if (!view) return res.status(404).json(error('证明不存在'))
    res.json(success(view))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
