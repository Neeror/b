import type { StateResult, SensorReading } from "./types"

interface ApiOk<T>  { readonly ok: true;  readonly data: T }
interface ApiErr    { readonly ok: false; readonly code: string; readonly message: string }
type ApiRes<T>      = ApiOk<T> | ApiErr

const BASE = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000"

async function request<T>(path: string, init?: RequestInit): Promise<ApiRes<T>> {
  try {
    const res  = await fetch(`${BASE}/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    })
    return (await res.json()) as ApiRes<T>
  } catch (err) {
    return { ok: false, code: "NETWORK_ERROR", message: String(err) }
  }
}

export const api = {
  getState:   () =>
    request<StateResult>("/state"),

  getSensors: () =>
    request<Record<string, number>>("/sensors"),

  sendSensor: (type: string, value: number) =>
    request<SensorReading>("/sensor", {
      method: "POST",
      body:   JSON.stringify({ type, value, timestamp: Date.now() }),
    }),
}