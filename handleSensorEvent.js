import { SensorType } from "../types/sensorTypes.js";
export const SENSOR_LIMITS = {
    [SensorType.POSTURE]: { min: 0, max: 100, default: 100 },
    [SensorType.EYE_STRAIN]: { min: 0, max: 100, default: 0 },
    [SensorType.ACTIVITY]: { min: 0, max: 100, default: 50 },
    [SensorType.STRESS]: { min: 0, max: 100, default: 20 },
    [SensorType.LIGHT]: { min: 0, max: 1000, default: 400 },
    [SensorType.HEART_RATE]: { min: 30, max: 220, default: 70 },
};
const sensorStore = {
    [SensorType.POSTURE]: SENSOR_LIMITS[SensorType.POSTURE].default,
    [SensorType.EYE_STRAIN]: SENSOR_LIMITS[SensorType.EYE_STRAIN].default,
    [SensorType.ACTIVITY]: SENSOR_LIMITS[SensorType.ACTIVITY].default,
    [SensorType.STRESS]: SENSOR_LIMITS[SensorType.STRESS].default,
    [SensorType.LIGHT]: SENSOR_LIMITS[SensorType.LIGHT].default,
    [SensorType.HEART_RATE]: SENSOR_LIMITS[SensorType.HEART_RATE].default,
};
export function validateSensorValue(value, sensor) {
    if (typeof value !== "number" || isNaN(value) || !isFinite(value))
        return false;
    if (!(sensor in SENSOR_LIMITS))
        return false;
    const { min, max } = SENSOR_LIMITS[sensor];
    return value >= min && value <= max;
}
export function setSensorValue(type, value, store) {
    if (!validateSensorValue(value, type))
        return false;
    const target = store ?? sensorStore;
    target[type] = value;
    return true;
}
export function getSensorValue(type) {
    return sensorStore[type];
}
export function getAllSensors() {
    return { ...sensorStore };
}
export function resetSensors() {
    for (const type of Object.values(SensorType)) {
        sensorStore[type] = SENSOR_LIMITS[type].default;
    }
}
export function handleSensorEvent(event, logger) {
    try {
        if (!validateSensorValue(event.value, event.type)) {
            logger.warn({ ...event, error: "Value out of range" });
            return;
        }
        setSensorValue(event.type, event.value);
        logger.info({ ...event });
    }
    catch (err) {
        try {
            logger.error({ ...event, error: err });
        }
        catch {
        }
    }
}
//# sourceMappingURL=handleSensorEvent.js.map