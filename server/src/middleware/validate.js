import { AppError } from '../utils/errors.js';

// Validates and replaces req.body / req.query / req.params with parsed values.
export const validate =
  (schemas) =>
  (req, _res, next) => {
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        const details = result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }));
        return next(
          new AppError(400, 'VALIDATION_ERROR', details[0]?.message || 'Invalid request.', details),
        );
      }
      // Express 5: req.query is a getter, so define a shadow property instead.
      Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true });
    }
    next();
  };
