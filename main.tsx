import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { MetricCard } from "./components/MetricCard"
import { useLiveState } from "./hooks/useLiveState"
import { useCheckState } from "./hooks/useCheckState"
import type {
  Recommendation,
  SensorReading,
  StateResult,
  UserStateSnapshot,
} from "./services/types"

const HEALTHY_HR = { min: 50, max: 120 } as const

function safeNumber(value: unknown, min = 0, max = 100): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : min
  return Math.min(Math.max(n, min), max)
}

function heartRateScore(bpm: number): number {
  const hr = safeNumber(bpm, 0, 250)
  if (hr >= HEALTHY_HR.min && hr <= HEALTHY_HR.max) return 100
  const distance = hr < HEALTHY_HR.min ? HEALTHY_HR.min - hr : hr - HEALTHY_HR.max
  return safeNumber(100 - distance * 2)
}

const RECOMMENDATION_TEXT: Readonly<Record<Recommendation, string>> = {
  AllGood:       "All good — your state is balanced. Keep it up.",
  FixPosture:    "Fix your posture — sit straight and align your shoulders.",
  MoveBody:      "Move your body — stand up and stretch for a minute.",
  RestEyes:      "Rest your eyes — look 20 ft away for 20 seconds.",
  ReduceStress:  "Reduce stress — slow your breathing and take a short pause.",
  IncreaseLight: "Increase lighting — your workspace is too dim.",
  TakeVitamins:  "Time to take your vitamins.",
}

const RECOMMENDATION_TONE: Readonly<Record<Recommendation, string>> = {
  AllGood:       "#00ff88",
  FixPosture:    "#ffcc00",
  MoveBody:      "#ffcc00",
  RestEyes:      "#ffcc00",
  ReduceStress:  "#ff4444",
  IncreaseLight: "#ffcc00",
  TakeVitamins:  "#00aaff",
}

function recommendationText(rec: Recommendation): string {
  return RECOMMENDATION_TEXT[rec] ?? "Unknown recommendation."
}

function recommendationTone(rec: Recommendation): string {
  return RECOMMENDATION_TONE[rec] ?? "#888888"
}

function ConnectionDot({ connected }: { connected: boolean }) {
  const color = connected ? "#00ff88" : "#ff4444"
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#888" }}>
      <span
        aria-hidden
        style={{
          width:        "9px",
          height:       "9px",
          borderRadius: "50%",
          background:   color,
          boxShadow:    `0 0 8px ${color}`,
        }}
      />
      {connected ? "Connected" : "Offline"}
    </span>
  )
}

function MetricsGrid({ state }: { state: UserStateSnapshot }) {
  const posture  = safeNumber(state.postureScore)
  const eye      = safeNumber(state.eyeFatigue)
  const activity = safeNumber(state.activityLevel)
  const stress   = safeNumber(state.stressLevel)
  const light    = safeNumber(state.lightLevel)
  const heart    = safeNumber(state.heartRate, 0, 250)

  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap:                 "16px",
      }}
    >
      <MetricCard label="Posture"      value={posture}  unit="%"   score={posture} />
      <MetricCard label="Eye Fatigue"  value={eye}      unit="%"   score={eye}      inverted />
      <MetricCard label="Activity"     value={activity} unit="%"   score={activity} />
      <MetricCard label="Stress"       value={stress}   unit="%"   score={stress}   inverted />
      <MetricCard label="Light"        value={light}    unit="%"   score={light} />
      <MetricCard label="Heart Rate"   value={heart}    unit=" bpm" score={heartRateScore(heart)} />
    </div>
  )
}

function OverallScore({ score }: { score: number }) {
  const value = safeNumber(score)
  const color = value >= 70 ? "#00ff88" : value >= 40 ? "#ffcc00" : "#ff4444"
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
      <span style={{ fontSize: "13px", color: "#666", textTransform: "uppercase", letterSpacing: "1.2px" }}>
        Overall State Index
      </span>
      <span style={{ fontSize: "44px", fontWeight: 800, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {value}
      </span>
    </div>
  )
}

function Recommendations({ recommendations }: { recommendations: readonly Recommendation[] }) {
  if (recommendations.length === 0) return null

  return (
    <section
      style={{
        background:   "rgba(255,255,255,0.04)",
        border:       "1px solid rgba(255,255,255,0.08)",
        borderRadius: "14px",
        padding:      "20px",
      }}
    >
      <h2 style={{ fontSize: "13px", color: "#666", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "14px" }}>
        AI Recommendations
      </h2>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", margin: 0, padding: 0 }}>
        {recommendations.map((rec, i) => (
          <li
            key={`${rec}-${i}`}
            style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "15px", color: "#ddd" }}
          >
            <span aria-hidden style={{ width: "6px", height: "6px", borderRadius: "50%", background: recommendationTone(rec) }} />
            {recommendationText(rec)}
          </li>
        ))}
      </ul>
    </section>
  )
}

function LastReading({ reading }: { reading: SensorReading }) {
  const type  = typeof reading.type === "string" ? reading.type.slice(0, 40) : "unknown"
  const value = safeNumber(reading.value, -1e6, 1e6)
  return (
    <p style={{ fontSize: "12px", color: "#555", fontVariantNumeric: "tabular-nums" }}>
      Last sensor: <span style={{ color: "#888" }}>{type}</span> = {value}
    </p>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", color: "#555", padding: "48px 0", fontSize: "15px" }}>
      No state yet. Press <strong style={{ color: "#888" }}>Check My State</strong> to run an analysis.
    </div>
  )
}

function App() {
  const { connected, state, lastReading, error } = useLiveState()
  const { loading, check } = useCheckState()

  const result: StateResult | null = state

  return (
    <div
      style={{
        minHeight:  "100vh",
        background: "#0a0a0a",
        color:      "#fff",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        padding:    "32px 20px",
      }}
    >
      <div style={{ maxWidth: "920px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px", margin: 0 }}>
              NeuroDesk <span style={{ color: "#00ff88" }}>Ultra AI</span>
            </h1>
            <p style={{ color: "#666", fontSize: "14px", marginTop: "4px" }}>
              Real-time health &amp; productivity monitor
            </p>
          </div>
          <ConnectionDot connected={connected} />
        </header>

        <button
          type="button"
          onClick={check}
          disabled={loading || !connected}
          style={{
            alignSelf:    "flex-start",
            background:   loading || !connected ? "#1a1a1a" : "#00ff88",
            color:        loading || !connected ? "#666" : "#0a0a0a",
            border:       "none",
            borderRadius: "12px",
            padding:      "14px 28px",
            fontSize:     "15px",
            fontWeight:   700,
            cursor:       loading || !connected ? "not-allowed" : "pointer",
            transition:   "background 0.2s ease, color 0.2s ease",
          }}
        >
          {loading ? "Analyzing…" : "Check My State"}
        </button>

        {error && (
          <div
            role="alert"
            style={{
              background:   "rgba(255,68,68,0.08)",
              border:       "1px solid rgba(255,68,68,0.3)",
              borderRadius: "12px",
              padding:      "14px 18px",
              color:        "#ff7777",
              fontSize:     "14px",
            }}
          >
            {typeof error.message === "string" ? error.message : "An unexpected error occurred."}
          </div>
        )}

        {result ? (
          <>
            <OverallScore score={result.state.overallScore} />
            <MetricsGrid state={result.state} />
            <Recommendations recommendations={result.recommendations} />
          </>
        ) : (
          <EmptyState />
        )}

        {lastReading && <LastReading reading={lastReading} />}
      </div>
    </div>
  )
}

const container = document.getElementById("root")

if (!container) {
  throw new Error("NeuroDesk: mount element #root was not found in the document.")
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
