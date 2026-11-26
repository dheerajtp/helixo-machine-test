/* global db, require, print, action, target */
// mongosh script for restore-verify.sh. The caller defines `action` (count | drop) and `target`.
if (!/^countdown_verify_[0-9_]+$/.test(target)) throw new Error("Not a temporary database: " + target);

const env = require("fs").readFileSync("/run/config/.env", "utf8").split(/\r?\n/);
const read = (name) => {
  const line = env.filter((entry) => entry.startsWith(name + "=")).pop() || "";
  return line.slice(name.length + 1).replace(/^(["'])(.*)\1$/, "$2");
};
db.getSiblingDB("admin").auth(read("MONGO_USERNAME"), read("MONGO_PASSWORD"));

const temp = db.getSiblingDB(target);
if (action === "drop") {
  temp.dropDatabase();
} else {
  temp.getCollectionNames().forEach((name) => {
    print("COUNT " + name + " " + temp.getCollection(name).countDocuments({}));
  });
}
