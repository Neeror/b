import { useCallback, useState } from "react"
import { getSocket } from "../services/socket"
import type { StateResult } from "../services/types"

const TIMEOUT_MS = 5000

export interface CheckStateHook {
  loading: boolean
  check:   () => void
}

export function useCheckState(): CheckStateHook {
  const [loading, setLoading] = useState(false)

  const check = useCallback(() => {
    if (loading) return
    setLoading(true)

    const timer = setTimeout(() => setLoading(false), TIMEOUT_MS)

    getSocket().emit("check:state", (_result: StateResult) => {
      clearTimeout(timer)
      setLoading(false)
    })
  }, [loading])

  return { loading, check }
}