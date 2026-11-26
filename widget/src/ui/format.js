const UNITS = [
  ["days", "Days", "day"],
  ["hours", "Hours", "hour"],
  ["minutes", "Mins", "minute"],
  ["seconds", "Secs", "second"],
];

// Days hide when zero; the other tiles always show.
export function tiles(parts) {
  return UNITS.filter(([key]) => key !== "days" || parts.days > 0).map(([key, label]) => ({
    key,
    label,
    value: String(parts[key]).padStart(2, "0"),
  }));
}

// Screen reader text. Seconds are left out so it changes at most once a minute.
export function timeLeftLabel(parts) {
  const spoken = UNITS.slice(0, 3)
    .filter(([key]) => parts[key] > 0)
    .map(([key, , word]) => `${parts[key]} ${word}${parts[key] === 1 ? "" : "s"}`);
  return `Time left: ${spoken.join(", ") || "less than a minute"}`;
}
