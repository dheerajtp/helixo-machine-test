import { useRef } from "react";
import { targetTypeChanges } from "../../utils/targets";
import { useElementEvent } from "../../utils/useElementEvent";
import { TargetPicker } from "./TargetPicker";

export function TargetingFields({ form, errors, onChange }) {
  const listRef = useRef(null);
  useElementEvent(listRef, "change", (event) => onChange(targetTypeChanges(event.currentTarget.values[0])));
  const choices = [
    ["all", "All products"],
    ["products", "Specific products"],
    ["collections", "Specific collections"],
  ];

  return (
    <s-stack gap="small">
      <s-choice-list ref={listRef} label="Show on" error={errors.targetIds ?? errors.targetType}>
        {choices.map(([value, label]) => (
          <s-choice key={value} value={value} selected={form.targetType === value || undefined}>
            {label}
          </s-choice>
        ))}
      </s-choice-list>
      {form.targetType !== "all" && <TargetPicker form={form} onChange={onChange} />}
    </s-stack>
  );
}
