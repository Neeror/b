export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    UNPROCESSABLE: 422,
    INTERNAL_ERROR: 500,
};
export function ok(data) {
    return { ok: true, data };
}
export function fail(code, message) {
    return { ok: false, code, message };
}
//# sourceMappingURL=types.js.map