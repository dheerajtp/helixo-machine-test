import { test } from "node:test";
import assert from "node:assert/strict";
import { pickerOptions, readSelection, targetTitle, targetTypeChanges } from "../frontend/utils/targets.js";
import { clearErrors, emptyForm, targetIdsOf, validateForm } from "../frontend/utils/timerForm.js";

const product = "gid://shopify/Product/1";
const collection = "gid://shopify/Collection/2";

test("switching between products and collections clears the selection", () => {
  let form = { ...emptyForm(), targetType: "products", productIds: [product] };
  const choose = (targetType) => (form = { ...form, ...targetTypeChanges(targetType) });

  assert.deepEqual(targetIdsOf(choose("collections")), []);
  assert.deepEqual(targetIdsOf(choose("products")), []);
  form.productIds = [product];
  // A detour through "All products" is not a switch of kind.
  choose("all");
  assert.deepEqual(targetIdsOf(choose("products")), [product]);
});

test("at least one item is required and picking clears that error", () => {
  for (const targetType of ["products", "collections"]) {
    assert.ok(validateForm({ ...emptyForm(), targetType }).targetIds);
  }
  assert.deepEqual(clearErrors({ targetIds: "x" }, { productIds: [product] }), {});
  assert.deepEqual(clearErrors({ targetIds: "x" }, { collectionIds: [collection] }), {});
});

test("picker options preselect the current IDs, up to 100", () => {
  assert.deepEqual(pickerOptions("products", [product]), {
    type: "product",
    action: "select",
    multiple: 100,
    selectionIds: [{ id: product }],
    filter: { variants: false },
  });
  assert.deepEqual(pickerOptions("collections", []), {
    type: "collection",
    action: "select",
    multiple: 100,
    selectionIds: [],
  });
});

test("cancel is told apart from an emptied selection", () => {
  assert.equal(readSelection(undefined), null);
  assert.deepEqual(readSelection([]), { ids: [], titles: {} });
  assert.deepEqual(readSelection([{ id: product, title: "Snowboard", handle: "x" }]), {
    ids: [product],
    titles: { [product]: "Snowboard" },
  });
});

test("an unknown title falls back to the resource number", () => {
  assert.equal(targetTitle("products", product, { [product]: "Snowboard" }), "Snowboard");
  assert.equal(targetTitle("products", product, {}), "Product 1");
  assert.equal(targetTitle("collections", collection, {}), "Collection 2");
});
