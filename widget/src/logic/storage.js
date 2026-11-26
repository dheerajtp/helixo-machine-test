// Holds only what storage refused to save (blocked or full), for the life of the page.
const memory = new Map();

// `scope` is `window`: reading window.localStorage itself throws when storage is blocked.
export function read(scope, area, key) {
  if (memory.has(area + key)) return memory.get(area + key);
  try {
    return scope[area].getItem(key);
  } catch {
    return null;
  }
}

export function write(scope, area, key, value) {
  try {
    scope[area].setItem(key, value);
    memory.delete(area + key);
  } catch {
    memory.set(area + key, value);
  }
}
