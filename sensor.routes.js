import { Router } from "express";
import { SensorType, Logger } from "../../../sensor/types/sensorTypes.js";
import { handleSensorEvent, getAllSensors, validateSensorValue, SENSOR_LIMITS } from "../../../sensor/handlers/handleSensorEvent.js";
import { checkMyState } from "../../../sensor/processors/processValue.js";
import { HTTP_STATUS, ok, fail } from "../../../shared/types.js";
import { validate } from "../../middleware/validate.middleware.js";
const sensorLogger = new Logger(500);
const stateLogger = new Logger(200);
const MAX_FUTURE_DRIFT_MS = 60_000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const validateSensorBody = (body) => {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return { ok: false, message: "Body must be a JSON object" };
    }
    const { type, value, timestamp } = body;
    if (!Object.values(SensorType).includes(type)) {
        return { ok: false, message: `type must be one of: ${Object.values(SensorType).join(", ")}` };
    }
    if (typeof value !== "number" || !isFinite(value)) {
        return { ok: false, message: "value must be a finite number" };
    }
    if (!validateSensorValue(value, type)) {
        const { min, max } = SENSOR_LIMITS[type];
        return { ok: false, message: `value must be between ${min} and ${max} for ${String(type)}` };
    }
    if (typeof timestamp !== "number" || !isFinite(timestamp) || timestamp < 0) {
        return { ok: false, message: "timestamp must be a non-negative finite number" };
    }
    const now = Date.now();
    if (timestamp > now + MAX_FUTURE_DRIFT_MS) {
        return { ok: false, message: "timestamp must not be in the future" };
    }
    if (timestamp < now - MAX_AGE_MS) {
        return { ok: false, message: "timestamp is too old (max 24h)" };
    }
    return { ok: true, data: { type: type, value, timestamp } };
};
export function createSensorRouter(io) {
    const router = Router();
    router.post("/sensor", validate(validateSensorBody), (req, res) => {
        const body = req.body;
        const event = { type: body.type, value: body.value, timestamp: body.timestamp };
        handleSensorEvent(event, sensorLogger);
        const reading = { type: body.type, value: body.value, timestamp: body.timestamp };
        io.emit("sensor:update", reading);
        res.status(HTTP_STATUS.CREATED).json(ok(reading));
    });
    router.get("/sensors", (_req, res) => {
        res.status(HTTP_STATUS.OK).json(ok(getAllSensors()));
    });
    router.get("/state", (_req, res) => {
        try {
            const result = checkMyState(stateLogger);
            res.status(HTTP_STATUS.OK).json(ok(result));
        }
        catch (err) {
            console.error(`[API] ${new Date().toISOString()} GET /state failed:`, err);
            res.status(HTTP_STATUS.INTERNAL_ERROR).json(fail("INTERNAL_ERROR", "Failed to check state"));
        }
    });
    return router;
}
//# sourceMappingURL=sensor.routes.js.map