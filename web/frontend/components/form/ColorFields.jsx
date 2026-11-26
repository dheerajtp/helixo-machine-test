import { useRef } from "react";
import { useElementEvent } from "../../utils/useElementEvent";

export function ColorFields({ form, errors, onChange }) {
  const pickerRef = useRef(null);
  const pick = (event) => {
    const { value } = event.currentTarget;
    if (/^#[0-9a-f]{6}$/i.test(value)) onChange({ backgroundColor: value.toUpperCase() });
  };
  useElementEvent(pickerRef, "input", pick);
  useElementEvent(pickerRef, "change", pick);

  return (
    <s-stack gap="small-500">
      <s-text>Background color</s-text>
      <s-grid gridTemplateColumns="auto 8rem" gap="base" alignItems="start">
        <s-color-picker ref={pickerRef} value={form.backgroundColor}></s-color-picker>
        <s-text-field
          label="Background color hex code"
          labelAccessibilityVisibility="exclusive"
          maxLength="7"
          value={form.backgroundColor}
          error={errors.backgroundColor}
          onInput={(event) => onChange({ backgroundColor: event.currentTarget.value.trim() })}
        ></s-text-field>
      </s-grid>
    </s-stack>
  );
}
