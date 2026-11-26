import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const LIMIT = 30 * 1024;
const TARGET = 15 * 1024;

// The directory argument exists for the test.
const dir =
  process.argv[2] ??
  fileURLToPath(new URL("../../extensions/countdown-timer/assets/", import.meta.url));

const total = ["countdown-timer.js", "countdown-timer.css"].reduce(
  (sum, file) => sum + gzipSync(readFileSync(join(dir, file))).length,
  0
);
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;
const summary = `Widget size (script + CSS, gzipped): ${kb(total)} (target ${kb(TARGET)}, limit ${kb(LIMIT)})`;

if (total > LIMIT) {
  process.stderr.write(`${summary}\nOver the limit.\n`);
  process.exit(1);
}
process.stdout.write(`${summary}${total > TARGET ? "\nAbove the target." : ""}\n`);
