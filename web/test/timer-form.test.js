import { test } from "node:test";
import assert from "node:assert/strict";
import { createTimersApi } from "../frontend/api/timers.js";
import {
  buildPayload,
  changeFields,
  clearErrors,
  emptyForm,
  formatTime,
  formatTimeField,
  formFromTimer,
  isChanged,
  leaveField,
  parseTime,
  serverErrors,
  toIso,
  validateForm,
} from "../frontend/utils/timerForm.js";
import { timerSchema } from "../src/validators/timerDocument.js";

// UTC+05:30, so a local/UTC mix-up cannot pass unnoticed.
process.env.TZ = "Asia/Kolkata";

// 10:00 local, before every start used below.
const NOW = new Date("2026-11-26T04:30:00.000Z");

const fixed = (changes) => ({
  ...emptyForm(NOW),
  name: "Sale",
  startDate: "2026-11-29",
  startTime: "12:00 AM",
  endDate: "2026-11-30",
  endTime: "23:59",
  ...changes,
});

const stored = {
  id: "665f1c2e9b1e8a0012345678",
  name: "Winter sale",
  type: "fixed",
  enabled: false,
  // Seconds, which the inputs cannot show.
  startAt: "2030-01-01T00:00:30.000Z",
  endAt: "2030-02-01T18:45:00.000Z",
  durationSeconds: null,
  targetType: "products",
  targetIds: ["gid://shopify/Product/1"],
  description: "",
  appearance: { backgroundColor: "#ff0000", size: "large", position: "bottom" },
  urgencyEffect: "none",
  urgencyThresholdSeconds: 90,
};

test("empty form has the defaults", () => {
  const form = emptyForm();
  assert.equal(form.size, "medium");
  assert.equal(form.position, "top");
  assert.equal(form.urgencyEffect, "colorPulse");
  assert.equal(form.urgencyMinutes, "5");
  assert.equal(form.enabled, true);
});

test("local dates and times become UTC", () => {
  assert.equal(toIso("2026-11-29", "12:00 AM"), "2026-11-28T18:30:00.000Z");
  assert.equal(toIso("2026-11-29", "12:00 PM"), "2026-11-29T06:30:00.000Z");
  assert.equal(toIso("2026-02-30", "10:00"), null);
  assert.equal(toIso("", "10:00"), null);
  assert.deepEqual(parseTime("11:59pm"), [23, 59]);
  for (const bad of ["24:00", "13:00 PM", "0:10 AM", "9", "10:60"]) assert.equal(parseTime(bad), null, bad);
});

test("create payload is accepted by the API schema and has no null fields", () => {
  const payload = buildPayload(fixed());
  assert.equal(timerSchema.validate(payload).error, undefined);
  assert.equal(payload.startAt, "2026-11-28T18:30:00.000Z");
  assert.equal(payload.urgencyThresholdSeconds, 300);
  assert.ok(!("durationSeconds" in payload) && !("targetIds" in payload));
  assert.ok(!JSON.stringify(payload).includes("null"));

  const evergreen = buildPayload(fixed({ type: "evergreen", duration: "2", durationUnit: "hours" }));
  assert.equal(timerSchema.validate(evergreen).error, undefined);
  assert.equal(evergreen.durationSeconds, 7200);
  assert.ok(!("startAt" in evergreen) && !("endAt" in evergreen));
});

test("validation mirrors the API limits", () => {
  assert.deepEqual(validateForm(fixed(), undefined, NOW), {});
  assert.equal(validateForm(fixed({ endDate: "2026-11-28" }), undefined, NOW).endDate, "End must be after start");
  const errors = validateForm(
    fixed({
      name: "  ",
      description: "a\nb",
      startTime: "soon",
      targetType: "collections",
      backgroundColor: "red",
      urgencyMinutes: "1441",
    }),
    undefined,
    NOW
  );
  assert.deepEqual(Object.keys(errors).sort(), [
    "backgroundColor",
    "description",
    "name",
    "startTime",
    "targetIds",
    "urgencyMinutes",
  ]);
  assert.ok(validateForm(fixed({ name: "x".repeat(101) })).name);
  assert.ok(validateForm(fixed({ description: "x".repeat(121) })).description);
  assert.ok(validateForm(fixed({ urgencyMinutes: "" })).urgencyMinutes);

  const duration = (value, durationUnit) =>
    validateForm(fixed({ type: "evergreen", duration: value, durationUnit })).duration;
  assert.equal(duration("1", "minutes"), undefined);
  assert.equal(duration("30", "days"), undefined);
  for (const [value, unit] of [["", "minutes"], ["0.5", "minutes"], ["31", "days"], ["x", "hours"]]) {
    assert.ok(duration(value, unit), `${value} ${unit}`);
  }
});

test("timer to form to payload round trip keeps every value and omits type", () => {
  const form = formFromTimer(stored);
  assert.equal(form.startDate, "2030-01-01");
  assert.equal(form.startTime, "5:30 AM");
  assert.equal(form.endDate, "2030-02-02");
  assert.equal(form.endTime, "12:15 AM");
  assert.deepEqual(validateForm(form), {});
  assert.deepEqual(buildPayload(form, stored), {
    name: stored.name,
    enabled: false,
    description: "",
    targetType: "products",
    targetIds: stored.targetIds,
    appearance: stored.appearance,
    urgencyEffect: "none",
    urgencyThresholdSeconds: 90,
    startAt: stored.startAt,
    endAt: stored.endAt,
  });
  assert.equal(buildPayload({ ...form, startTime: "6:00 AM" }, stored).startAt, "2030-01-01T00:30:00.000Z");
});

test("evergreen durations round trip in the largest whole unit", () => {
  const base = { ...stored, type: "evergreen", startAt: null, endAt: null };
  for (const [seconds, duration, unit] of [
    [172800, "2", "days"],
    [5400, "90", "minutes"],
    [7200, "2", "hours"],
    [100, String(100 / 60), "minutes"],
  ]) {
    const timer = { ...base, durationSeconds: seconds };
    const form = formFromTimer(timer);
    assert.deepEqual([form.duration, form.durationUnit], [duration, unit]);
    assert.equal(buildPayload(form, timer).durationSeconds, seconds);
  }
});

test("changes are detected against the starting values", () => {
  const initial = formFromTimer(stored);
  assert.ok(!isChanged(initial, { ...initial }));
  assert.ok(isChanged(initial, { ...initial, name: "Other" }));
});

test("server details map to form fields", () => {
  const { fields, other } = serverErrors([
    { field: "endAt", message: "end" },
    { field: "targetIds.2", message: "id" },
    { field: "appearance.backgroundColor", message: "color" },
    { field: "durationSeconds", message: "duration" },
    { field: "urgencyThresholdSeconds", message: "urgency" },
    { field: "body", message: "At least one field is required" },
  ]);
  assert.deepEqual(fields, {
    endDate: "end",
    targetIds: "id",
    backgroundColor: "color",
    duration: "duration",
    urgencyMinutes: "urgency",
  });
  assert.deepEqual(other, ["At least one field is required"]);
  assert.deepEqual(serverErrors(undefined), { fields: {}, other: [] });
  assert.deepEqual(clearErrors({ endDate: "x", name: "y" }, { startTime: "1" }), { name: "y" });
});

test("createTimer posts the timer", async () => {
  const calls = [];
  const api = createTimersApi((...args) => calls.push(args));
  await api.createTimer({ name: "Sale" });
  assert.deepEqual(calls, [["/api/timers", { method: "POST", body: { name: "Sale" }, signal: undefined }]]);
});

test("a new form starts at the next 5-minute mark, so only the end date is needed", () => {
  const form = { ...emptyForm(NOW), name: "Sale", endDate: "2026-11-27" };
  assert.deepEqual([form.startDate, form.startTime, form.endTime], ["2026-11-26", "10:05 AM", "11:59 PM"]);
  assert.deepEqual(validateForm(form, undefined, NOW), {});

  const late = emptyForm(new Date(2026, 10, 26, 23, 58, 30));
  assert.deepEqual([late.startDate, late.startTime, late.endDate], ["2026-11-27", "12:00 AM", ""]);
});

test("a new or changed start may not be in the past", () => {
  const now = new Date(NOW.getTime() + 30_000);
  const check = (changes, timer) => {
    const { startDate, startTime } = validateForm(fixed(changes), timer, now);
    return { startDate, startTime };
  };
  const ok = { startDate: undefined, startTime: undefined };
  const past = "Start cannot be in the past";
  for (const startTime of ["10:00 AM", "10:01 AM"]) {
    assert.deepEqual(check({ startDate: "2026-11-26", startTime }), ok);
  }
  assert.deepEqual(check({ startDate: "2026-11-26", startTime: "9:55 AM" }), { ...ok, startTime: past });
  assert.deepEqual(check({ startDate: "2026-11-25", startTime: "11:00 PM" }), { ...ok, startDate: past });

  const running = { ...stored, startAt: "2026-11-01T00:00:30.000Z" };
  const form = formFromTimer(running);
  assert.deepEqual(validateForm(form, running, now), {});
  assert.equal(validateForm({ ...form, startTime: "4:00 AM" }, running, now).startDate, past);
  assert.equal(validateForm({ ...form, startDate: "2026-10-31" }, running, now).startDate, past);
});

const session = (form = emptyForm(NOW)) => ({ form, edited: [], errors: {}, server: {} });
const type = (state, changes, timer) => changeFields(state, changes, timer, NOW);
const leave = (state, field, timer) => leaveField(formatTimeField(state, field), field, timer, NOW);
const enter = (state, field, value, timer) => leave(type(state, { [field]: value }, timer), field, timer);

test("leaving untouched fields shows nothing", () => {
  let state = session();
  for (const field of Object.keys(state.form)) state = leave(state, field);
  assert.deepEqual(state.errors, {});
  assert.deepEqual(state.form, emptyForm(NOW));
  // A pre-filled start that has since passed also waits for submit.
  const later = new Date(NOW.getTime() + 3_600_000);
  assert.deepEqual(leaveField(session(), "startTime", undefined, later).errors, {});
});

test("a bad value shows its error on leaving, not while typing, and clears when fixed", () => {
  for (const [field, bad, good, start] of [
    ["name", "  ", "Sale"],
    ["description", "x".repeat(121), "ok"],
    ["startTime", "9:30 pm,", "9:30 PM"],
    ["endTime", "23:59 pm", "23:59"],
    ["duration", "31000000", "5", { type: "evergreen" }],
    ["backgroundColor", "red", "#000000"],
    ["urgencyMinutes", "1441", "5"],
  ]) {
    const typed = type(session({ ...emptyForm(NOW), ...start }), { [field]: bad });
    assert.deepEqual(typed.errors, {}, field);
    const left = leave(typed, field);
    assert.deepEqual(Object.keys(left.errors), [field]);
    assert.equal(left.form[field], bad);
    assert.deepEqual(type(left, { [field]: good }).errors, {}, field);
  }
});

test("a unit change rechecks the duration", () => {
  const empty = session({ ...emptyForm(NOW), type: "evergreen" });
  assert.deepEqual(enter(empty, "durationUnit", "days").errors, {});
  const state = enter(enter(empty, "duration", "45"), "durationUnit", "days");
  assert.ok(state.errors.duration);
  assert.deepEqual(type(state, { durationUnit: "minutes" }).errors, {});
});

test("end before start appears once both are complete", () => {
  let state = enter(session(), "endTime", "9:00 AM");
  assert.deepEqual(state.errors, {});
  state = enter(state, "endDate", "2026-11-26");
  assert.deepEqual(state.errors, { endDate: "End must be after start" });
  assert.deepEqual(type(state, { startTime: "8:00 AM" }).errors.endDate, undefined);

  const valid = enter(session(), "endDate", "2026-11-27");
  assert.equal(enter(valid, "startDate", "2026-11-28").errors.endDate, "End must be after start");
  assert.equal(enter(valid, "startTime", "9:00 AM").errors.startTime, "Start cannot be in the past");
});

test("a server error stays until its field changes", () => {
  const state = { ...session(), server: { name: "Taken", endDate: "Bad" } };
  const next = type(leave(state, "name"), { description: "x" });
  assert.deepEqual(next.server, state.server);
  assert.deepEqual(type(next, { name: "Other" }).server, { endDate: "Bad" });
});

test("times are rewritten as h:mm AM/PM", () => {
  for (const [text, formatted] of [
    ["21:30", "9:30 PM"],
    ["00:05", "12:05 AM"],
    ["12:00", "12:00 PM"],
    [" 9:30p.m. ", "9:30 PM"],
    ["9:30 pm,", "9:30 pm,"],
    ["23:59 pm", "23:59 pm"],
    ["", ""],
  ]) {
    assert.equal(formatTime(text), formatted, text);
  }
});

test("rewriting a time leaves an edit form unchanged and keeps the stored instant", () => {
  const initial = formFromTimer(stored);
  const state = enter(session(initial), "startTime", "05:30", stored);
  assert.ok(!isChanged(initial, state.form));
  assert.deepEqual(state.errors, {});
  assert.equal(buildPayload(state.form, stored).startAt, stored.startAt);
});
