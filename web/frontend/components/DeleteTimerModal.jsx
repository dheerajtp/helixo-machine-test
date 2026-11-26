import { useElementEvent } from "../utils/useElementEvent";

export const DELETE_MODAL_ID = "delete-timer-modal";

// Stays mounted so the page can open it through modalRef.current.showOverlay().
export function DeleteTimerModal({ modalRef, timer, busy, onConfirm, onHidden }) {
  useElementEvent(modalRef, "afterhide", onHidden);

  return (
    <s-modal ref={modalRef} id={DELETE_MODAL_ID} heading={timer ? `Delete "${timer.name}"?` : "Delete timer?"}>
      <s-paragraph>The timer is removed from your store. This cannot be undone.</s-paragraph>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        loading={busy || undefined}
        disabled={busy || !timer || undefined}
        onClick={onConfirm}
      >
        Delete timer
      </s-button>
      <s-button
        slot="secondary-actions"
        commandFor={DELETE_MODAL_ID}
        command="--hide"
        disabled={busy || undefined}
      >
        Cancel
      </s-button>
    </s-modal>
  );
}
