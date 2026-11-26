import { useRef } from "react";
import { useElementEvent } from "../../utils/useElementEvent";

// Polaris web components have no time field, so the time is a text field.
export function DateTimeFields({ edge, label, allow, form, errors, onChange }) {
  const dateRef = useRef(null);
  useElementEvent(dateRef, "change", (event) => onChange({ [`${edge}Date`]: event.currentTarget.value }));

  return (
    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
      <s-date-field
        ref={dateRef}
        label={`${label} date`}
        required
        allow={allow}
        value={form[`${edge}Date`]}
        error={errors[`${edge}Date`]}
      ></s-date-field>
      <s-text-field
        label={`${label} time`}
        required
        placeholder="e.g. 9:30 PM or 21:30"
        value={form[`${edge}Time`]}
        error={errors[`${edge}Time`]}
        onInput={(event) => onChange({ [`${edge}Time`]: event.currentTarget.value })}
      ></s-text-field>
    </s-grid>
  );
}
