import Joi from "joi";

const MAX_COLLECTIONS = 50;

// Parameters Shopify appends (shop, timestamp, signature, path_prefix, logged_in_customer_id)
// are not listed, so the shared validator strips them.
export const timerQuery = Joi.object({
  productId: Joi.string()
    .pattern(/^\d{1,20}$/)
    .required()
    .custom((id) => `gid://shopify/Product/${id}`),
  collectionIds: Joi.string()
    .max(MAX_COLLECTIONS * 21)
    .pattern(/^\d{1,20}(,\d{1,20})*$/)
    .custom((value, helpers) => {
      const ids = [...new Set(value.split(","))];
      if (ids.length > MAX_COLLECTIONS) {
        return helpers.message(`"collectionIds" must have at most ${MAX_COLLECTIONS} ids`);
      }
      return ids.map((id) => `gid://shopify/Collection/${id}`);
    }),
});

// The beacon body (plan 09 I6). sessionId is a random id the widget makes, not personal data.
export const impressionBody = Joi.object({
  timerId: Joi.string().hex().length(24).lowercase().required(),
  sessionId: Joi.string().guid().lowercase().required(),
}).required();
