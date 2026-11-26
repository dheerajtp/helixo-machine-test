import mongoose from "mongoose";

const DAY_SECONDS = 86400;

// One row per visitor session per timer, so a repeat is not counted twice. No personal data:
// sessionId is a random id the widget makes. Expires after a day.
const keySchema = new mongoose.Schema(
  {
    shop: { type: String, required: true },
    timerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sessionId: { type: String, required: true, match: /^[0-9a-f-]{36}$/i },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { collection: "impression_keys", strict: true, versionKey: false }
);
// Built by web/migrations/003-impression-indexes.js; declared here so tests (autoIndex on) match.
keySchema.index({ shop: 1, timerId: 1, sessionId: 1 }, { unique: true });
keySchema.index({ createdAt: 1 }, { expireAfterSeconds: DAY_SECONDS });

// One row per timer per UTC day: bounded growth, and the last days come from the index.
const statsSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true },
    timerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    count: { type: Number, required: true, min: 0 },
  },
  { collection: "timer_stats", strict: true, versionKey: false }
);
statsSchema.index({ shop: 1, timerId: 1, day: 1 }, { unique: true });

export const ImpressionKeyModel =
  mongoose.models.ImpressionKey ?? mongoose.model("ImpressionKey", keySchema);
export const TimerStatsModel =
  mongoose.models.TimerStats ?? mongoose.model("TimerStats", statsSchema);
