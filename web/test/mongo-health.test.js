import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const SCRIPT = readFileSync(new URL("../../docker/mongo/health.js", import.meta.url), "utf8");
const ENV =
  "MONGO_USERNAME=admin\r\nMONGO_PASSWORD='p=ss word'\nMONGO_APP_USERNAME=app\nMONGO_APP_PASSWORD=apw\n";

// Runs the mongosh script against a stub server and returns the calls it made.
function run({ envFile = ENV, hasUser, hasApp = false, initiated }) {
  const calls = [];
  const server = { initiated };
  const admin = {
    auth(user, pwd) {
      assert.deepEqual([user, pwd], ["admin", "p=ss word"]);
      if (!hasUser) throw new Error("Authentication failed");
    },
    getUser: (name) => (name === "app" && hasApp ? { user: name } : null),
    createUser({ user, roles }) {
      if (user === "admin") hasUser = true;
      calls.push(`createUser:${user}:${JSON.stringify(roles)}`);
    },
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

const ROOT = 'createUser:admin:["root"]';
const APP = 'createUser:app:[{"role":"readWrite","db":"countdown"}]';

test("first run initiates the replica set and creates the root and app users", () => {
  assert.deepEqual(run({ hasUser: false, initiated: false }), ["initiate", ROOT, APP]);
});

test("healthy server is left alone", () => {
  assert.deepEqual(run({ hasUser: true, hasApp: true, initiated: true }), []);
});

test("initiated without a user still creates both", () => {
  assert.deepEqual(run({ hasUser: false, initiated: true }), ["initiate", ROOT, APP]);
});

test("an existing database gets only the missing app user", () => {
  assert.deepEqual(run({ hasUser: true, initiated: true }), ["initiate", APP]);
});

test("missing or shared credentials throw", () => {
  assert.throws(() => run({ envFile: "MONGO_USERNAME=admin\n" }), /must be set/);
  assert.throws(
    () => run({ envFile: ENV.replace("APP_USERNAME=app", "APP_USERNAME=admin") }),
    /must differ/
  );
});
