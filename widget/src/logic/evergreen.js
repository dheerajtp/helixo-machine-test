import { read, write } from "./storage.js";

// End of this visitor's evergreen countdown. A past value means "stay hidden this session".
export function evergreenEndMs({ id, durationSeconds }, scope, nowMs = Date.now()) {
  const key = `countdown-timer:${id}`;
  const durationMs = durationSeconds * 1000;
  const stored = Number(read(scope, "localStorage", key));
  const valid = stored > 0 && stored <= nowMs;
  const restart =
    !valid || (stored + durationMs <= nowMs && !read(scope, "sessionStorage", key));
  const start = restart ? nowMs : stored;

  if (restart) write(scope, "localStorage", key, String(start));
  write(scope, "sessionStorage", key, "1");
  return start + durationMs;
}
