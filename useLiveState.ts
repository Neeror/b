import { useEffect, useState } from "react"
import { getSocket } from "../services/socket"
import type { StateResult, SensorReading, SocketError } from "../services/types"

export interface LiveState {
  connected:   boolean
  state:       StateResult | null
  lastReading: SensorReading | null
  error:       SocketError | null
}

export function useLiveState(): LiveState {
  const [connected,   setConnected]   = useState(false)
  const [state,       setState]       = useState<StateResult | null>(null)
  const [lastReading, setLastReading] = useState<SensorReading | null>(null)
  const [error,       setError]       = useState<SocketError | null>(null)

  useEffect(() => {
    const socket = getSocket()

    const onConnect    = ()                  => { setConnected(true);  setError(null) }
    const onDisconnect = ()                  => setConnected(false)
    const onState      = (r: StateResult)   => setState(r)
    const onReading    = (r: SensorReading) => setLastReading(r)
    const onError      = (e: SocketError)   => setError(e)

    socket.on("connect",       onConnect)
    socket.on("disconnect",    onDisconnect)
    socket.on("state:update",  onState)
    socket.on("sensor:update", onReading)
    socket.on("error",         onError)

    return () => {
      socket.off("connect",       onConnect)
      socket.off("disconnect",    onDisconnect)
      socket.off("state:update",  onState)
      socket.off("sensor:update", onReading)
      socket.off("error",         onError)
    }
  }, [])

  return { connected, state, lastReading, error }
}