import { createLogger } from "../http/logger.js";
import { writeTargets } from "../integrations/targetsMetafield.js";
import { listTargetingTimers } from "../repositories/timerRepository.js";

const MAX_RULES = 100;
const MAX_BYTES = 60 * 1024;
const TIMEOUT_MS = 3000;
const ATTEMPTS = 2;
const defaultLogger = createLogger();

const seconds = (date, round) => (date ? round(date.getTime() / 1000) : null);

export function buildTargets(timers) {
  const rules = timers.map((timer) => {
    const fixed = timer.type === "fixed";
    return {
      t: timer.targetType,
      ids: timer.targetType === "all" ? [] : timer.targetIds.map((id) => id.split("/").pop()),
      s: fixed ? seconds(timer.startAt, Math.floor) : null,
      e: fixed ? seconds(timer.endAt, Math.ceil) : null,
    };
  });
  const value = { v: 1, rules };
  if (rules.length <= MAX_RULES && Buffer.byteLength(JSON.stringify(value)) <= MAX_BYTES) {
    return value;
  }
  // Too large to store: reserve space on every product.
  return { v: 1, rules: [{ t: "all", ids: [], s: null, e: null }] };
}

// Never throws: the timer change is already saved.
// shortcut: concurrent changes can write out of order until the next change; serialise per shop
// if that shows up.
export async function syncTargets(
  shop,
  { getClient, requestId, logger = defaultLogger, timeoutMs = TIMEOUT_MS }
) {
  try {
    const value = buildTargets(await listTargetingTimers(shop, new Date(), MAX_RULES + 1));
    const client = await getClient();
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await writeTargets(client, value, AbortSignal.timeout(timeoutMs));
      } catch (error) {
        if (attempt === ATTEMPTS) throw error;
      }
    }
  } catch (error) {
    // The class name only: client errors quote responses and request details.
    logger.warn({ requestId, errorType: error?.constructor?.name }, "Targeting sync failed");
  }
}
