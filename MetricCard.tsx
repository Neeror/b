const C = { good: "#00ff88", warn: "#ffcc00", danger: "#ff4444" } as const

function scoreColor(score: number, inverted: boolean): string {
  const v = inverted ? 100 - score : score
  if (v >= 70) return C.good
  if (v >= 40) return C.warn
  return C.danger
}

export interface MetricCardProps {
  label:     string
  value:     number
  unit?:     string
  score:     number
  inverted?: boolean
}

export function MetricCard({ label, value, unit = "", score, inverted = false }: MetricCardProps) {
  const color = scoreColor(score, inverted)

  return (
    <div style={{
      background:    "rgba(255,255,255,0.04)",
      border:        `1px solid ${color}28`,
      borderRadius:  "14px",
      padding:       "18px 20px",
      display:       "flex",
      flexDirection: "column",
      gap:           "10px",
    }}>
      <span style={{
        fontSize:      "11px",
        color:         "#666",
        textTransform: "uppercase",
        letterSpacing: "1.2px",
        fontWeight:    500,
      }}>
        {label}
      </span>

      <span style={{
        fontSize:           "30px",
        fontWeight:         700,
        color,
        fontVariantNumeric: "tabular-nums",
        lineHeight:         1,
      }}>
        {value}{unit}
      </span>

      <div style={{ height: "3px", background: "#1a1a1a", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{
          height:       "100%",
          width:        `${Math.min(100, Math.max(0, score))}%`,
          background:   color,
          borderRadius: "2px",
          transition:   "width 0.6s ease, background 0.6s ease",
        }} />
      </div>
    </div>
  )
}