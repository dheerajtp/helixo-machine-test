// "Show on" selection logic. No React here, so it runs under node --test.
import { TARGETS_MAX } from "./timerForm.js";

export const TARGET_KINDS = {
  products: { type: "product", idsKey: "productIds", noun: "Product" },
  collections: { type: "collection", idsKey: "collectionIds", noun: "Collection" },
};

// Switching between products and collections drops the other kind's selection.
export function targetTypeChanges(targetType) {
  if (targetType === "products") return { targetType, collectionIds: [] };
  if (targetType === "collections") return { targetType, productIds: [] };
  return { targetType };
}

export const pickerOptions = (targetType, ids) => ({
  type: TARGET_KINDS[targetType].type,
  action: "select",
  multiple: TARGETS_MAX,
  selectionIds: ids.map((id) => ({ id })),
  // Targeting is per product, so variants are not offered.
  ...(targetType === "products" && { filter: { variants: false } }),
});

// The picker resolves to undefined on cancel: null then, so the caller keeps its selection.
export function readSelection(selected) {
  if (!selected) return null;
  return {
    ids: selected.map(({ id }) => id),
    titles: Object.fromEntries(selected.map(({ id, title }) => [id, title])),
  };
}

// Only IDs are stored, so a saved target is named by its number.
export const targetTitle = (targetType, id, titles) =>
  titles[id] || `${TARGET_KINDS[targetType].noun} ${id.split("/").pop()}`;
