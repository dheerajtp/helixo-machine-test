import { createClient } from "./client.js";

export function createTimersApi(request = createClient()) {
  const timerPath = (id) => `/api/timers/${encodeURIComponent(id)}`;
  return {
    // query: { limit, cursor, q, sort }
    listTimers: (query, { signal } = {}) => request("/api/timers", { query, signal }),
    updateTimer: (id, changes, { signal } = {}) =>
      request(timerPath(id), { method: "PATCH", body: changes, signal }),
    deleteTimer: (id, { signal } = {}) => request(timerPath(id), { method: "DELETE", signal }),
  };
}

export const { listTimers, updateTimer, deleteTimer } = createTimersApi();
