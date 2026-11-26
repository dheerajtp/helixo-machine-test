import { useRef } from "react";
import { useElementEvent } from "../../utils/useElementEvent";

export function EnabledField({ form, errors, onChange }) {
  const ref = useRef(null);
  useElementEvent(ref, "change", (event) => onChange({ enabled: event.currentTarget.checked }));

  return (
    <s-checkbox ref={ref} label="Timer enabled" checked={form.enabled || undefined} error={errors.enabled}></s-checkbox>
  );
}
