import { setTimeout as sleep } from "node:timers/promises";
import mongoose from "mongoose";
import { ImpressionKeyModel, TimerStatsModel } from "../models/impression.js";

const MAX_ATTEMPTS = 10;
const TRANSACTION = {
  readConcern: { level: "majority" },
  writeConcern: { w: "majority" },
};

const isShop = (value) => typeof value === "string" && value.length > 0;
const isId = (value) => typeof value === "string" && /^[0-9a-f]{24}$/i.test(value);
const isDay = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTransient = (error) => error?.hasErrorLabel?.("TransientTransactionError") === true;

class AlreadyCounted extends Error {}

// Inserts the session key and adds one to the day in one transaction. Returns false when the key
// already exists (already counted). Concurrent writers of the same key or day get a transient
// write conflict and retry, so no count is lost or doubled.
export async function recordImpression(shop, timerId, sessionId, day) {
  if (!isShop(shop) || !isId(timerId) || typeof sessionId !== "string" || !isDay(day)) {
    throw new TypeError("recordImpression needs shop, timerId, sessionId and day");
  }
  const session = await mongoose.startSession();
  try {
    for (let attempt = 1; ; attempt += 1) {
      session.startTransaction(TRANSACTION);
      try {
        try {
          await ImpressionKeyModel.create([{ shop, timerId, sessionId }], { session });
        } catch (error) {
          if (error?.code === 11000 && !isTransient(error)) throw new AlreadyCounted();
          throw error;
        }
        await TimerStatsModel.updateOne(
          { shop, timerId, day },
          { $inc: { count: 1 } },
          { upsert: true, session }
        );
        await session.commitTransaction();
        return true;
      } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        if (error instanceof AlreadyCounted) return false;
        if (!isTransient(error) || attempt >= MAX_ATTEMPTS) throw error;
        // Full jitter, doubling to a 250 ms cap, spreads writers of one busy day apart.
        await sleep(Math.random() * Math.min(250, 5 * 2 ** attempt));
      }
    }
  } finally {
    await session.endSession();
  }
}

// Per timer: the total and the newest 7 days that have a count, in one pass over the index.
export async function findStats(shop, timerIds) {
  if (!isShop(shop) || !Array.isArray(timerIds) || !timerIds.every(isId)) return [];
  if (!timerIds.length) return [];
  return TimerStatsModel.aggregate([
    {
      $match: {
        shop,
        timerId: { $in: timerIds.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    {
      $group: {
        _id: "$timerId",
        total: { $sum: "$count" },
        days: { $topN: { n: 7, sortBy: { day: -1 }, output: { day: "$day", count: "$count" } } },
      },
    },
  ]).option({ maxTimeMS: 500 });
}

export async function deleteTimerImpressions(shop, timerId) {
  if (!isShop(shop) || !isId(timerId)) return false;
  await TimerStatsModel.deleteMany({ shop, timerId });
  await ImpressionKeyModel.deleteMany({ shop, timerId });
  return true;
}

export async function deleteImpressionsByShop(shop) {
  if (!isShop(shop)) return false;
  await TimerStatsModel.deleteMany({ shop });
  await ImpressionKeyModel.deleteMany({ shop });
  return true;
}
