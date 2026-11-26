import { useRef, useState } from "react";
import { useMutation } from "react-query";
import { createTimer, updateTimer } from "../../api/timers";
import {
  buildPayload,
  clearErrors,
  DESCRIPTION_MAX,
  emptyForm,
  formFromTimer,
  isChanged,
  serverErrors,
  validateForm,
} from "../../utils/timerForm";
import { useElementEvent } from "../../utils/useElementEvent";
import { AppearanceFields } from "./AppearanceFields";
import { BasicFields } from "./BasicFields";
import { ColorFields } from "./ColorFields";
import { DiscardChangesModal } from "./DiscardChangesModal";
import { DurationFields } from "./DurationFields";
import { EnabledField } from "./EnabledField";
import { ScheduleFields } from "./ScheduleFields";
import { TargetingFields } from "./TargetingFields";
import { UrgencyFields } from "./UrgencyFields";

const FORM_MODAL_ID = "timer-form-modal";

const startState = ({ id, timer }) => {
  const initial = timer ? formFromTimer(timer) : emptyForm();
  return { id, initial, form: initial, errors: {}, failure: null };
};

// Create and edit. Stays mounted so the page can open it through modalRef.current.showOverlay().
export function TimerFormModal({ modalRef, session, onSaved }) {
  const [state, setState] = useState(() => startState(session));
  // Adjusting state during render: a new session starts from a clean form.
  if (state.id !== session.id) setState(startState(session));
  const { initial, form, errors, failure } = state;
  const isEdit = Boolean(session.timer);
  const discardRef = useRef(null);
  const savedId = useRef(null);

  const save = useMutation(
    ({ timer, payload }) => (timer ? updateTimer(timer.id, payload) : createTimer(payload)),
    {
      onSuccess: (_result, { timer }) => {
        savedId.current = session.id;
        modalRef.current?.hideOverlay();
        onSaved(Boolean(timer));
      },
      onError: (error) => {
        const { fields, other } = serverErrors(error.details);
        setState((current) => ({
          ...current,
          errors: fields,
          failure: [error.message || "Timer could not be saved", ...other].join(". "),
        }));
        // It may have been closed while saving.
        modalRef.current?.showOverlay();
      },
    }
  );

  const change = (changes) =>
    setState((current) => ({
      ...current,
      form: { ...current.form, ...changes },
      errors: clearErrors(current.errors, changes),
    }));

  const submit = () => {
    if (save.isLoading) return;
    const found = validateForm(form);
    setState((current) => ({ ...current, errors: found, failure: null }));
    if (Object.keys(found).length === 0) {
      save.mutate({ timer: session.timer, payload: buildPayload(form, session.timer) });
    }
  };

  // The modal cannot veto closing (X, Escape, backdrop, Cancel), so act once it is closed.
  useElementEvent(modalRef, "afterhide", (event) => {
    // Children such as removable chips fire afterhide too.
    if (event.target !== event.currentTarget || savedId.current === session.id) return;
    if (save.isLoading) modalRef.current?.showOverlay();
    else if (isChanged(initial, form)) discardRef.current?.showOverlay();
  });

  const fields = { form, errors, onChange: change };

  return (
    <>
      <s-modal ref={modalRef} id={FORM_MODAL_ID} heading={isEdit ? "Edit Timer" : "Create New Timer"}>
        {/* Keyed so every opening gets fresh elements. */}
        <s-stack key={state.id} gap="base">
          {failure && <s-banner tone="critical" heading={failure}></s-banner>}
          <BasicFields {...fields} typeLocked={isEdit} />
          {form.type === "fixed" ? <ScheduleFields {...fields} /> : <DurationFields {...fields} />}
          <s-text-area
            label="Promotion description"
            placeholder="Enter promotion details"
            rows="3"
            maxLength={String(DESCRIPTION_MAX)}
            value={form.description}
            error={errors.description}
            onInput={(event) => change({ description: event.currentTarget.value })}
          ></s-text-area>
          <TargetingFields {...fields} />
          <ColorFields {...fields} />
          <AppearanceFields {...fields} />
          <UrgencyFields {...fields} />
          <EnabledField {...fields} />
        </s-stack>
        <s-button slot="primary-action" variant="primary" loading={save.isLoading || undefined} onClick={submit}>
          {isEdit ? "Save changes" : "Create timer"}
        </s-button>
        <s-button
          slot="secondary-actions"
          commandFor={FORM_MODAL_ID}
          command="--hide"
          disabled={save.isLoading || undefined}
        >
          Cancel
        </s-button>
      </s-modal>
      <DiscardChangesModal modalRef={discardRef} onKeep={() => modalRef.current?.showOverlay()} />
    </>
  );
}
