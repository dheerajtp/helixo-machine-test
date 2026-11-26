import { localDateTime } from "../../utils/timerForm";
import { DateTimeFields } from "./DateTimeFields";

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function ScheduleFields({ form, errors, onChange, onLeave, openedStartDate }) {
  // Today onwards, plus the date the form opened with: a running timer's start is in the past.
  const startAllow = `${localDateTime(new Date().toISOString()).date}--,${openedStartDate}`;

  return (
    <s-stack gap="base">
      <DateTimeFields
        edge="start"
        label="Start"
        allow={startAllow}
        form={form}
        errors={errors}
        onChange={onChange}
        onLeave={onLeave}
      />
      <DateTimeFields edge="end" label="End" form={form} errors={errors} onChange={onChange} onLeave={onLeave} />
      <s-text color="subdued">Times are in your local timezone ({timeZone}).</s-text>
    </s-stack>
  );
}
