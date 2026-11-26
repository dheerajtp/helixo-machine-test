import "./ui/countdown.css";
import { h, render } from "preact";
import { fetchTimer } from "./logic/api.js";
import { textColor } from "./logic/color.js";
import { evergreenEndMs } from "./logic/evergreen.js";
import { fixedEndMs, isUrgent, remainingSeconds, splitTime } from "./logic/time.js";
import { Countdown } from "./ui/Countdown.jsx";

const drawCountdown = (slot, props) => render(props && h(Countdown, props), slot);

// Nothing here may throw or log: a failure leaves the slot empty and the storefront untouched.
export function createWidget(scope, { draw = drawCountdown, now = Date.now } = {}) {
  const requests = new Map(); // one request per product for the life of the page
  const slots = new Map(); // slot element -> { interval }

  function load({ productId, collectionIds = "" }) {
    const key = `${productId}:${collectionIds}`;
    if (!requests.has(key)) {
      const request = fetchTimer({
        productId,
        collectionIds: collectionIds.split(","),
        fetch: (...args) => scope.fetch(...args),
        now,
      }).then((result) => {
        if (!result) return null;
        const { timer, offsetMs } = result;
        const endMs =
          timer.type === "fixed"
            ? fixedEndMs(timer.endAt, offsetMs)
            : evergreenEndMs(timer, scope, now());
        return { timer, endMs };
      });
      requests.set(key, request);
    }
    return requests.get(key);
  }

  function clear(slot, state) {
    scope.clearInterval(state.interval);
    try {
      draw(slot, null);
    } catch {
      // The slot is already broken; there is nothing left to undo.
    }
  }

  async function mount(slot) {
    if (slots.has(slot)) return;
    const state = {};
    slots.set(slot, state);
    try {
      const found = await load(slot.dataset);
      // The theme editor may have removed the slot while the request was running.
      if (!found || slots.get(slot) !== state) return;
      const { timer, endMs } = found;
      const color = textColor(timer.appearance.backgroundColor);

      const tick = () => {
        try {
          const remaining = remainingSeconds(endMs, now());
          if (remaining === 0) return clear(slot, state);
          draw(slot, {
            parts: splitTime(remaining),
            description: timer.description,
            appearance: timer.appearance,
            textColor: color,
            urgencyEffect: timer.urgencyEffect,
            urgent: isUrgent(remaining, timer.urgencyThresholdSeconds),
          });
          // A stale page can leave the slot unreserved; it needs its size once something is in it.
          slot.classList.add("cdt-slot--reserve");
        } catch {
          clear(slot, state);
        }
      };
      // The interval exists before the first tick, so a tick that ends the countdown can clear it.
      state.interval = scope.setInterval(tick, 1000);
      tick();
    } catch {
      clear(slot, state);
    }
  }

  function unmount(slot) {
    const state = slots.get(slot);
    if (!state) return;
    slots.delete(slot);
    clear(slot, state);
  }

  const each = (root, action) => root.querySelectorAll(".cdt-slot").forEach(action);

  return {
    mount,
    unmount,
    start() {
      const { document } = scope;
      // Theme editor events; they never fire on the live storefront.
      document.addEventListener("shopify:section:load", (event) => each(event.target, mount));
      document.addEventListener("shopify:section:unload", (event) => each(event.target, unmount));
      each(document, mount);
    },
  };
}

// A page with two blocks runs this file twice; only the first run starts the widget.
if (typeof window !== "undefined" && !window.cdtStarted) {
  window.cdtStarted = true;
  try {
    createWidget(window).start();
  } catch {
    // Never break the storefront.
  }
}
