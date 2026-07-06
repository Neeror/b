import { Router } from "express"
import type { Request, Response } from "express"
import { SensorType, Logger } from "../../../sensor/types/sensorTypes.js"
import type { ExtendedSensorEvent, SensorEvent } from "../../../sensor/types/sensorTypes.js"
import { handleSensorEvent, getAllSensors, validateSensorValue, SENSOR_LIMITS } from "../../../sensor/handlers/handleSensorEvent.js"
import { checkMyState } from "../../../sensor/processors/processValue.js"
import type { StateCheckResult } from "../../../sensor/processors/processValue.js"
import { HTTP_STATUS, ok, fail } from "../../../shared/types.js"
import { validate } from "../../middleware/validate.middleware.js"
import type { Validator } from "../../middleware/validate.middleware.js"
import type { AppServer, SensorReading } from "../../socket/socket.handler.js"

const sensorLogger = new Logger<ExtendedSensorEvent<SensorType>>(500)
const stateLogger  = new Logger<StateCheckResult>(200)


const MAX_FUTURE_DRIFT_MS = 60_000

const MAX_AGE_MS = 24 * 60 * 60 * 1000

interface SensorBody {
  readonly type:      SensorType
  readonly value:     number
  readonly timestamp: number
}

const validateSensorBody: Validator<SensorBody> = (body) => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "Body must be a JSON object" }
  }

  const { type, value, timestamp } = body as Record<string, unknown>

  if (!Object.values(SensorType).includes(type as SensorType)) {
    return { ok: false, message: `type must be one of: ${Object.values(SensorType).join(", ")}` }
  }

  if (typeof value !== "number" || !isFinite(value)) {
    return { ok: false, message: "value must be a finite number" }
  }

  if (!validateSensorValue(value, type as SensorType)) {
    const { min, max } = SENSOR_LIMITS[type as SensorType]
    return { ok: false, message: `value must be between ${min} and ${max} for ${String(type)}` }
  }

  if (typeof timestamp !== "number" || !isFinite(timestamp) || timestamp < 0) {
    return { ok: false, message: "timestamp must be a non-negative finite number" }
  }

  const now = Date.now()
  if (timestamp > now + MAX_FUTURE_DRIFT_MS) {
    return { ok: false, message: "timestamp must not be in the future" }
  }
  if (timestamp < now - MAX_AGE_MS) {
    return { ok: false, message: "timestamp is too old (max 24h)" }
  }

  return { ok: true, data: { type: type as SensorType, value, timestamp } }
}

export function createSensorRouter(io: AppServer): Router {
  const router = Router()

  router.post(
    "/sensor",
    validate(validateSensorBody),
    (req: Request, res: Response): void => {
      const body  = req.body as SensorBody
      const event: SensorEvent<SensorType> = { type: body.type, value: body.value, timestamp: body.timestamp }

      handleSensorEvent(event, sensorLogger)

      const reading: SensorReading = { type: body.type, value: body.value, timestamp: body.timestamp }
      io.emit("sensor:update", reading)

      res.status(HTTP_STATUS.CREATED).json(ok(reading))
    }
  )

  router.get("/sensors", (_req: Request, res: Response): void => {
    res.status(HTTP_STATUS.OK).json(ok(getAllSensors()))
  })

  router.get("/state", (_req: Request, res: Response): void => {
    try {
      const result = checkMyState(stateLogger)
      res.status(HTTP_STATUS.OK).json(ok(result))
    } catch (err) {
      console.error(`[API] ${new Date().toISOString()} GET /state failed:`, err)
      res.status(HTTP_STATUS.INTERNAL_ERROR).json(fail("INTERNAL_ERROR", "Failed to check state"))
    }
  })

  return router
}
