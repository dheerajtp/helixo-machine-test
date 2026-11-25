import { randomUUID } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestId(req, res, next) {
  const incoming = req.get("X-Request-Id");
  req.id = incoming && UUID.test(incoming) ? incoming : randomUUID();
  res.set("X-Request-Id", req.id);
  next();
}
