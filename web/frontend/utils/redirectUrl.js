// Returns the URL to redirect to, or null when the target is not allowed.
export function allowedRedirectUrl(redirectUri, appHostname) {
  let url;
  try {
    url = new URL(redirectUri);
  } catch {
    return null;
  }
  // Checking the host alone lets javascript://admin.shopify.com/... through.
  const allowed =
    url.protocol === "https:" &&
    ([appHostname, "admin.shopify.com"].includes(url.hostname) ||
      url.hostname.endsWith(".myshopify.com"));
  return allowed ? url : null;
}
