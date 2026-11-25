import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const SCRIPT = readFileSync(new URL("../../docker/mongo/health.js", import.meta.url), "utf8");
const ENV = "MONGO_USERNAME=admin\r\nMONGO_PASSWORD='p=ss word'\n";

// Runs the mongosh script against a stub server and returns the calls it made.
function run({ envFile = ENV, hasUser, initiated }) {
  const calls = [];
  const server = { initiated };
  const admin = {
    auth(user, pwd) {
      assert.deepEqual([user, pwd], ["admin", "p=ss word"]);
      if (!hasUser) throw new Error("Authentication failed");
    },
    createUser: ({ roles }) => calls.push(`createUser:${roles}`),
  };
  const quit = Symbol("quit");
  try {
    runInNewContext(SCRIPT, {
      require: () => ({ readFileSync: () => envFile }),
      db: {
        getSiblingDB: () => admin,
        hello: () => ({ isWritablePrimary: server.initiated }),
      },
      rs: {
        initiate() {
          calls.push("initiate");
          if (server.initiated) {
            throw Object.assign(new Error("again"), { codeName: "AlreadyInitialized" });
          }
          server.initiated = true;
        },
      },
      quit: () => {
        throw quit;
      },
      sleep: () => {},
    });
  } catch (error) {
    if (error !== quit) throw error;
  }
  return calls;
}

test("first run initiates the replica set and creates the root user", () => {
  assert.deepEqual(run({ hasUser: false, initiated: false }), ["initiate", "createUser:root"]);
});

test("healthy server is left alone", () => {
  assert.deepEqual(run({ hasUser: true, initiated: true }), []);
});

test("initiated without a user still creates it", () => {
  assert.deepEqual(run({ hasUser: false, initiated: true }), ["initiate", "createUser:root"]);
});

test("missing credentials throw", () => {
  assert.throws(() => run({ envFile: "MONGO_USERNAME=admin\n" }), /must be set/);
});
