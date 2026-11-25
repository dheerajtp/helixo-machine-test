import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, loadDbConfig } from "../src/config.js";

const valid = {
  SHOPIFY_API_KEY: "key",
  SHOPIFY_API_SECRET: "secret",
  HOST: "https://app.example.com",
  MONGO_URI: "mongodb://u:p%40ss@localhost:27017/countdown?replicaSet=rs0&authSource=admin",
  METRICS_TOKEN: "0123456789abcdef",
};

test("valid input gets defaults, is frozen and drops unknown variables", () => {
  const config = loadConfig({ ...valid, PORT: "", NODE_ENV: "", PATH: "/bin" });
  assert.equal(config.NODE_ENV, "development");
  assert.equal(config.PORT, 3000);
  assert.equal(config.SCOPES, "");
  assert.equal(config.PATH, undefined);
  assert.ok(Object.isFrozen(config));
});

test("BACKEND_PORT wins over PORT", () => {
  assert.equal(loadConfig({ ...valid, PORT: "4000", BACKEND_PORT: "5000" }).PORT, 5000);
  assert.equal(loadConfig({ ...valid, PORT: "4000" }).PORT, 4000);
});

test("each missing required value is named", () => {
  for (const name of Object.keys(valid)) {
    const source = { ...valid };
    delete source[name];
    assert.throws(() => loadConfig(source), new RegExp(`"${name}" is required`));
  }
});

test("errors name the variable and never include values", () => {
  const bad = {
    NODE_ENV: "leak-env",
    PORT: "leak-port",
    MONGO_URI: "postgres://user:leak-password@host/db",
    METRICS_TOKEN: "leak-token",
  };
  assert.throws(
    () => loadConfig({ ...valid, ...bad }),
    (error) => {
      for (const [name, value] of Object.entries(bad)) {
        assert.ok(error.message.includes(name), name);
        assert.ok(!error.message.includes(value), name);
      }
      assert.ok(!error.message.includes("leak"));
      assert.equal(error.cause, undefined);
      return true;
    }
  );
});

test("scripts need only MONGO_URI", () => {
  const { MONGO_URI } = valid;
  assert.deepEqual({ ...loadDbConfig({ MONGO_URI, PATH: "/bin" }) }, { MONGO_URI });
  assert.throws(() => loadDbConfig({}), /"MONGO_URI" is required/);
});
