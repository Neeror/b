import { Schema, model } from "mongoose";
const SessionEntrySchema = new Schema({
    state: {
        postureScore: { type: Number, required: true },
        eyeFatigue: { type: Number, required: true },
        activityLevel: { type: Number, required: true },
        heartRate: { type: Number, required: true },
        overallScore: { type: Number, required: true },
        stressLevel: { type: Number, required: true },
        lightLevel: { type: Number, required: true },
        lastVitaminTime: { type: Number, required: true },
    },
    recommendations: { type: [String], default: [] },
    timestamp: { type: Number, required: true },
}, { _id: false });
const SessionSchema = new Schema({
    deviceId: { type: String, required: true, index: true },
    startedAt: { type: Number, required: true },
    endedAt: { type: Number },
    duration: { type: Number },
    entries: { type: [SessionEntrySchema], default: [] },
    averageScore: { type: Number, default: 0 },
}, { timestamps: false, versionKey: false });
SessionSchema.pre("save", async function () {
    if (this.endedAt != null) {
        this.duration = this.endedAt - this.startedAt;
    }
    if (this.entries.length > 0) {
        const total = this.entries.reduce((sum, e) => sum + e.state.overallScore, 0);
        this.averageScore = Math.round(total / this.entries.length);
    }
});
export const Session = model("Session", SessionSchema);
//# sourceMappingURL=session.model.js.map