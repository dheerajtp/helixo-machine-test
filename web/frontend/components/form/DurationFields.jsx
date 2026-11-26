import { useRef } from "react";
import { useElementEvent } from "../../utils/useElementEvent";

export function DurationFields({ form, errors, onChange, onLeave }) {
  const unitRef = useRef(null);
  useElementEvent(unitRef, "change", (event) => {
    onChange({ durationUnit: event.currentTarget.value });
    onLeave("durationUnit");
  });

  return (
    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
      <s-number-field
        label="Duration"
        required
        min="0"
        details="Starts on each visitor's first visit."
        value={form.duration}
        error={errors.duration}
        onInput={(event) => onChange({ duration: event.currentTarget.value })}
        onBlur={() => onLeave("duration")}
      ></s-number-field>
      <s-select ref={unitRef} label="Unit" value={form.durationUnit}>
        <s-option value="minutes">Minutes</s-option>
        <s-option value="hours">Hours</s-option>
        <s-option value="days">Days</s-option>
      </s-select>
    </s-grid>
  );
}
