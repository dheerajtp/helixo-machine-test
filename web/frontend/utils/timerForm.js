// Create/edit form logic. No React here, so it runs under node --test.
// Limits mirror web/src/validators/timerDocument.js.

export const UNIT_SECONDS = { minutes: 60, hours: 3600, days: 86400 };
export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 120;
export const TARGETS_MAX = 100;
const HEX = /^#[0-9a-f]{6}$/i;
const CONTROL = /\p{Cc}/u;

// A new timer starts at the next 5-minute mark, which may be tomorrow.
function nextStart(now) {
  const date = new Date(now);
  date.setMinutes(date.getMinutes() - (date.getMinutes() % 5) + 5, 0, 0);
  return localDateTime(date.toISOString());
}

export const emptyForm = (now = new Date(), start = nextStart(now)) => ({
  name: "",
  type: "fixed",
  startDate: start.date,
  startTime: start.time,
  endDate: "",
  endTime: "11:59 PM",
  duration: "",
  durationUnit: "minutes",
  description: "",
  targetType: "all",
  productIds: [],
  collectionIds: [],
  backgroundColor: "#1A7F1A",
  size: "medium",
  position: "top",
  urgencyEffect: "colorPulse",
  urgencyMinutes: "5",
  enabled: true,
});

const pad = (number) => String(number).padStart(2, "0");

// UTC ISO string to the browser's local "YYYY-MM-DD" and "h:mm AM".
export function localDateTime(iso) {
  const date = new Date(iso);
  const hours = date.getHours();
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${hours % 12 || 12}:${pad(date.getMinutes())} ${hours < 12 ? "AM" : "PM"}`,
  };
}

// Accepts "11:59 PM" and "23:59". Returns [hours, minutes] or null.
export function parseTime(text) {
  const match = /^(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?$/i.exec(text.trim());
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const half = match[3]?.[0].toLowerCase();
  if (half) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (half === "p" ? 12 : 0);
  }
  return hours < 24 && minutes < 60 ? [hours, minutes] : null;
}

// Local date and time to a UTC ISO string, or null when either is not valid.
export function toIso(dateText, timeText) {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  const time = parseTime(timeText);
  if (!day || !time) return null;
  const [year, month, dayOfMonth] = day.slice(1).map(Number);
  const date = new Date(year, month - 1, dayOfMonth, ...time);
  // Date rolls 30 February over into March.
  const same =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === dayOfMonth;
  return same ? date.toISOString() : null;
}

const toSeconds = (text, unitSeconds) =>
  String(text).trim() === "" ? NaN : Math.round(Number(text) * unitSeconds);

export function formFromTimer(timer) {
  const form = {
    ...emptyForm(),
    name: timer.name,
    type: timer.type,
    description: timer.description ?? "",
    targetType: timer.targetType,
    backgroundColor: timer.appearance.backgroundColor,
    size: timer.appearance.size,
    position: timer.appearance.position,
    urgencyEffect: timer.urgencyEffect,
    urgencyMinutes: String(timer.urgencyThresholdSeconds / 60),
    enabled: timer.enabled,
  };
  if (timer.targetType === "products") form.productIds = [...timer.targetIds];
  if (timer.targetType === "collections") form.collectionIds = [...timer.targetIds];
  if (timer.type === "fixed") {
    const start = localDateTime(timer.startAt);
    const end = localDateTime(timer.endAt);
    Object.assign(form, { startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time });
  } else {
    // The largest unit that divides evenly; otherwise minutes with a fraction.
    const unit =
      ["days", "hours"].find((name) => timer.durationSeconds % UNIT_SECONDS[name] === 0) ?? "minutes";
    form.durationUnit = unit;
    form.duration = String(timer.durationSeconds / UNIT_SECONDS[unit]);
  }
  return form;
}

export const targetIdsOf = (form) => {
  if (form.targetType === "products") return form.productIds;
  if (form.targetType === "collections") return form.collectionIds;
  return [];
};

// Pass the timer being edited, if any.
export function validateForm(form, timer, now = new Date()) {
  const errors = {};

  const name = form.name.trim();
  if (!name) errors.name = "Enter a timer name";
  else if (name.length > NAME_MAX) errors.name = `Use ${NAME_MAX} characters or fewer`;
  else if (CONTROL.test(name)) errors.name = "Remove tabs and other control characters";

  const description = form.description.trim();
  if (description.length > DESCRIPTION_MAX) errors.description = `Use ${DESCRIPTION_MAX} characters or fewer`;
  else if (CONTROL.test(description)) errors.description = "Use a single line without tabs";

  if (form.type === "fixed") {
    for (const edge of ["start", "end"]) {
      const date = form[`${edge}Date`];
      const time = form[`${edge}Time`];
      if (!toIso(date, "00:00")) errors[`${edge}Date`] = `Enter the ${edge} date`;
      if (!parseTime(time)) errors[`${edge}Time`] = "Enter a time like 9:30 PM or 21:30";
    }
    const start = toIso(form.startDate, form.startTime);
    const end = toIso(form.endDate, form.endTime);
    if (start && end && new Date(end) <= new Date(start)) errors.endDate = "End must be after start";
    // An untouched stored start passes; a new or changed one may not be before this minute.
    const original = timer ? formFromTimer(timer) : null;
    const untouched = original?.startDate === form.startDate && original.startTime === form.startTime;
    if (start && !untouched && new Date(start) < new Date(now).setSeconds(0, 0)) {
      const pastDay = form.startDate < localDateTime(new Date(now).toISOString()).date;
      errors[pastDay ? "startDate" : "startTime"] = "Start cannot be in the past";
    }
  } else {
    const seconds = toSeconds(form.duration, UNIT_SECONDS[form.durationUnit]);
    if (!(seconds >= 60 && seconds <= 2592000)) errors.duration = "Enter from 1 minute to 30 days";
  }

  if (form.targetType !== "all") {
    const count = targetIdsOf(form).length;
    const kind = form.targetType === "products" ? "product" : "collection";
    if (count === 0) errors.targetIds = `Select at least one ${kind}`;
    else if (count > TARGETS_MAX) errors.targetIds = `Select ${TARGETS_MAX} ${kind}s or fewer`;
  }

  if (!HEX.test(form.backgroundColor)) errors.backgroundColor = "Use a color like #1A7F1A";

  const urgency = toSeconds(form.urgencyMinutes, 60);
  if (!(urgency >= 0 && urgency <= 86400)) errors.urgencyMinutes = "Enter from 0 to 1440 minutes";

  return errors;
}

// Call only with a form that passed validateForm. Pass the timer being edited, if any.
export function buildPayload(form, timer) {
  const payload = {
    name: form.name.trim(),
    enabled: form.enabled,
    description: form.description.trim(),
    targetType: form.targetType,
    appearance: {
      backgroundColor: form.backgroundColor,
      size: form.size,
      position: form.position,
    },
    urgencyEffect: form.urgencyEffect,
    urgencyThresholdSeconds: toSeconds(form.urgencyMinutes, 60),
  };
  // The API forbids changing the type.
  if (!timer) payload.type = form.type;
  if (form.targetType !== "all") payload.targetIds = targetIdsOf(form);

  if (form.type === "fixed") {
    const original = timer ? formFromTimer(timer) : null;
    for (const edge of ["start", "end"]) {
      const date = form[`${edge}Date`];
      const time = form[`${edge}Time`];
      // An untouched value is sent back as stored: the inputs drop seconds and a DST repeat.
      const untouched = original?.[`${edge}Date`] === date && original[`${edge}Time`] === time;
      payload[`${edge}At`] = untouched ? timer[`${edge}At`] : toIso(date, time);
    }
  } else {
    payload.durationSeconds = toSeconds(form.duration, UNIT_SECONDS[form.durationUnit]);
  }
  return payload;
}

export const isChanged = (initial, form) => JSON.stringify(initial) !== JSON.stringify(form);

const SERVER_FIELDS = {
  name: "name",
  type: "type",
  startAt: "startDate",
  endAt: "endDate",
  durationSeconds: "duration",
  description: "description",
  targetType: "targetType",
  targetIds: "targetIds",
  "appearance.backgroundColor": "backgroundColor",
  "appearance.size": "size",
  "appearance.position": "position",
  urgencyEffect: "urgencyEffect",
  urgencyThresholdSeconds: "urgencyMinutes",
  enabled: "enabled",
};

// API error details to { fields: { formKey: message }, other: [message] }.
export function serverErrors(details = []) {
  const fields = {};
  const other = [];
  for (const { field, message } of details) {
    // "targetIds.3" belongs to the targetIds field.
    const key = SERVER_FIELDS[field.replace(/\.\d+$/, "")];
    if (key) fields[key] ??= message;
    else other.push(message);
  }
  return { fields, other };
}

// Errors that a change to one field makes stale, besides its own.
const RELATED = {
  startDate: ["startTime", "endDate"],
  startTime: ["startDate", "endDate"],
  endTime: ["endDate"],
  durationUnit: ["duration"],
  targetType: ["targetIds"],
  productIds: ["targetIds"],
  collectionIds: ["targetIds"],
};

export function clearErrors(errors, changes) {
  const next = { ...errors };
  for (const key of Object.keys(changes)) {
    for (const stale of [key, ...(RELATED[key] ?? [])]) delete next[stale];
  }
  return next;
}
