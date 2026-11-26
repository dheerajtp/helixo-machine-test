// The only place that calls the backend. No React here, so it runs under node --test.
const REAUTHORIZE_HEADER = "X-Shopify-API-Request-Failure-Reauthorize-Url";

export class ApiError extends Error {
  // status is 0 when no response arrived.
  constructor({ status = 0, code, message, details = [], cause }) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Empty values are left out: the API rejects "cursor=" and similar.
function withQuery(path, query = {}) {
  const params = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ).toString();
  return params ? `${path}?${params}` : path;
}

// The globals are looked up per call: App Bridge provides shopify and wraps fetch.
export function createClient({
  fetch = (...args) => globalThis.fetch(...args),
  getToken = () => globalThis.shopify.idToken(),
  redirect = (url) => globalThis.open(url, "_top"),
} = {}) {
  // An aborted request rejects with the platform's AbortError, not ApiError.
  return async function request(path, { method = "GET", query, body, signal } = {}) {
    let response;
    try {
      const headers = { Authorization: `Bearer ${await getToken()}` };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      response = await fetch(withQuery(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new ApiError({
        code: "NETWORK_ERROR",
        message: "Could not reach the server",
        cause: error,
      });
    }

    const { status } = response;
    const reauthorizeUrl = status === 403 && response.headers.get(REAUTHORIZE_HEADER);
    if (reauthorizeUrl) {
      redirect(reauthorizeUrl);
      throw new ApiError({ status, code: "REAUTHORIZE", message: "Reauthorizing the app" });
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (error.name === "AbortError") throw error;
    }
    if (response.ok && payload?.success === true) {
      return { data: payload.data, meta: payload.meta };
    }
    if (payload?.error?.code) {
      throw new ApiError({
        status,
        code: payload.error.code,
        message: payload.message,
        details: payload.error.details,
      });
    }
    throw new ApiError({
      status,
      code: "INVALID_RESPONSE",
      message: "Unexpected response from the server",
    });
  };
}
