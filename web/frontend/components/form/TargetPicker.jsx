import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { pickerOptions, readSelection, TARGET_KINDS, targetTitle } from "../../utils/targets";
import { targetIdsOf } from "../../utils/timerForm";
import { TargetChip } from "./TargetChip";

export function TargetPicker({ form, onChange }) {
  const shopify = useAppBridge();
  // Titles come from the picker only; they are never saved.
  const [titles, setTitles] = useState({});
  const [picking, setPicking] = useState(false);
  const [failed, setFailed] = useState(false);
  const { targetType } = form;
  const { idsKey } = TARGET_KINDS[targetType];
  const ids = targetIdsOf(form);

  const browse = async () => {
    if (picking) return;
    setPicking(true);
    setFailed(false);
    try {
      const selection = readSelection(await shopify.resourcePicker(pickerOptions(targetType, ids)));
      if (selection) {
        setTitles((current) => ({ ...current, ...selection.titles }));
        onChange({ [idsKey]: selection.ids });
      }
    } catch {
      setFailed(true);
    } finally {
      setPicking(false);
    }
  };

  return (
    <s-stack gap="small">
      {failed && <s-banner tone="critical" heading="The picker could not be opened. Try again."></s-banner>}
      <s-stack direction="inline">
        <s-button disabled={picking || undefined} onClick={browse}>
          Browse {targetType}
        </s-button>
      </s-stack>
      <s-stack direction="inline" gap="small">
        {ids.map((id) => (
          <TargetChip
            key={id}
            title={targetTitle(targetType, id, titles)}
            onRemove={() => onChange({ [idsKey]: ids.filter((other) => other !== id) })}
          />
        ))}
      </s-stack>
    </s-stack>
  );
}
