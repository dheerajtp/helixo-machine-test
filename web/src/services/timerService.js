import { AppError } from "../http/errors.js";
import * as repo from "../repositories/timerRepository.js";
import { timerFields, timerSchema } from "../validators/timerDocument.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const notFound = () => new AppError("NOT_FOUND", "Timer not found");
const invalid = (field, message) =>
  new AppError("VALIDATION_ERROR", "Validation failed", [{ field, message }]);

export function computeStatus(timer, now = new Date()) {
  if (timer.enabled === false) return "disabled";
  if (timer.type === "evergreen") return "active";
  if (now < timer.startAt) return "scheduled";
  return now >= timer.endAt ? "expired" : "active";
}

// The only shape that leaves the service: no shop, _id or sortAt.
function toTimer(doc, now = new Date()) {
  return {
    id: String(doc._id),
    name: doc.name,
    type: doc.type,
    enabled: doc.enabled,
    startAt: doc.startAt ?? null,
    endAt: doc.endAt ?? null,
    durationSeconds: doc.durationSeconds ?? null,
    targetType: doc.targetType,
    targetIds: doc.targetIds,
    description: doc.description,
    appearance: doc.appearance,
    urgencyEffect: doc.urgencyEffect,
    urgencyThresholdSeconds: doc.urgencyThresholdSeconds,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    status: computeStatus(doc, now),
  };
}

function validate(input) {
  const { value, error } = timerSchema.validate(input);
  if (error) throw error;
  return value;
}

const sortKey = (timer, createdAt) => (timer.type === "fixed" ? timer.startAt : createdAt);

const encodeCursor = ({ sortAt, _id }) =>
  Buffer.from(`${sortAt.toISOString()}|${_id}`).toString("base64url");

function decodeCursor(cursor) {
  const match =
    typeof cursor === "string" &&
    /^([^|]+)\|([0-9a-f]{24})$/.exec(Buffer.from(cursor, "base64url").toString());
  const sortAt = new Date(match ? match[1] : NaN);
  if (Number.isNaN(sortAt.getTime())) throw invalid("cursor", "Invalid cursor");
  return { sortAt, id: match[2] };
}

export async function createTimer(shop, input) {
  const value = validate(input);
  const createdAt = new Date();
  const sortAt = sortKey(value, createdAt);
  return toTimer(await repo.createTimer(shop, { ...value, createdAt, sortAt }));
}

export async function getTimer(shop, id) {
  const doc = await repo.findTimer(shop, id);
  if (!doc) throw notFound();
  return toTimer(doc);
}

export async function updateTimer(shop, id, patch) {
  const stored = await repo.findTimer(shop, id);
  if (!stored) throw notFound();
  if (patch.type !== undefined && patch.type !== stored.type) {
    throw invalid("type", "type cannot be changed");
  }

  const current = {};
  for (const field of Object.keys(timerFields)) {
    if (stored[field] !== undefined) current[field] = stored[field];
  }
  const merged = { ...current, ...patch };
  // Anything but a plain object is left as sent, for the schema to reject.
  if (patch.appearance?.constructor === Object) {
    merged.appearance = { ...stored.appearance, ...patch.appearance };
  }
  const value = validate(merged);

  // The whole document is written, so concurrent PATCHes cannot leave an invalid mix.
  const sortAt = sortKey(value, stored.createdAt);
  const updated = await repo.replaceTimer(shop, id, { ...value, sortAt });
  if (!updated) throw notFound();
  return toTimer(updated);
}

export async function deleteTimer(shop, id) {
  if (!(await repo.deleteTimer(shop, id))) throw notFound();
}

export async function listTimers(shop, { limit, cursor, q, sort } = {}) {
  const size = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;
  const after = cursor === undefined ? undefined : decodeCursor(cursor);
  // One extra row shows whether there is a next page.
  const rows = await repo.listTimers(shop, { limit: size + 1, q, sort, after });
  const page = rows.slice(0, size);
  const now = new Date();
  return {
    timers: page.map((doc) => toTimer(doc, now)),
    limit: size,
    nextCursor: rows.length > size ? encodeCursor(page.at(-1)) : null,
  };
}
