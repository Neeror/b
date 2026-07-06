import { Schema, model } from "mongoose"
import type { HydratedDocument } from "mongoose"
import type { UserState, Recommendation } from "../../sensor/types/sensorTypes.js"

export interface SessionEntry {
  readonly state:           UserState
  readonly recommendations: ReadonlyArray<Recommendation>
  readonly timestamp:       number
}

export interface ISession {
  deviceId:     string
  startedAt:    number
  endedAt?:     number
  duration?:    number
  entries:      SessionEntry[]
  averageScore: number
}

export type SessionDoc = HydratedDocument<ISession>

const SessionEntrySchema = new Schema<SessionEntry>(
  {
    state: {
      postureScore:    { type: Number, required: true },
      eyeFatigue:      { type: Number, required: true },
      activityLevel:   { type: Number, required: true },
      heartRate:       { type: Number, required: true },
      overallScore:    { type: Number, required: true },
      stressLevel:     { type: Number, required: true },
      lightLevel:      { type: Number, required: true },
      lastVitaminTime: { type: Number, required: true },
    },
    recommendations: { type: [String], default: [] },
    timestamp:       { type: Number, required: true },
  },
  { _id: false }
)

const SessionSchema = new Schema<ISession>(
  {
    deviceId:     { type: String, required: true, index: true },
    startedAt:    { type: Number, required: true },
    endedAt:      { type: Number },
    duration:     { type: Number },
    entries:      { type: [SessionEntrySchema], default: [] },
    averageScore: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false }
)

SessionSchema.pre("save", async function (this: SessionDoc) {
  if (this.endedAt != null) {
    this.duration = this.endedAt - this.startedAt
  }

  if (this.entries.length > 0) {
    const total = this.entries.reduce((sum, e) => sum + e.state.overallScore, 0)
    this.averageScore = Math.round(total / this.entries.length)
  }
})

export const Session = model<ISession>("Session", SessionSchema)