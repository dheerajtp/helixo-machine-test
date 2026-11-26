import { useRef } from "react";
import { useElementEvent } from "../utils/useElementEvent";

export const SEARCH_MAX_LENGTH = 100;

export function TimerFilters({ search, sort, onSearchChange, onSortChange }) {
  const sortRef = useRef(null);
  useElementEvent(sortRef, "change", (event) => onSortChange(event.currentTarget.value));

  return (
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
      <s-search-field
        label="Search timers"
        labelAccessibilityVisibility="exclusive"
        placeholder="Search timers"
        maxLength={String(SEARCH_MAX_LENGTH)}
        value={search}
        onInput={(event) => onSearchChange(event.currentTarget.value.slice(0, SEARCH_MAX_LENGTH))}
      ></s-search-field>
      <s-select ref={sortRef} label="Sort" labelAccessibilityVisibility="exclusive" value={sort}>
        <s-option value="oldest">Sort: Start date (oldest first)</s-option>
        <s-option value="newest">Sort: Start date (newest first)</s-option>
      </s-select>
    </s-grid>
  );
}
