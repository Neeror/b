import type { Request, Response, NextFunction } from "express"
import { HTTP_STATUS, fail } from "../../shared/types.js"

export interface ValidOk<T> {
  readonly ok:   true
  readonly data: T
}

export interface ValidFail {
  readonly ok:      false
  readonly message: string
}

export type ValidatorResult<T> = ValidOk<T> | ValidFail

export type Validator<T> = (body: unknown) => ValidatorResult<T>

export function validate<T>(validator: Validator<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validator(req.body)
    if (!result.ok) {
      res.status(HTTP_STATUS.UNPROCESSABLE).json(fail("VALIDATION_ERROR", result.message))
      return
    }
    req.body = result.data
    next()
  }
}