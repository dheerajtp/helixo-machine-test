import { read, write } from "./storage.js";

const ENDPOINT = "/apps/countdown/impressions";
const SESSION_KEY = "countdown-timer:session";

// A random id for this browser session; nothing else about the visitor is collected.
// shortcut: browsers without crypto.randomUUID are not counted, add a fallback if that share matters.
function sessionId(scope) {
  let id = read(scope, "sessionStorage", SESSION_KEY);
  if (!id) {
    id = scope.crypto.randomUUID();
    write(scope, "sessionStorage", SESSION_KEY, id);
  }
  return id;
}

// One attempt per timer per session. Never throws, never retries.
function send(scope, timerId) {
  try {
    const sentKey = `countdown-timer-sent:${timerId}`;
    if (read(scope, "sessionStorage", sentKey)) return;
    const body = JSON.stringify({ timerId, sessionId: sessionId(scope) });
    write(scope, "sessionStorage", sentKey, "1");
    scope
      .fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      })
      .catch(() => {});
  } catch {
    // Counting must never affect the countdown.
  }
}

// Counts the timer once `element` is on screen. Returns a function that stops watching.
export function watchImpression(scope, element, timerId) {
  const stop = () => {};
  try {
    // The theme editor is the merchant, not a shopper.
    if (scope.Shopify?.designMode) return stop;
    if (!scope.IntersectionObserver) {
      send(scope, timerId);
      return stop;
    }
    const observer = new scope.IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      send(scope, timerId);
    });
    observer.observe(element);
    return () => observer.disconnect();
  } catch {
    return stop;
  }
}
