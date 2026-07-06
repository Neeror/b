import { SensorType, Logger } from "../../sensor/types/sensorTypes.js";
import { handleSensorEvent, validateSensorValue } from "../../sensor/handlers/handleSensorEvent.js";
import { checkMyState, takeVitamins } from "../../sensor/processors/processValue.js";
const socketLogger = new Logger(300);
const stateLogger = new Logger(100);
const RATE_CAPACITY = 20;
const RATE_REFILL_MS = 50;
function takeToken(bucket) {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
        bucket.tokens = Math.min(RATE_CAPACITY, bucket.tokens + elapsed / RATE_REFILL_MS);
        bucket.lastRefill = now;
    }
    if (bucket.tokens < 1)
        return false;
    bucket.tokens -= 1;
    return true;
}
const MAX_CONNECTIONS_PER_IP = 10;
const connectionsByIp = new Map();
function isValidReadingShape(reading) {
    if (typeof reading !== "object" || reading === null || Array.isArray(reading))
        return false;
    const r = reading;
    return (typeof r.type === "string" &&
        typeof r.value === "number" && isFinite(r.value) &&
        typeof r.timestamp === "number" && isFinite(r.timestamp) && r.timestamp >= 0);
}
function handleManualSensor(socket, io, reading) {
    const type = reading.type;
    if (!Object.values(SensorType).includes(type)) {
        socket.emit("error", { code: "SENSOR_UNKNOWN", message: "Unknown sensor type" });
        return;
    }
    if (!validateSensorValue(reading.value, type)) {
        socket.emit("error", { code: "VALUE_OUT_OF_RANGE", message: `Value out of range for ${type}` });
        return;
    }
    const event = { type, value: reading.value, timestamp: reading.timestamp };
    handleSensorEvent(event, socketLogger);
    io.emit("sensor:update", { type, value: reading.value, timestamp: reading.timestamp });
}
export function registerSocketHandlers(io) {
    io.use((socket, next) => {
        const ip = socket.handshake.address;
        const count = connectionsByIp.get(ip) ?? 0;
        if (count >= MAX_CONNECTIONS_PER_IP) {
            next(new Error("Too many connections from this address"));
            return;
        }
        connectionsByIp.set(ip, count + 1);
        next();
    });
    io.on("connection", (socket) => {
        console.info(`[Socket] Client connected: ${socket.id}`);
        const ip = socket.handshake.address;
        const bucket = { tokens: RATE_CAPACITY, lastRefill: Date.now() };
        function allow() {
            if (takeToken(bucket))
                return true;
            socket.emit("error", { code: "RATE_LIMITED", message: "Too many events, slow down" });
            return false;
        }
        socket.on("check:state", (callback) => {
            if (!allow())
                return;
            try {
                const result = checkMyState(stateLogger);
                if (typeof callback === "function")
                    callback(result);
                socket.emit("state:update", result);
            }
            catch (err) {
                console.error("[Socket] check:state error:", err);
                socket.emit("error", { code: "INTERNAL_ERROR", message: "Failed to check state" });
            }
        });
        socket.on("sensor:manual", (reading) => {
            if (!allow())
                return;
            if (!isValidReadingShape(reading)) {
                socket.emit("error", { code: "VALIDATION_ERROR", message: "Invalid sensor payload" });
                return;
            }
            handleManualSensor(socket, io, reading);
        });
        socket.on("vitamins:taken", () => {
            if (!allow())
                return;
            takeVitamins();
        });
        socket.on("focus:toggle", (enabled) => {
            if (!allow())
                return;
            if (typeof enabled !== "boolean") {
                socket.emit("error", { code: "VALIDATION_ERROR", message: "focus:toggle expects a boolean" });
                return;
            }
            console.info(`[Socket] Focus mode ${enabled ? "ON" : "OFF"} — ${socket.id}`);
        });
        socket.on("disconnect", (reason) => {
            const count = connectionsByIp.get(ip) ?? 1;
            if (count <= 1)
                connectionsByIp.delete(ip);
            else
                connectionsByIp.set(ip, count - 1);
            console.info(`[Socket] Client disconnected: ${socket.id} (${reason})`);
        });
    });
}
//# sourceMappingURL=socket.handler.js.map