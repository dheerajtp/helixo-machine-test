import { sendError } from "../http/responses.js";

const SHOP = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

// Shopify app proxy signature (shared secret, 90 s timestamp window, checked by the library).
// Any failure, including a malformed query the library throws on, is a 401. The query and
// signature are never logged.
export function verifyProxySignature(shopify) {
  return async (req, res, next) => {
    let valid;
    try {
      valid = await shopify.api.utils.validateHmac({ ...req.query }, { signator: "appProxy" });
    } catch {
      valid = false;
    }
    const shop = req.query.shop;
    if (valid !== true || typeof shop !== "string" || !SHOP.test(shop)) {
      return sendError(res, { code: "UNAUTHORIZED", message: "Invalid proxy signature" });
    }
    req.shop = shop;
    next();
  };
}
