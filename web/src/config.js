import { fileURLToPath } from "node:url";
import Joi from "joi";

const ENV_FILE = fileURLToPath(new URL("../config/.env", import.meta.url));

// An empty `NAME=` line in the env file counts as unset.
const port = Joi.number().port().empty("");

const schema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .empty("")
    .default("development"),
  SHOPIFY_API_KEY: Joi.string().required(),
  SHOPIFY_API_SECRET: Joi.string().required(),
  HOST: Joi.string().required(),
  SCOPES: Joi.string().allow("").default(""),
  BACKEND_PORT: port,
  PORT: port.default(3000),
  MONGO_URI: Joi.string().uri({ scheme: ["mongodb"] }).required(),
  METRICS_TOKEN: Joi.string().min(16).required(),
});

export function loadEnvFile() {
  try {
    process.loadEnvFile(ENV_FILE); // variables already set win
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

// Scripts run outside `shopify app dev`, which supplies the Shopify values, so they ask only for this.
const dbSchema = Joi.object({ MONGO_URI: schema.extract("MONGO_URI") });

function validate(target, source) {
  const { value, error } = target.validate(source, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
  if (error) {
    // Only the messages: the Joi error object itself carries the input values.
    throw new Error(
      `Invalid configuration: ${error.details.map((d) => d.message).join("; ")}`
    );
  }
  return value;
}

export function loadConfig(source = process.env) {
  const value = validate(schema, source);
  return Object.freeze({ ...value, PORT: value.BACKEND_PORT ?? value.PORT });
}

export function loadDbConfig(source = process.env) {
  return Object.freeze(validate(dbSchema, source));
}
