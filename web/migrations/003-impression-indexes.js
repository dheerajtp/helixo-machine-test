// Indexes for impression_keys and timer_stats (web/src/models/impression.js).
// Default index names, so they match what Mongoose builds in tests.
const INDEXES = [
  {
    collection: "impression_keys",
    key: { shop: 1, timerId: 1, sessionId: 1 },
    name: "shop_1_timerId_1_sessionId_1",
    options: { unique: true },
  },
  {
    collection: "impression_keys",
    key: { createdAt: 1 },
    name: "createdAt_1",
    options: { expireAfterSeconds: 86400 },
  },
  {
    collection: "timer_stats",
    key: { shop: 1, timerId: 1, day: 1 },
    name: "shop_1_timerId_1_day_1",
    options: { unique: true },
  },
];
const NAMESPACE_NOT_FOUND = 26;
const INDEX_NOT_FOUND = 27;

// createIndex with an identical spec is a no-op, so running up twice is safe.
export async function up(db) {
  for (const { collection, key, options } of INDEXES) {
    await db.collection(collection).createIndex(key, options);
  }
}

// Drops the indexes only; the data stays.
export async function down(db) {
  for (const { collection, name } of INDEXES) {
    try {
      await db.collection(collection).dropIndex(name);
    } catch (error) {
      if (![NAMESPACE_NOT_FOUND, INDEX_NOT_FOUND].includes(error?.code)) throw error;
    }
  }
}
