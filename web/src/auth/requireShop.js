import { sendError } from "../http/responses.js";

const unauthorized = (res) =>
  sendError(res, { code: "UNAUTHORIZED", message: "Authentication required" });

// Runs before the library's validateAuthenticatedSession: a missing or invalid session token
// is a 401 envelope here. The token and the library's error (which quotes it) are never logged.
export function verifySessionToken(shopify) {
  return async (req, res, next) => {
    const token = req.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) return unauthorized(res);
    let payload;
    try {
      payload = await shopify.api.session.decodeSessionToken(token);
    } catch {
      return unauthorized(res);
    }
    const dest = typeof payload?.dest === "string" ? URL.parse(payload.dest)?.hostname : undefined;
    if (!dest) return unauthorized(res);
    res.locals.tokenShop = dest;
    next();
  };
}

// Runs after validateAuthenticatedSession: the shop comes only from the loaded session,
// and it must be the shop the verified token was issued for.
export function attachShop(req, res, next) {
  const shop = res.locals.shopify?.session?.shop;
  if (!shop || shop !== res.locals.tokenShop) return unauthorized(res);
  req.shop = shop;
  next();
}
