/**
 * 请求体 Zod 校验中间件
 *
 * 用法：
 *   import { z } from 'zod'
 *   import { validate } from '../middleware/validate'
 *
 *   router.post('/endpoint', validate(MySchema), handler)
 */

import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      return res.status(400).json({
        code: -1,
        message: '请求参数校验失败',
        errors,
      })
    }
    req.body = result.data
    next()
  }
}
