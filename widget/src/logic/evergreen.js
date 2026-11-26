// Holds only what storage refused to save (blocked or full), for the life of the page.
const memory = new Map();

// `scope` is `window`: reading window.localStorage itself throws when storage is blocked.
function read(scope, area, key) {
  if (memory.has(area + key)) return memory.get(area + key);
  try {
    return scope[area].getItem(key);
  } catch {
    return null;
  }
}

function write(scope, area, key, value) {
  try {
    scope[area].setItem(key, value);
    memory.delete(area + key);
  } catch {
    memory.set(area + key, value);
  }
}

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
