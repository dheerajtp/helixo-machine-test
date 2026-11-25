import Joi from "joi";
import { timerFields, timerSchema } from "./timerDocument.js";

// A create body is a complete timer.
export const createBody = timerSchema;

// No defaults here: only what was sent is changed. type is rejected, never silently stripped.
export const patchBody = Joi.object({ ...timerFields, type: Joi.forbidden() }).required();

export const idParams = Joi.object({ id: Joi.string().hex().length(24).required() });

export const listQuery = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(20),
  cursor: Joi.string().max(200),
  // Same text rules as a name; control characters would break the MongoDB regex.
  q: timerFields.name.allow(""),
  sort: Joi.string().valid("oldest", "newest").default("oldest"),
})
  // The query parser keeps `q[$ne]` as a literal key, which would otherwise just be stripped.
  .pattern(/\[/, Joi.forbidden());
