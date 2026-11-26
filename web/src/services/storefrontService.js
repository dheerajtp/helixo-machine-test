import * as repo from "../repositories/timerRepository.js";

const MAX_AGE = 60;

// The widget payload (plan 07 G3) plus its cache validators. The ETag is the timer id and its
// updatedAt, so it changes with any timer field but not with serverNow.
export async function getStorefrontTimer(shop, { productId, collectionIds }, now = new Date()) {
  const doc = await repo.findStorefrontTimer(shop, { productId, collectionIds }, now);
  if (!doc) return { data: null, etag: '"none"', maxAge: MAX_AGE };

  const fixed = doc.type === "fixed";
  const { backgroundColor, size, position } = doc.appearance;
  const data = {
    id: String(doc._id),
    type: doc.type,
    ...(fixed ? { endAt: doc.endAt } : { durationSeconds: doc.durationSeconds }),
    description: doc.description,
    appearance: { backgroundColor, size, position },
    urgencyEffect: doc.urgencyEffect,
    urgencyThresholdSeconds: doc.urgencyThresholdSeconds,
    serverNow: now,
  };
  // A cached fixed timer must not outlive its endAt.
  const maxAge = fixed
    ? Math.max(0, Math.min(MAX_AGE, Math.floor((doc.endAt - now) / 1000)))
    : MAX_AGE;
  return { data, etag: `"${data.id}-${new Date(doc.updatedAt).getTime()}"`, maxAge };
}
