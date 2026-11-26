import { useEffect, useRef } from "react";

// Returns a function that runs its argument now, or after the click if a pointer is down.
export function useAfterPointer() {
  const down = useRef(false);
  const waiting = useRef([]);
  useEffect(() => {
    let timeout;
    const press = () => {
      down.current = true;
    };
    const release = () => {
      down.current = false;
      // The click follows pointerup in the same task, so a timeout runs after it.
      timeout = setTimeout(() => waiting.current.splice(0).forEach((run) => run()));
    };
    const events = [["pointerdown", press], ["pointerup", release], ["pointercancel", release]];
    for (const [name, listener] of events) document.addEventListener(name, listener, true);
    return () => {
      clearTimeout(timeout);
      for (const [name, listener] of events) document.removeEventListener(name, listener, true);
    };
  }, []);
  return (run) => (down.current ? waiting.current.push(run) : run());
}
