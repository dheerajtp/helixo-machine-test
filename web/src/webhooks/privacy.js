import { DeliveryMethod } from "@shopify/shopify-api";
import Joi from "joi";

import { redactShop } from "../services/shopDataService.js";

const shopRedactSchema = Joi.object({
  shop_domain: Joi.string()
    .max(255)
    .pattern(/\.myshopify\.com$/)
    .required(),
})
  .unknown(true)
  .required();

const parseJson = (body) => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

const handler = (callback) => ({
  deliveryMethod: DeliveryMethod.Http,
  callbackUrl: "/api/webhooks",
  callback,
});

// No customer data is stored, so there is nothing to export or erase.
const acknowledge = async () => {};

export function privacyWebhookHandlers(logger) {
  return {
    CUSTOMERS_DATA_REQUEST: handler(acknowledge),
    CUSTOMERS_REDACT: handler(acknowledge),
    // The shop comes from the signed body: the shop header (2nd argument) is not covered by the HMAC.
    SHOP_REDACT: handler(async (_topic, _shop, body, webhookId) => {
      const { value, error } = shopRedactSchema.validate(parseJson(body), {
        abortEarly: false,
        convert: true,
      });
      if (error) {
        // Acknowledged: a retry would send the same body. Never log it.
        logger.warn({ webhookId }, "Invalid shop/redact payload ignored");
        return;
      }
      // A database failure throws, so Shopify gets a 500 and retries.
      await redactShop(value.shop_domain);
    }),
  };
}
