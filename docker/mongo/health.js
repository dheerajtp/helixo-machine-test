/* global db, rs, quit, require, sleep */
// mongosh healthcheck: initiates the replica set and creates the root user on first run.
const env = Object.fromEntries(
  require("fs")
    .readFileSync("/run/config/.env", "utf8")
    .split(/\r?\n/)
    .map((line) => /^(MONGO_USERNAME|MONGO_PASSWORD)=(.*)$/.exec(line))
    .filter(Boolean)
    .map(([, name, value]) => [name, value.replace(/^(["'])(.*)\1$/, "$2")])
);
const { MONGO_USERNAME: user, MONGO_PASSWORD: pwd } = env;
if (!user || !pwd) {
  throw new Error("MONGO_USERNAME and MONGO_PASSWORD must be set in /run/config/.env");
}

const admin = db.getSiblingDB("admin");
let authenticated = false;
try {
  admin.auth(user, pwd);
  authenticated = true;
} catch {
  // No user yet (first run) or wrong password: the calls below fail in the second case.
}
if (authenticated && db.hello().isWritablePrimary) quit(0);

try {
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] });
} catch (error) {
  if (error.codeName !== "AlreadyInitialized") throw error;
}

for (let waited = 0; !db.hello().isWritablePrimary; waited += 200) {
  if (waited >= 5000) throw new Error("Replica set has no primary yet");
  sleep(200);
}

if (!authenticated) admin.createUser({ user, pwd, roles: ["root"] });
