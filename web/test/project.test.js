import { test } from "node:test";
import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test(".nvmrc and every engines.node agree on Node 26", () => {
  assert.equal(read(".nvmrc").trim(), "26");

  // The root package.json plus every workspace it declares.
  const { workspaces } = JSON.parse(read("package.json"));
  const manifests = globSync(
    ["package.json", ...workspaces.map((w) => `${w}/package.json`)],
    { cwd: root.pathname }
  );
  assert.ok(manifests.length >= 3, `found only ${manifests}`);

  for (const manifest of manifests) {
    assert.equal(JSON.parse(read(manifest)).engines?.node, ">=26 <27", manifest);
  }
});
