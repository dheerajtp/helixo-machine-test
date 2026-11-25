import { TimerModel } from "../models/timer.js";

// type is set once at creation, so it is not here.
const EDITABLE = [
  "name",
  "enabled",
  "startAt",
  "endAt",
  "durationSeconds",
  "targetType",
  "targetIds",
  "description",
  "appearance",
  "urgencyEffect",
  "urgencyThresholdSeconds",
  "sortAt",
];
// createdAt may be passed in so an evergreen timer's sortAt can equal it.
const CREATABLE = [...EDITABLE, "type", "createdAt"];
const PROJECTION = Object.fromEntries(
  ["_id", "shop", ...CREATABLE, "updatedAt"].map((f) => [f, 1])
);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 51;

const isShop = (value) => typeof value === "string" && value.length > 0;
const isId = (value) => typeof value === "string" && /^[0-9a-f]{24}$/i.test(value);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function createTimer(shop, data) {
  if (!isShop(shop)) throw new TypeError("createTimer needs a string shop");
  const doc = Object.fromEntries(CREATABLE.map((f) => [f, data?.[f] ?? undefined]));
  // Drop absent keys so schema defaults apply.
  for (const f of CREATABLE) if (doc[f] === undefined) delete doc[f];
  return (await TimerModel.create({ ...doc, shop })).toObject();
}

export async function findTimer(shop, id) {
  if (!isShop(shop) || !isId(id)) return null;
  return TimerModel.findOne({ shop, _id: id }, PROJECTION).lean();
}

export async function replaceTimer(shop, id, data) {
  if (!isShop(shop) || !isId(id)) return null;
  const set = {};
  const unset = {};
  for (const f of EDITABLE) {
    if (data?.[f] === null) unset[f] = 1;
    else if (data?.[f] !== undefined) set[f] = data[f];
  }
  return TimerModel.findOneAndUpdate(
    { shop, _id: id },
    { $set: set, $unset: unset },
    { returnDocument: "after", runValidators: true, projection: PROJECTION }
  ).lean();
}

export async function deleteTimer(shop, id) {
  if (!isShop(shop) || !isId(id)) return false;
  const { deletedCount } = await TimerModel.deleteOne({ shop, _id: id });
  return deletedCount === 1;
}

export async function listTimers(shop, { limit, q, sort, after } = {}) {
  if (!isShop(shop)) return [];
  const direction = sort === "newest" ? -1 : 1;
  const filter = { shop };
  if (typeof q === "string" && q) filter.name = new RegExp(escapeRegex(q), "i");
  if (after) {
    const { sortAt, id } = after;
    if (!(sortAt instanceof Date) || Number.isNaN(sortAt.getTime()) || !isId(id)) return [];
    const [past, from] = direction === 1 ? ["$gt", "$gte"] : ["$lt", "$lte"];
    // The outer bound gives the index one tight range; $or only breaks ties.
    filter.sortAt = { [from]: sortAt };
    filter.$or = [{ sortAt: { [past]: sortAt } }, { _id: { [past]: id } }];
  }
  return TimerModel.find(filter, PROJECTION)
    .sort({ sortAt: direction, _id: direction })
    .limit(Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT)
    .lean();
}

export async function deleteTimersByShop(shop) {
  if (!isShop(shop)) return false;
  await TimerModel.deleteMany({ shop });
  return true;
}
