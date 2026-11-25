// Indexes for the shopify_sessions collection (web/src/repositories/sessionRepository.js).
// Default index names, so they match what Mongoose builds in tests.
const COLLECTION = "shopify_sessions";
const INDEXES = [
  { key: { id: 1 }, options: { unique: true }, name: "id_1" },
  { key: { shop: 1, id: 1 }, options: {}, name: "shop_1_id_1" },
];
const NAMESPACE_NOT_FOUND = 26;
const INDEX_NOT_FOUND = 27;

// createIndex with an identical spec is a no-op, so running up twice is safe.
export async function up(db) {
  for (const { key, options } of INDEXES) {
    await db.collection(COLLECTION).createIndex(key, options);
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
