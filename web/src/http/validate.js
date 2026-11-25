import Joi from "joi";
import { AppError } from "./errors.js";

const OPTIONS = { abortEarly: false, stripUnknown: true, convert: true };

// Iterative, so deeply nested input cannot overflow the stack.
function operatorKeys(source, input) {
  const found = [];
  const stack = [[input, ""]];
  while (stack.length) {
    const [value, prefix] = stack.pop();
    if (value === null || typeof value !== "object") continue;
    for (const [key, child] of Object.entries(value)) {
      const field = prefix ? `${prefix}.${key}` : key;
      if (key.startsWith("$") || key.includes(".")) {
        found.push({ field, message: `Key not allowed in ${source}` });
      } else {
        stack.push([child, field]);
      }
    }
  }
  return found;
}

// validate({ body, query, params, headers }) with Joi schemas; sanitized values land in req.validated.
export function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    const invalid = [];

    for (const [source, schema] of Object.entries(schemas)) {
      const input = req[source] ?? {};
      const rejected = operatorKeys(source, input);
      if (rejected.length) {
        return next(new AppError("VALIDATION_ERROR", "Validation failed", rejected));
      }
      const { value, error } = schema.validate(input, OPTIONS);
      if (error) invalid.push(...error.details);
      validated[source] = value;
    }

    if (invalid.length) {
      return next(new Joi.ValidationError("Validation failed", invalid));
    }
    // Checked after stripping: a body of only unknown fields is empty too.
    if (req.method === "PATCH" && schemas.body && !Object.keys(validated.body).length) {
      return next(
        new AppError("VALIDATION_ERROR", "Validation failed", [
          { field: "body", message: "At least one field is required" },
        ])
      );
    }
    req.validated = { ...req.validated, ...validated };
    next();
  };
}
