import { useRef } from "react";
import { useElementEvent } from "../../utils/useElementEvent";

export function AppearanceFields({ form, errors, onChange }) {
  const sizeRef = useRef(null);
  const positionRef = useRef(null);
  useElementEvent(sizeRef, "change", (event) => onChange({ size: event.currentTarget.value }));
  useElementEvent(positionRef, "change", (event) => onChange({ position: event.currentTarget.value }));

  return (
    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
      <s-select ref={sizeRef} label="Timer size" value={form.size} error={errors.size}>
        <s-option value="small">Small</s-option>
        <s-option value="medium">Medium</s-option>
        <s-option value="large">Large</s-option>
      </s-select>
      <s-select ref={positionRef} label="Timer position" value={form.position} error={errors.position}>
        <s-option value="top">Top</s-option>
        <s-option value="bottom">Bottom</s-option>
      </s-select>
    </s-grid>
  );
}
