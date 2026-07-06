import { SensorType, defaultLogger } from "../types/sensorTypes.js";
import { getSensorValue, setSensorValue, SENSOR_LIMITS } from "../handlers/handleSensorEvent.js";
let lastVitaminTime = 0;
export function takeVitamins() {
    lastVitaminTime = Date.now();
}
export function getLastVitaminTime() {
    return lastVitaminTime;
}
export function resetVitaminTime(time = Date.now()) {
    if (!isFinite(time) || time < 0) {
        throw new Error(`resetVitaminTime: invalid timestamp ${time}`);
    }
    lastVitaminTime = time;
}
function clamp(value) {
    if (!isFinite(value))
        return 0;
    return Math.min(Math.max(value, 0), 100);
}
export function calculatePostureScore(value) {
    return clamp(value);
}
export function calculateEyeFatigue(value) {
    return clamp(value);
}
export function calculateActivityLevel(value) {
    return clamp(value);
}
export function calculateStressLevel(value) {
    return clamp(value);
}
export function calculateLightLevel(value) {
    const max = SENSOR_LIMITS[SensorType.LIGHT].max;
    if (max === 0)
        return 0;
    return clamp((value / max) * 100);
}
export function calculateHeartRate(value) {
    if (!isFinite(value))
        return SENSOR_LIMITS[SensorType.HEART_RATE].default;
    const { min, max } = SENSOR_LIMITS[SensorType.HEART_RATE];
    return Math.min(Math.max(value, min), max);
}
export function calculateOverallScore(state) {
    return Math.round((state.postureScore +
        (100 - state.eyeFatigue) +
        state.activityLevel +
        (100 - state.stressLevel) +
        state.lightLevel) / 5);
}
export function buildUserState() {
    const postureScore = calculatePostureScore(getSensorValue(SensorType.POSTURE));
    const eyeFatigue = calculateEyeFatigue(getSensorValue(SensorType.EYE_STRAIN));
    const activityLevel = calculateActivityLevel(getSensorValue(SensorType.ACTIVITY));
    const stressLevel = calculateStressLevel(getSensorValue(SensorType.STRESS));
    const lightLevel = calculateLightLevel(getSensorValue(SensorType.LIGHT));
    const heartRate = calculateHeartRate(getSensorValue(SensorType.HEART_RATE));
    const overallScore = calculateOverallScore({
        postureScore,
        eyeFatigue,
        activityLevel,
        stressLevel,
        lightLevel,
        heartRate,
    });
    return { postureScore, eyeFatigue, activityLevel, stressLevel, lightLevel, heartRate, overallScore, lastVitaminTime };
}
function getTypedLogger(logger) {
    return logger ?? defaultLogger;
}
export function processSensorInput(type, value, logger, store) {
    const actualLogger = getTypedLogger(logger);
    const finalValue = value ?? SENSOR_LIMITS[type].default;
    if (!setSensorValue(type, finalValue, store)) {
        actualLogger.warn({ type, value: finalValue, timestamp: Date.now(), error: "Value out of range" });
        return;
    }
    actualLogger.info({ type, value: finalValue, timestamp: Date.now() });
}
export const THRESHOLDS = {
    posture: 70,
    eyeFatigue: 60,
    activity: 40,
    stress: 75,
    light: 40,
    heartRateLow: 50,
    heartRateHigh: 120,
};
export function detectProblems(state) {
    return {
        badPosture: state.postureScore < THRESHOLDS.posture,
        highEyeFatigue: state.eyeFatigue > THRESHOLDS.eyeFatigue,
        lowActivity: state.activityLevel < THRESHOLDS.activity,
        highStress: state.stressLevel > THRESHOLDS.stress,
        badLight: state.lightLevel < THRESHOLDS.light,
    };
}
const VITAMIN_INTERVAL_HOURS = 6;
export const RECOMMENDATION_RULES = [
    { check: s => detectProblems(s).badPosture, rec: "FixPosture" },
    { check: s => detectProblems(s).highEyeFatigue, rec: "RestEyes" },
    { check: s => detectProblems(s).lowActivity, rec: "MoveBody" },
    { check: s => detectProblems(s).highStress, rec: "ReduceStress" },
    { check: s => detectProblems(s).badLight, rec: "IncreaseLight" },
    { check: s => s.heartRate < THRESHOLDS.heartRateLow || s.heartRate > THRESHOLDS.heartRateHigh, rec: "MoveBody" },
    { check: () => (Date.now() - lastVitaminTime) / (1000 * 60 * 60) >= VITAMIN_INTERVAL_HOURS, rec: "TakeVitamins" },
];
export function generateRecommendations(state) {
    try {
        const recs = [...new Set(RECOMMENDATION_RULES
                .filter(rule => rule.check(state))
                .map(rule => rule.rec))];
        return recs.length > 0 ? recs : ["AllGood"];
    }
    catch {
        return ["AllGood"];
    }
}
export function checkMyState(logger) {
    const state = buildUserState();
    const recommendations = generateRecommendations(state);
    const result = { state, recommendations, timestamp: Date.now() };
    logger.info(result);
    return result;
}
//# sourceMappingURL=processValue.js.map