import { useRef } from "react";
import { useElementEvent } from "../../utils/useElementEvent";

const DISCARD_MODAL_ID = "discard-timer-changes-modal";

// Closing it any way other than "Discard changes" returns to the form.
export function DiscardChangesModal({ modalRef, onKeep }) {
  const discarded = useRef(false);
  useElementEvent(modalRef, "afterhide", () => {
    if (!discarded.current) onKeep();
    discarded.current = false;
  });

  return (
    <s-modal ref={modalRef} id={DISCARD_MODAL_ID} heading="Discard unsaved changes?">
      <s-paragraph>The changes you made to this timer will be lost.</s-paragraph>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        onClick={() => {
          discarded.current = true;
          modalRef.current?.hideOverlay();
        }}
      >
        Discard changes
      </s-button>
      <s-button slot="secondary-actions" commandFor={DISCARD_MODAL_ID} command="--hide">
        Keep editing
      </s-button>
    </s-modal>
  );
}
