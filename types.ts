export interface ApiSuccess<T> {
    readonly ok:   true
    readonly data: T
  }
  
  export interface ApiError {
    readonly ok:      false
    readonly code:    ErrorCode
    readonly message: string
  }
  
  export type ApiResponse<T> = ApiSuccess<T> | ApiError
  
  export const HTTP_STATUS = {
    OK:             200,
    CREATED:        201,
    NO_CONTENT:     204,
    BAD_REQUEST:    400,
    UNAUTHORIZED:   401,
    FORBIDDEN:      403,
    NOT_FOUND:      404,
    UNPROCESSABLE:  422,
    INTERNAL_ERROR: 500,
  } as const
  
  export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS]
  
  export type ErrorCode =
    | "VALIDATION_ERROR"
    | "VALUE_OUT_OF_RANGE"
    | "SENSOR_UNKNOWN"
    | "DATABASE_ERROR"
    | "NOT_FOUND"
    | "INTERNAL_ERROR"
    | "UNAUTHORIZED"
  
  export function ok<T>(data: T): ApiSuccess<T> {
    return { ok: true, data }
  }
  
  export function fail(code: ErrorCode, message: string): ApiError {
    return { ok: false, code, message }
  }