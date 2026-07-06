import { HTTP_STATUS, fail } from "../../shared/types.js";
export class AppError extends Error {
    code;
    status;
    constructor(code, message, status = HTTP_STATUS.INTERNAL_ERROR) {
        super(message);
        this.name = "AppError";
        this.code = code;
        this.status = status;
    }
}
export function errorMiddleware(err, req, res, _next) {
    if (err instanceof AppError) {
        res.status(err.status).json(fail(err.code, err.message));
        return;
    }
    if (err instanceof SyntaxError && "body" in err) {
        res.status(HTTP_STATUS.BAD_REQUEST).json(fail("VALIDATION_ERROR", "Invalid JSON body"));
        return;
    }
    if (typeof err === "object" && err !== null && err.type === "entity.too.large") {
        res.status(HTTP_STATUS.BAD_REQUEST).json(fail("VALIDATION_ERROR", "Request body too large"));
        return;
    }
    if (err instanceof Error && err.message === "Not allowed by CORS") {
        res.status(HTTP_STATUS.BAD_REQUEST).json(fail("VALIDATION_ERROR", "Origin not allowed"));
        return;
    }
    console.error(`[ERROR] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`, err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json(fail("INTERNAL_ERROR", "Internal server error"));
}
//# sourceMappingURL=error.middleware.js.map