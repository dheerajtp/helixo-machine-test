const ENDPOINT = "/apps/countdown/timer";
const ID = /^\d{1,20}$/;
const RETRY = Symbol("retry");

// Resolves to { timer, offsetMs } (server clock minus shopper clock) or null. Never rejects.
export async function fetchTimer({
  productId,
  collectionIds = [],
  fetch = globalThis.fetch,
  now = Date.now,
  timeoutMs = 3000,
} = {}) {
  try {
    if (!ID.test(String(productId))) return null;

    const ids = collectionIds.map(String).filter((id) => ID.test(id)).slice(0, 50);
    // The API rejects an empty collectionIds, so the key is left out.
    const query = ids.length ? `&collectionIds=${ids.join(",")}` : "";
    const url = `${ENDPOINT}?productId=${productId}${query}`;

    let result = await attempt(url, fetch, now, timeoutMs);
    if (result === RETRY) result = await attempt(url, fetch, now, timeoutMs);
    return result === RETRY ? null : result;
  } catch {
    return null;
  }
}

async function attempt(url, fetch, now, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // no-cache revalidates, so the Date header is current even when the body is cached.
    const response = await fetch(url, { cache: "no-cache", signal: controller.signal });
    if (response.status >= 500) return RETRY;
    if (!response.ok) return null;

    const body = await response.json();
    const timer = body?.success === true ? body.data : null;
    if (!isTimer(timer)) return null;

    const serverMs = [response.headers.get("date"), timer.serverNow]
      .map((value) => Date.parse(value))
      .find(Number.isFinite);
    return { timer, offsetMs: serverMs === undefined ? 0 : serverMs - now() };
  } catch (error) {
    // A SyntaxError is a bad body (for example an HTML page), which a retry will not fix.
    return error?.name === "SyntaxError" ? null : RETRY;
  } finally {
    clearTimeout(timeout);
  }
}

function isTimer(timer) {
  const { id, type, appearance } = timer ?? {};
  return (
    typeof id === "string" &&
    id !== "" &&
    ((type === "fixed" && Number.isFinite(Date.parse(timer.endAt))) ||
      (type === "evergreen" && Number.isFinite(timer.durationSeconds) && timer.durationSeconds > 0)) &&
    typeof timer.description === "string" &&
    /^#[0-9a-f]{6}$/i.test(appearance?.backgroundColor) &&
    ["small", "medium", "large"].includes(appearance.size) &&
    ["top", "bottom"].includes(appearance.position) &&
    ["colorPulse", "blinkingText", "none"].includes(timer.urgencyEffect) &&
    Number.isFinite(timer.urgencyThresholdSeconds)
  );
}
