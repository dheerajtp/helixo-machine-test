import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/check-size.js", import.meta.url));

test("the size check fails only above 30 KB gzipped, script and CSS together", () => {
  const dir = mkdtempSync(join(tmpdir(), "widget-size-"));
  // Random bytes do not compress, so the gzipped size is about the raw size.
  const run = (js, css) => {
    writeFileSync(join(dir, "countdown-timer.js"), randomBytes(js * 1024));
    writeFileSync(join(dir, "countdown-timer.css"), randomBytes(css * 1024));
    return spawnSync(process.execPath, [script, dir]).status;
  };
  try {
    assert.equal(run(20, 9), 0);
    assert.equal(run(20, 11), 1);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
