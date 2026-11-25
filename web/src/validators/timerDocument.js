import Joi from "joi";

// Per-field schemas carry no presence rules or defaults, so a PATCH schema can reuse them.
// Text is stored as written; whatever displays it must render it as text, never HTML.
const text = (max) =>
  Joi.string()
    .trim()
    .max(max)
    .pattern(/\p{Cc}/u, { name: "control", invert: true })
    .messages({ "string.pattern.invert.name": "{{#label}} must not contain control characters" });

const ISO_WITH_ZONE =
  /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]([01]\d|2[0-3]):?[0-5]\d)$/;

// Joi.date() accepts a missing timezone and rolls 30 February over, so parse here.
function parseDate(value, helpers) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const day = typeof value === "string" ? ISO_WITH_ZONE.exec(value)?.[1] : undefined;
  const midnight = new Date(`${day}T00:00:00Z`);
  const date = new Date(value);
  if (day && !Number.isNaN(date.getTime()) && midnight.toJSON()?.startsWith(day)) return date;
  return helpers.message("{{#label}} must be an ISO 8601 date and time with a timezone");
}
const isoDate = Joi.any().custom(parseDate);

const gid = (kind) => Joi.string().pattern(new RegExp(`^gid://shopify/${kind}/\\d{1,20}$`));
const idList = (kind) => Joi.array().items(gid(kind)).max(100).unique();

export const appearanceFields = {
  backgroundColor: Joi.string().pattern(/^#[0-9a-f]{6}$/i),
  size: Joi.string().valid("small", "medium", "large"),
  position: Joi.string().valid("top", "bottom"),
};

export const timerFields = {
  name: text(100),
  type: Joi.string().valid("fixed", "evergreen"),
  enabled: Joi.boolean(),
  startAt: isoDate,
  endAt: isoDate,
  durationSeconds: Joi.number().integer().min(60).max(2592000),
  targetType: Joi.string().valid("all", "products", "collections"),
  targetIds: idList("(Product|Collection)"),
  description: text(120).allow(""),
  appearance: Joi.object(appearanceFields),
  urgencyEffect: Joi.string().valid("colorPulse", "blinkingText", "none"),
  urgencyThresholdSeconds: Joi.number().integer().min(0).max(86400),
};

const onlyFor = (type, schema) =>
  Joi.when("type", { is: type, then: schema.required(), otherwise: Joi.forbidden() });

// startAt is declared before endAt, so it is already a Date here.
const afterStart = isoDate.custom((end, helpers) =>
  end <= helpers.state.ancestors[0].startAt
    ? helpers.message("{{#label}} must be after startAt")
    : end
);

// A complete timer's editable fields, including the cross-field rules.
export const timerSchema = Joi.object({
  name: timerFields.name.required(),
  type: timerFields.type.required(),
  enabled: timerFields.enabled.default(true),
  startAt: onlyFor("fixed", timerFields.startAt),
  endAt: onlyFor("fixed", afterStart),
  durationSeconds: onlyFor("evergreen", timerFields.durationSeconds),
  targetType: timerFields.targetType.required(),
  targetIds: Joi.when("targetType", {
    switch: [
      // "all" has no targets: whatever was sent is replaced by an empty list.
      { is: "all", then: Joi.any().custom(() => []).default([]) },
      { is: "products", then: idList("Product").min(1).required() },
      { is: "collections", then: idList("Collection").min(1).required() },
    ],
  }),
  description: timerFields.description.default(""),
  appearance: timerFields.appearance
    .keys({
      backgroundColor: appearanceFields.backgroundColor.required(),
      size: appearanceFields.size.default("medium"),
      position: appearanceFields.position.default("top"),
    })
    .required(),
  urgencyEffect: timerFields.urgencyEffect.default("colorPulse"),
  urgencyThresholdSeconds: timerFields.urgencyThresholdSeconds.default(300),
})
  .required()
  .prefs({ abortEarly: false, stripUnknown: true, convert: true });
