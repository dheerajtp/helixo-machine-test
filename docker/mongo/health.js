/* global db, rs, quit, require, sleep */
// mongosh healthcheck: initiates the replica set and creates the root and app users on first run.
const env = Object.fromEntries(
  require("fs")
    .readFileSync("/run/config/.env", "utf8")
    .split(/\r?\n/)
    .map((line) => /^(MONGO_USERNAME|MONGO_PASSWORD|MONGO_APP_USERNAME|MONGO_APP_PASSWORD)=(.*)$/.exec(line))
    .filter(Boolean)
    .map(([, name, value]) => [name, value.replace(/^(["'])(.*)\1$/, "$2")])
);
const {
  MONGO_USERNAME: user,
  MONGO_PASSWORD: pwd,
  MONGO_APP_USERNAME: appUser,
  MONGO_APP_PASSWORD: appPwd,
} = env;
if (!user || !pwd || !appUser || !appPwd) {
  throw new Error(
    "MONGO_USERNAME, MONGO_PASSWORD, MONGO_APP_USERNAME and MONGO_APP_PASSWORD must be set in /run/config/.env"
  );
}
// The same name would leave the app connecting as root.
if (appUser === user) throw new Error("MONGO_APP_USERNAME must differ from MONGO_USERNAME");

const admin = db.getSiblingDB("admin");
let authenticated = false;
try {
  admin.auth(user, pwd);
  authenticated = true;
} catch {
  // No user yet (first run) or wrong password: the calls below fail in the second case.
}
if (authenticated && db.hello().isWritablePrimary && admin.getUser(appUser)) quit(0);

try {
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] });
} catch (error) {
  if (error.codeName !== "AlreadyInitialized") throw error;
}

for (let waited = 0; !db.hello().isWritablePrimary; waited += 200) {
  if (waited >= 5000) throw new Error("Replica set has no primary yet");
  sleep(200);
}

if (!authenticated) {
  admin.createUser({ user, pwd, roles: ["root"] });
  // The localhost exception ends with the first user, so log in before the next call.
  admin.auth(user, pwd);
}
// shortcut: a changed password is not applied to an existing user; use db.changeUserPassword by hand.
if (!admin.getUser(appUser)) {
  admin.createUser({ user: appUser, pwd: appPwd, roles: [{ role: "readWrite", db: "countdown" }] });
}
