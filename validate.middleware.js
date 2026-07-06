import { HTTP_STATUS, fail } from "../../shared/types.js";
export function validate(validator) {
    return (req, res, next) => {
        const result = validator(req.body);
        if (!result.ok) {
            res.status(HTTP_STATUS.UNPROCESSABLE).json(fail("VALIDATION_ERROR", result.message));
            return;
        }
        req.body = result.data;
        next();
    };
}
//# sourceMappingURL=validate.middleware.js.map