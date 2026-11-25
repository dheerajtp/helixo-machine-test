import pino from "pino";

const SECRET_KEYS = [
  "authorization",
  "Authorization",
  "cookie",
  "set-cookie",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "id_token",
  "secret",
  "clientSecret",
  "apiKey",
  "apikey",
  "api_key",
  "x-api-key",
  "x-shopify-access-token",
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "METRICS_TOKEN",
  "MONGO_PASSWORD",
  "MONGO_URI",
];

// shortcut: exact key names down to three levels of nesting; add paths if something deeper is ever logged.
const paths = SECRET_KEYS.flatMap((key) =>
  ["", "*", "*.*", "*.*.*"].map((prefix) => `${prefix}["${key}"]`)
);

export function createLogger(destination) {
  return pino({ redact: paths }, destination);
}

export function requestLogger(logger) {
  return (req, res, next) => {
    const start = performance.now();
    // "close" also fires when the client aborts.
    res.once("close", () => {
      logger.info(
        {
          requestId: req.id,
          method: req.method,
          path: req.originalUrl.split("?")[0],
          status: res.statusCode,
          durationMs: Math.round(performance.now() - start),
        },
        "Request completed"
      );
    });
    next();
  };
}
