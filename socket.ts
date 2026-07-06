import { io, type Socket } from "socket.io-client"
import type { StateResult, SensorReading, SocketError } from "./types"

interface ServerToClientEvents {
  "sensor:update": (reading: SensorReading) => void
  "state:update":  (result: StateResult) => void
  "error":         (error: SocketError) => void
}

interface ClientToServerEvents {
  "check:state":    (callback: (result: StateResult) => void) => void
  "sensor:manual":  (reading: SensorReading) => void
  "vitamins:taken": () => void
  "focus:toggle":   (enabled: boolean) => void
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000"

let socket: AppSocket | null = null

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect:        true,
      reconnection:       true,
      reconnectionDelay:  1000,
      reconnectionDelayMax: 5000,
    })
  }
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}