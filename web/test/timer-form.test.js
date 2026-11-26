import { test } from "node:test";
import assert from "node:assert/strict";
import { createTimersApi } from "../frontend/api/timers.js";
import {
  buildPayload,
  clearErrors,
  emptyForm,
  formFromTimer,
  isChanged,
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
