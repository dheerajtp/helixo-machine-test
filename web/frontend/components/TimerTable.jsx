import { useRef } from "react";
import { useElementEvent } from "../utils/useElementEvent";
import { TimerRow } from "./TimerRow";

export function TimerTable({ timers, impressions, loading, hasNext, hasPrevious, busy, onNext, onPrevious, onToggle, onEdit, onDelete }) {
  const tableRef = useRef(null);
  useElementEvent(tableRef, "nextpage", onNext);
  useElementEvent(tableRef, "previouspage", onPrevious);

  return (
    <s-table
      ref={tableRef}
      paginate
      loading={loading || undefined}
      hasNextPage={hasNext || undefined}
      hasPreviousPage={hasPrevious || undefined}
    >
      <s-table-header-row>
        <s-table-header listSlot="primary">Name</s-table-header>
        <s-table-header listSlot="inline">Status</s-table-header>
        <s-table-header>Type</s-table-header>
        <s-table-header>Target</s-table-header>
        <s-table-header>Schedule</s-table-header>
        <s-table-header format="numeric">Impressions</s-table-header>
        <s-table-header>
          {/* Blank in the approved design; still named for screen readers. */}
          <s-text accessibilityVisibility="exclusive">Actions</s-text>
        </s-table-header>
      </s-table-header-row>
      <s-table-body>
        {timers.map((timer) => (
          <TimerRow key={timer.id} timer={timer} impressions={impressions[timer.id]} busy={busy} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </s-table-body>
    </s-table>
  );
}
