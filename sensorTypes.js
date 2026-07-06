export var SensorType;
(function (SensorType) {
    SensorType["POSTURE"] = "POSTURE";
    SensorType["EYE_STRAIN"] = "EYE_STRAIN";
    SensorType["ACTIVITY"] = "ACTIVITY";
    SensorType["STRESS"] = "STRESS";
    SensorType["LIGHT"] = "LIGHT";
    SensorType["HEART_RATE"] = "HEART_RATE";
})(SensorType || (SensorType = {}));
export class Logger {
    logs = [];
    maxLogs;
    silent;
    constructor(maxLogs = 1000, silent = false) {
        if (!Number.isInteger(maxLogs) || maxLogs < 1) {
            throw new Error(`Logger: maxLogs must be a positive integer, got ${maxLogs}`);
        }
        this.maxLogs = maxLogs;
        this.silent = silent;
    }
    cloneEntry(entry) {
        try {
            return structuredClone(entry);
        }
        catch {
            return { ...entry };
        }
    }
    addLog(level, entry) {
        while (this.logs.length >= this.maxLogs) {
            this.logs.shift();
        }
        this.logs.push({ level, entry: this.cloneEntry(entry), timestamp: Date.now() });
    }
    info(entry) {
        if (!this.silent)
            console.info(`[INFO  ${new Date().toISOString()}]`, entry);
        this.addLog("info", entry);
    }
    warn(entry) {
        if (!this.silent)
            console.warn(`[WARN  ${new Date().toISOString()}]`, entry);
        this.addLog("warn", entry);
    }
    error(entry) {
        if (!this.silent)
            console.error(`[ERROR ${new Date().toISOString()}]`, entry);
        this.addLog("error", entry);
    }
    getAll() {
        return [...this.logs];
    }
    getByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }
    clear() {
        this.logs.length = 0;
    }
    printAll() {
        this.logs.forEach(({ level, entry, timestamp }) => console.log(`[${level.toUpperCase().padEnd(5)} ${new Date(timestamp).toISOString()}]`, entry));
    }
}
export const defaultLogger = new Logger(500);
//# sourceMappingURL=sensorTypes.js.map