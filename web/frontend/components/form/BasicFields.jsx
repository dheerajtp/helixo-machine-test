import { useRef } from "react";
import { NAME_MAX } from "../../utils/timerForm";
import { useElementEvent } from "../../utils/useElementEvent";

export function BasicFields({ form, errors, onChange, onLeave, typeLocked }) {
  const typeRef = useRef(null);
  useElementEvent(typeRef, "change", (event) => onChange({ type: event.currentTarget.values[0] }));

  return (
    <>
      <s-text-field
        label="Timer name"
        required
        maxLength={String(NAME_MAX)}
        value={form.name}
        error={errors.name}
        onInput={(event) => onChange({ name: event.currentTarget.value })}
        onBlur={() => onLeave("name")}
      ></s-text-field>
      <s-choice-list
        ref={typeRef}
        label="Timer type"
        details={typeLocked ? "The type cannot be changed." : undefined}
        error={errors.type}
        disabled={typeLocked || undefined}
      >
        <s-choice value="fixed" selected={form.type === "fixed" || undefined}>
          Fixed dates
        </s-choice>
        <s-choice value="evergreen" selected={form.type === "evergreen" || undefined}>
          Evergreen
        </s-choice>
      </s-choice-list>
    </>
  );
}
