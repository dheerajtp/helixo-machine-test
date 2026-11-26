import { AppError } from "../http/errors.js";
import * as impressions from "../repositories/impressionRepository.js";
import * as timers from "../repositories/timerRepository.js";

const DAY_MS = 86_400_000;
const utcDay = (date) => date.toISOString().slice(0, 10);

// Counts once per session per timer; a repeat is a success that counts nothing.
// shortcut: a timer deleted between the check and the write leaves an orphan stats row,
// removed by the shop's redact; check inside the transaction if that ever matters.
export async function recordImpression(shop, { timerId, sessionId }, now = new Date()) {
  if (!(await timers.timerExists(shop, timerId))) {
    throw new AppError("NOT_FOUND", "Timer not found");
  }
  await impressions.recordImpression(shop, timerId, sessionId, utcDay(now));
}

// One entry per own timer asked for, in the order asked; other shops' ids are left out.
// last7Days is the 7 UTC days ending today, oldest first, 0 where nothing was counted.
export async function getTimerStats(shop, ids, now = new Date()) {
  const own = await timers.findTimerIds(shop, ids);
  const rows = await impressions.findStats(shop, own);
  const byId = new Map(rows.map((row) => [String(row._id), row]));
  const days = Array.from({ length: 7 }, (_, i) => utcDay(new Date(now - (6 - i) * DAY_MS)));
  const ownSet = new Set(own);
  return ids
    .filter((id) => ownSet.has(id))
    .map((timerId) => {
      const row = byId.get(timerId);
      const counts = new Map((row?.days ?? []).map((d) => [d.day, d.count]));
      return {
        timerId,
        total: row?.total ?? 0,
        last7Days: days.map((day) => ({ day, count: counts.get(day) ?? 0 })),
      };
    });
}
