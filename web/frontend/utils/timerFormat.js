// Display text for timer rows. No React here, so it runs under node --test.

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function targetText({ targetType, targetIds = [] }) {
  if (targetType === "products") return plural(targetIds.length, "product");
  if (targetType === "collections") return plural(targetIds.length, "collection");
  return "All products";
}

// 1800 -> "30 minutes", 5400 -> "1 hour 30 minutes".
export function durationText(totalSeconds) {
  const parts = [
    [Math.floor(totalSeconds / 86400), "day"],
    [Math.floor((totalSeconds % 86400) / 3600), "hour"],
    [Math.floor((totalSeconds % 3600) / 60), "minute"],
    [totalSeconds % 60, "second"],
  ];
  return parts
    .filter(([count]) => count > 0)
    .map(([count, word]) => plural(count, word))
    .join(" ");
}

// Returns the schedule lines. locale and timeZone default to the browser's.
export function scheduleLines(timer, { locale, timeZone } = {}) {
  if (timer.type === "evergreen") {
    return [`${durationText(timer.durationSeconds)} per visitor`];
  }
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  return [`Start: ${format.format(new Date(timer.startAt))}`, `End: ${format.format(new Date(timer.endAt))}`];
}

const STATUS = {
  active: { label: "Active", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  expired: { label: "Expired", tone: "neutral" },
  disabled: { label: "Disabled", tone: "caution" },
};

export const statusBadge = (status) => STATUS[status] ?? { label: status, tone: "neutral" };
