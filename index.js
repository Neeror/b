import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB, disconnectDB } from "../db/connection.js";
import { createSensorRouter } from "./api/routes/sensor.routes.js";
import { registerSocketHandlers } from "./socket/socket.handler.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
function validateEnv() {
    const errors = [];
    const rawPort = process.env.PORT ?? "3000";
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        errors.push(`PORT must be an integer between 1 and 65535 (got "${rawPort}")`);
    }
    if (!process.env.MONGODB_URI) {
        errors.push("MONGODB_URI is required");
    }
    const rawOrigins = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
    const origins = rawOrigins.split(",").map(o => o.trim()).filter(Boolean);
    for (const origin of origins) {
        try {
            new URL(origin);
        }
        catch {
            errors.push(`CLIENT_ORIGIN contains an invalid URL: "${origin}"`);
        }
    }
    if (origins.length === 0) {
        errors.push("CLIENT_ORIGIN must contain at least one origin");
    }
    if (errors.length > 0) {
        console.error("[Config] Invalid environment:\n  - " + errors.join("\n  - "));
        process.exit(1);
    }
    return { port, origins, isProd: process.env.NODE_ENV === "production" };
}
const config = validateEnv();
const app = express();
const server = createServer(app);
app.disable("x-powered-by");
app.use(helmet({
    contentSecurityPolicy: config.isProd ? undefined : false,
}));
const corsOptions = {
    origin(origin, callback) {
        if (!origin || config.origins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    maxAge: 86_400,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "16kb" }));
const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests, slow down" } },
});
app.use("/api", apiLimiter);
const io = new Server(server, {
    cors: { origin: [...config.origins], methods: ["GET", "POST"] },
    maxHttpBufferSize: 10_000,
    pingTimeout: 20_000,
    pingInterval: 25_000,
    perMessageDeflate: false,
});
app.use("/api", createSensorRouter(io));
app.get("/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
});
app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
});
app.use(errorMiddleware);
registerSocketHandlers(io);
server.requestTimeout = 30_000;
server.headersTimeout = 31_000;
server.keepAliveTimeout = 65_000;
let shuttingDown = false;
async function shutdown(signal) {
    if (shuttingDown)
        return;
    shuttingDown = true;
    console.info(`[Server] ${signal} received — shutting down gracefully`);
    const forceExit = setTimeout(() => {
        console.error("[Server] Forced exit after 10s timeout");
        process.exit(1);
    }, 10_000);
    forceExit.unref();
    try {
        io.close();
        await new Promise((resolve) => server.close(() => resolve()));
        await disconnectDB();
        console.info("[Server] Shutdown complete");
        process.exit(0);
    }
    catch (err) {
        console.error("[Server] Error during shutdown:", err);
        process.exit(1);
    }
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
    console.error("[Server] Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
    console.error("[Server] Uncaught exception:", err);
    void shutdown("uncaughtException");
});
async function bootstrap() {
    try {
        await connectDB();
        server.listen(config.port, () => {
            console.info(`[Server] Running on http://localhost:${config.port} (${config.isProd ? "production" : "development"})`);
        });
    }
    catch (err) {
        console.error("[Server] Failed to start:", err);
        process.exit(1);
    }
}
void bootstrap();
//# sourceMappingURL=index.js.map