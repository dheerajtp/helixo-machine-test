import { useRef } from "react";
import { useElementEvent } from "../../utils/useElementEvent";

export function UrgencyFields({ form, errors, onChange, onLeave }) {
  const effectRef = useRef(null);
  useElementEvent(effectRef, "change", (event) => onChange({ urgencyEffect: event.currentTarget.value }));

  return (
    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
      <s-select ref={effectRef} label="Urgency notification" value={form.urgencyEffect} error={errors.urgencyEffect}>
        <s-option value="colorPulse">Color pulse</s-option>
        <s-option value="blinkingText">Blinking text</s-option>
        <s-option value="none">None</s-option>
      </s-select>
      <s-number-field
        label="Show urgency in the last (minutes)"
        min="0"
        max="1440"
        value={form.urgencyMinutes}
        error={errors.urgencyMinutes}
        onInput={(event) => onChange({ urgencyMinutes: event.currentTarget.value })}
        onBlur={() => onLeave("urgencyMinutes")}
      ></s-number-field>
    </s-grid>
  );
}
