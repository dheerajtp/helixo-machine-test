// Indexes for the timers collection (web/src/models/timer.js).
// Default index names, so they match what Mongoose builds in tests.
const COLLECTION = "timers";
const INDEXES = [
  { key: { shop: 1, _id: -1 }, name: "shop_1__id_-1" },
  { key: { shop: 1, sortAt: 1, _id: 1 }, name: "shop_1_sortAt_1__id_1" },
  { key: { shop: 1, enabled: 1, targetType: 1 }, name: "shop_1_enabled_1_targetType_1" },
];
const NAMESPACE_NOT_FOUND = 26;
const INDEX_NOT_FOUND = 27;

// createIndex with an identical spec is a no-op, so running up twice is safe.
export async function up(db) {
  for (const { key } of INDEXES) {
    await db.collection(COLLECTION).createIndex(key);
  }
}

export async function down(db) {
  for (const { name } of INDEXES) {
    try {
      await db.collection(COLLECTION).dropIndex(name);
    } catch (error) {
      if (![NAMESPACE_NOT_FOUND, INDEX_NOT_FOUND].includes(error?.code)) throw error;
    }
  }
}
