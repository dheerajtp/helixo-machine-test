import mongoose from "mongoose";
import { Session } from "@shopify/shopify-api";

const FIELDS = [
  "id",
  "shop",
  "state",
  "isOnline",
  "scope",
  "expires",
  "accessToken",
  "refreshToken",
  "refreshTokenExpires",
  "onlineAccessInfo",
];
const PROJECTION = Object.fromEntries([["_id", 0], ...FIELDS.map((f) => [f, 1])]);
const MAX_SESSIONS_PER_SHOP = 100;

const schema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    shop: { type: String, required: true },
    state: String,
    isOnline: Boolean,
    scope: String,
    expires: Date,
    accessToken: String,
    refreshToken: String,
    refreshTokenExpires: Date,
    onlineAccessInfo: mongoose.Schema.Types.Mixed,
  },
  // `id: false`: the stored `id` field replaces Mongoose's virtual of the same name.
  { collection: "shopify_sessions", strict: true, id: false, versionKey: false }
);
// Built by web/migrations/001-session-indexes.js; declared here so tests (autoIndex on) match.
schema.index({ id: 1 }, { unique: true });
schema.index({ shop: 1, id: 1 });

const SessionModel =
  mongoose.models.ShopifySession ?? mongoose.model("ShopifySession", schema);

const isId = (value) => typeof value === "string" && value.length > 0;

const toSession = (doc) => (doc ? new Session(doc) : undefined);

async function storeSession(session) {
  if (!isId(session?.id) || !isId(session?.shop)) {
    throw new TypeError("storeSession needs a session with string id and shop");
  }
  const doc = Object.fromEntries(
    FIELDS.filter((f) => session[f] !== undefined && session[f] !== null).map((f) => [
      f,
      session[f],
    ])
  );
  const replace = () =>
    SessionModel.replaceOne({ id: doc.id }, doc, { upsert: true, runValidators: true });
  try {
    await replace();
  } catch (error) {
    // Two concurrent upserts of a new id: the loser hits the unique index once, then replaces.
    if (error?.code !== 11000) throw error;
    await replace();
  }
  return true;
}

async function loadSession(id) {
  if (!isId(id)) return undefined;
  return toSession(await SessionModel.findOne({ id }, PROJECTION).lean());
}

async function deleteSession(id) {
  if (!isId(id)) return false;
  await SessionModel.deleteOne({ id });
  return true;
}

async function deleteSessions(ids) {
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isId)) return false;
  await SessionModel.deleteMany({ id: { $in: ids } });
  return true;
}

async function findSessionsByShop(shop) {
  if (!isId(shop)) return [];
  const docs = await SessionModel.find({ shop }, PROJECTION)
    .sort({ id: 1 })
    .limit(MAX_SESSIONS_PER_SHOP)
    .lean();
  return docs.map(toSession);
}

// Not part of Shopify's interface. Unlike findSessionsByShop, it is not capped.
export async function deleteSessionsByShop(shop) {
  if (!isId(shop)) return false;
  await SessionModel.deleteMany({ shop });
  return true;
}

export const sessionStorage = Object.freeze({
  storeSession,
  loadSession,
  deleteSession,
  deleteSessions,
  findSessionsByShop,
});
