import { scheduleLines, statusBadge, targetText } from "../utils/timerFormat";

// Name, description and the other strings render as text (React escapes them), never as HTML.
export function TimerRow({ timer, busy, onToggle, onDelete }) {
  const badge = statusBadge(timer.status);
  const menuId = `timer-menu-${timer.id}`;

  return (
    <s-table-row>
      <s-table-cell>
        <s-stack gap="small-500">
          <s-text type="strong">{timer.name}</s-text>
          {timer.description && <s-text color="subdued">{timer.description}</s-text>}
        </s-stack>
      </s-table-cell>
      <s-table-cell>
        <s-badge tone={badge.tone}>{badge.label}</s-badge>
      </s-table-cell>
      <s-table-cell>{timer.type === "evergreen" ? "Evergreen" : "Fixed"}</s-table-cell>
      <s-table-cell>{targetText(timer)}</s-table-cell>
      <s-table-cell>
        <s-stack gap="small-500">
          {scheduleLines(timer).map((line) => (
            <s-text key={line}>{line}</s-text>
          ))}
        </s-stack>
      </s-table-cell>
      <s-table-cell>{(timer.impressions ?? 0).toLocaleString()}</s-table-cell>
      <s-table-cell>
        <s-button
          variant="tertiary"
          icon="menu-horizontal"
          accessibilityLabel={`Actions for ${timer.name}`}
          commandFor={menuId}
        ></s-button>
        <s-menu id={menuId} accessibilityLabel={`Actions for ${timer.name}`}>
          {/* Edit arrives with the form in plan 06. */}
          <s-button icon="edit" disabled>
            Edit
          </s-button>
          <s-button disabled={busy || undefined} onClick={() => onToggle(timer)}>
            {timer.enabled ? "Disable" : "Enable"}
          </s-button>
          <s-button icon="delete" tone="critical" disabled={busy || undefined} onClick={() => onDelete(timer)}>
            Delete
          </s-button>
        </s-menu>
      </s-table-cell>
    </s-table-row>
  );
}
