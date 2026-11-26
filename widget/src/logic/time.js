// End of a fixed timer on the shopper's clock.
export const fixedEndMs = (endAt, offsetMs) => Date.parse(endAt) - offsetMs;

export const remainingSeconds = (endMs, nowMs = Date.now()) =>
  Math.max(0, Math.ceil((endMs - nowMs) / 1000));

export const splitTime = (seconds) => ({
  days: Math.floor(seconds / 86400),
  hours: Math.floor(seconds / 3600) % 24,
  minutes: Math.floor(seconds / 60) % 60,
  seconds: seconds % 60,
});

export const isUrgent = (remaining, thresholdSeconds) =>
  remaining > 0 && remaining <= thresholdSeconds;
