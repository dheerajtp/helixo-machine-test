import mongoose from "mongoose";

// Rules that span fields (dates per type, targetIds per targetType) live in the service.
const appearance = new mongoose.Schema(
  {
    backgroundColor: { type: String, required: true, match: /^#[0-9a-f]{6}$/i },
    size: { type: String, enum: ["small", "medium", "large"], default: "medium" },
    position: { type: String, enum: ["top", "bottom"], default: "top" },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    shop: { type: String, required: true },
    name: { type: String, required: true, maxlength: 100 },
    type: { type: String, required: true, enum: ["fixed", "evergreen"] },
    enabled: { type: Boolean, default: true },
    startAt: Date,
    endAt: Date,
    durationSeconds: { type: Number, min: 60, max: 2592000 },
    targetType: { type: String, required: true, enum: ["all", "products", "collections"] },
    targetIds: {
      type: [String],
      validate: { validator: (ids) => ids.length <= 100, message: "At most 100 targetIds" },
    },
    description: { type: String, maxlength: 120, default: "" },
    appearance: { type: appearance, required: true },
    urgencyEffect: {
      type: String,
      enum: ["colorPulse", "blinkingText", "none"],
      default: "colorPulse",
    },
    urgencyThresholdSeconds: { type: Number, min: 0, max: 86400, default: 300 },
    // Server-owned list sort key: startAt (fixed) or createdAt (evergreen).
    sortAt: { type: Date, required: true },
  },
  { collection: "timers", strict: true, timestamps: true, versionKey: false }
);
// Built by web/migrations/002-timer-indexes.js; declared here so tests (autoIndex on) match.
schema.index({ shop: 1, _id: -1 });
schema.index({ shop: 1, sortAt: 1, _id: 1 });
schema.index({ shop: 1, enabled: 1, targetType: 1 });

export const TimerModel = mongoose.models.Timer ?? mongoose.model("Timer", schema);
