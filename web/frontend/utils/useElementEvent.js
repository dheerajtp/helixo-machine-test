import { useEffect, useRef } from "react";

// React 18 does not bind custom events (or "change") on web components: listen through the ref.
export function useElementEvent(ref, eventName, handler) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const listener = (event) => latest.current(event);
    element.addEventListener(eventName, listener);
    return () => element.removeEventListener(eventName, listener);
  }, [ref, eventName]);
}
