import type { SensorValueMap, SensorEvent, ExtendedSensorEvent } from "../types/sensorTypes.js"
import { SensorType, Logger } from "../types/sensorTypes.js"

interface SensorLimits {
  readonly min:     number
  readonly max:     number
  readonly default: number
}

export const SENSOR_LIMITS = {
  [SensorType.POSTURE]:    { min: 0,  max: 100,  default: 100 },
  [SensorType.EYE_STRAIN]: { min: 0,  max: 100,  default: 0   },
  [SensorType.ACTIVITY]:   { min: 0,  max: 100,  default: 50  },
  [SensorType.STRESS]:     { min: 0,  max: 100,  default: 20  },
  [SensorType.LIGHT]:      { min: 0,  max: 1000, default: 400 },
  [SensorType.HEART_RATE]: { min: 30, max: 220,  default: 70  },
} as const satisfies Record<SensorType, SensorLimits>

const sensorStore: SensorValueMap = {
  [SensorType.POSTURE]:    SENSOR_LIMITS[SensorType.POSTURE].default,
  [SensorType.EYE_STRAIN]: SENSOR_LIMITS[SensorType.EYE_STRAIN].default,
  [SensorType.ACTIVITY]:   SENSOR_LIMITS[SensorType.ACTIVITY].default,
  [SensorType.STRESS]:     SENSOR_LIMITS[SensorType.STRESS].default,
  [SensorType.LIGHT]:      SENSOR_LIMITS[SensorType.LIGHT].default,
  [SensorType.HEART_RATE]: SENSOR_LIMITS[SensorType.HEART_RATE].default,
}

export function validateSensorValue(value: number, sensor: SensorType): boolean {
  if (typeof value !== "number" || isNaN(value) || !isFinite(value)) return false
  if (!(sensor in SENSOR_LIMITS)) return false
  const { min, max } = SENSOR_LIMITS[sensor]
  return value >= min && value <= max
}

export function setSensorValue<T extends SensorType>(
  type: T,
  value: SensorValueMap[T],
  store?: SensorValueMap
): boolean {
  if (!validateSensorValue(value, type)) return false
  const target = store ?? sensorStore
  target[type] = value
  return true
}

export function getSensorValue<T extends SensorType>(type: T): SensorValueMap[T] {
  return sensorStore[type]
}

export function getAllSensors(): Readonly<SensorValueMap> {
  return { ...sensorStore }
}

export function resetSensors(): void {
  for (const type of Object.values(SensorType)) {
    sensorStore[type] = SENSOR_LIMITS[type].default
  }
}

export function handleSensorEvent<T extends SensorType>(
  event: SensorEvent<T>,
  logger: Logger<ExtendedSensorEvent<T>>
): void {
  try {
    if (!validateSensorValue(event.value, event.type)) {
      logger.warn({ ...event, error: "Value out of range" })
      return
    }
    setSensorValue(event.type, event.value)
    logger.info({ ...event })
  } catch (err) {
    try {
      logger.error({ ...event, error: err })
    } catch {
    }
  }
}