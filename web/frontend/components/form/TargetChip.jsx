import { useRef } from "react";
import { useElementEvent } from "../../utils/useElementEvent";

export function TargetChip({ title, onRemove }) {
  const chipRef = useRef(null);
  useElementEvent(chipRef, "remove", onRemove);

  return (
    <s-clickable-chip ref={chipRef} removable accessibilityLabel={`Remove ${title}`}>
      {title}
    </s-clickable-chip>
  );
}
