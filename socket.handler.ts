import type { Server, Socket } from "socket.io"
import { SensorType, Logger } from "../../sensor/types/sensorTypes.js"
import type { ExtendedSensorEvent, SensorEvent } from "../../sensor/types/sensorTypes.js"
import { handleSensorEvent, validateSensorValue } from "../../sensor/handlers/handleSensorEvent.js"
import { checkMyState, takeVitamins } from "../../sensor/processors/processValue.js"
import type { StateCheckResult } from "../../sensor/processors/processValue.js"

export interface SensorReading {
  readonly type:      string
  readonly value:     number
  readonly timestamp: number
}

export interface ServerToClientEvents {
  "sensor:update": (reading: SensorReading) => void
  "state:update":  (result: StateCheckResult) => void
  "error":         (error: { code: string; message: string }) => void
}

export interface ClientToServerEvents {
  "check:state":    (callback: (result: StateCheckResult) => void) => void
  "sensor:manual":  (reading: SensorReading) => void
  "vitamins:taken": () => void
  "focus:toggle":   (enabled: boolean) => void
}

export interface InterServerEvents {
  ping: () => void
}

export type SocketData = {
  sessionId?: string
}

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

const socketLogger = new Logger<ExtendedSensorEvent<SensorType>>(300)
const stateLogger  = new Logger<StateCheckResult>(100)


const RATE_CAPACITY  = 20   
const RATE_REFILL_MS = 50   

interface TokenBucket {
  tokens: number
  lastRefill: number
}

function takeToken(bucket: TokenBucket): boolean {
  const now = Date.now()
  const elapsed = now - bucket.lastRefill
  if (elapsed > 0) {
    bucket.tokens = Math.min(RATE_CAPACITY, bucket.tokens + elapsed / RATE_REFILL_MS)
    bucket.lastRefill = now
  }
  if (bucket.tokens < 1) return false
  bucket.tokens -= 1
  return true
}


const MAX_CONNECTIONS_PER_IP = 10
const connectionsByIp = new Map<string, number>()


function isValidReadingShape(reading: unknown): reading is SensorReading {
  if (typeof reading !== "object" || reading === null || Array.isArray(reading)) return false
  const r = reading as Record<string, unknown>
  return (
    typeof r.type === "string" &&
    typeof r.value === "number" && isFinite(r.value) &&
    typeof r.timestamp === "number" && isFinite(r.timestamp) && r.timestamp >= 0
  )
}

function handleManualSensor(socket: AppSocket, io: AppServer, reading: SensorReading): void {
  const type = reading.type as SensorType

  if (!Object.values(SensorType).includes(type)) {
    socket.emit("error", { code: "SENSOR_UNKNOWN", message: "Unknown sensor type" })
    return
  }

  if (!validateSensorValue(reading.value, type)) {
    socket.emit("error", { code: "VALUE_OUT_OF_RANGE", message: `Value out of range for ${type}` })
    return
  }

  const event: SensorEvent<typeof type> = { type, value: reading.value, timestamp: reading.timestamp }
  handleSensorEvent(event, socketLogger)
  io.emit("sensor:update", { type, value: reading.value, timestamp: reading.timestamp })
}

export function registerSocketHandlers(io: AppServer): void {
  io.use((socket, next) => {
    const ip = socket.handshake.address
    const count = connectionsByIp.get(ip) ?? 0
    if (count >= MAX_CONNECTIONS_PER_IP) {
      next(new Error("Too many connections from this address"))
      return
    }
    connectionsByIp.set(ip, count + 1)
    next()
  })

  io.on("connection", (socket: AppSocket) => {
    console.info(`[Socket] Client connected: ${socket.id}`)

    const ip = socket.handshake.address
    const bucket: TokenBucket = { tokens: RATE_CAPACITY, lastRefill: Date.now() }

    function allow(): boolean {
      if (takeToken(bucket)) return true
      socket.emit("error", { code: "RATE_LIMITED", message: "Too many events, slow down" })
      return false
    }

    socket.on("check:state", (callback) => {
      if (!allow()) return
      try {
        const result = checkMyState(stateLogger)
        if (typeof callback === "function") callback(result)
        socket.emit("state:update", result)
      } catch (err) {
        console.error("[Socket] check:state error:", err)
        socket.emit("error", { code: "INTERNAL_ERROR", message: "Failed to check state" })
      }
    })

    socket.on("sensor:manual", (reading) => {
      if (!allow()) return
      if (!isValidReadingShape(reading)) {
        socket.emit("error", { code: "VALIDATION_ERROR", message: "Invalid sensor payload" })
        return
      }
      handleManualSensor(socket, io, reading)
    })

    socket.on("vitamins:taken", () => {
      if (!allow()) return
      takeVitamins()
    })

    socket.on("focus:toggle", (enabled) => {
      if (!allow()) return
      if (typeof enabled !== "boolean") {
        socket.emit("error", { code: "VALIDATION_ERROR", message: "focus:toggle expects a boolean" })
        return
      }
      console.info(`[Socket] Focus mode ${enabled ? "ON" : "OFF"} — ${socket.id}`)
    })

    socket.on("disconnect", (reason) => {
      const count = connectionsByIp.get(ip) ?? 1
      if (count <= 1) connectionsByIp.delete(ip)
      else connectionsByIp.set(ip, count - 1)
      console.info(`[Socket] Client disconnected: ${socket.id} (${reason})`)
    })
  })
}
