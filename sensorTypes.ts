export enum SensorType {
  POSTURE    = "POSTURE",
  EYE_STRAIN = "EYE_STRAIN",
  ACTIVITY   = "ACTIVITY",
  STRESS     = "STRESS",
  LIGHT      = "LIGHT",
  HEART_RATE = "HEART_RATE",
}

export type SensorValueMap = { [K in SensorType]: number }

export interface SensorEvent<T extends SensorType> {
  readonly type:      T
  readonly value:     number
  readonly timestamp: number
}

export interface ExtendedSensorEvent<T extends SensorType> extends SensorEvent<T> {
  readonly error?: unknown
}

export type Recommendation =
  | "AllGood"
  | "FixPosture"
  | "MoveBody"
  | "RestEyes"
  | "ReduceStress"
  | "IncreaseLight"
  | "TakeVitamins"

export interface UserState {
  readonly postureScore:    number
  readonly eyeFatigue:      number
  readonly activityLevel:   number
  readonly heartRate:       number
  readonly overallScore:    number
  readonly stressLevel:     number
  readonly lightLevel:      number
  readonly lastVitaminTime: number
}

export type LogLevel = "info" | "warn" | "error"

export interface LogEntry<T> {
  readonly level:     LogLevel
  readonly entry:     T
  readonly timestamp: number
}

export class Logger<T> {
  private readonly logs: LogEntry<T>[] = []
  private readonly maxLogs: number
  private readonly silent: boolean

  constructor(maxLogs = 1000, silent = false) {
    if (!Number.isInteger(maxLogs) || maxLogs < 1) {
      throw new Error(`Logger: maxLogs must be a positive integer, got ${maxLogs}`)
    }
    this.maxLogs = maxLogs
    this.silent  = silent
  }

  private cloneEntry(entry: T): T {
    try {
      return structuredClone(entry)
    } catch {
      return { ...(entry as object) } as T
    }
  }

  private addLog(level: LogLevel, entry: T): void {
    while (this.logs.length >= this.maxLogs) {
      this.logs.shift()
    }
    this.logs.push({ level, entry: this.cloneEntry(entry), timestamp: Date.now() })
  }

  info(entry: T): void {
    if (!this.silent) console.info(`[INFO  ${new Date().toISOString()}]`, entry)
    this.addLog("info", entry)
  }

  warn(entry: T): void {
    if (!this.silent) console.warn(`[WARN  ${new Date().toISOString()}]`, entry)
    this.addLog("warn", entry)
  }

  error(entry: T): void {
    if (!this.silent) console.error(`[ERROR ${new Date().toISOString()}]`, entry)
    this.addLog("error", entry)
  }

  getAll(): ReadonlyArray<LogEntry<T>> {
    return [...this.logs]
  }

  getByLevel(level: LogLevel): ReadonlyArray<LogEntry<T>> {
    return this.logs.filter(log => log.level === level)
  }

  clear(): void {
    this.logs.length = 0
  }

  printAll(): void {
    this.logs.forEach(({ level, entry, timestamp }) =>
      console.log(`[${level.toUpperCase().padEnd(5)} ${new Date(timestamp).toISOString()}]`, entry)
    )
  }
}

export const defaultLogger = new Logger<ExtendedSensorEvent<SensorType>>(500)