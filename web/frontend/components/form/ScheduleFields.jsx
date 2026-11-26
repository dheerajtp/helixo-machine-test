import { DateTimeFields } from "./DateTimeFields";

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function ScheduleFields({ form, errors, onChange }) {
  return (
    <s-stack gap="base">
      <DateTimeFields edge="start" label="Start" form={form} errors={errors} onChange={onChange} />
      <DateTimeFields edge="end" label="End" form={form} errors={errors} onChange={onChange} />
      <s-text color="subdued">Times are in your local timezone ({timeZone}).</s-text>
    </s-stack>
  );
}
