// App-data metafield (owner: this app installation) that the theme block reads as
// app.metafields.countdown.targets. Needs no extra access scope.
const INSTALLATION = `{ currentAppInstallation { id } }`;
const SET = `mutation SetTargets($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) { userErrors { code } }
}`;

class UserErrors extends Error {}

export async function createAdminClient(session) {
  // Imported late: shopify.js reads the environment at import.
  const { default: shopify } = await import("../../shopify.js");
  return new shopify.api.clients.Graphql({ session });
}

// One attempt; the signal bounds both requests together.
export async function writeTargets(client, value, signal) {
  const { data } = await client.request(INSTALLATION, { signal });
  const metafield = {
    ownerId: data.currentAppInstallation.id,
    namespace: "countdown",
    key: "targets",
    type: "json",
    value: JSON.stringify(value),
  };
  const result = await client.request(SET, { variables: { metafields: [metafield] }, signal });
  if (result.data.metafieldsSet.userErrors.length > 0) {
    throw new UserErrors("metafieldsSet was refused");
  }
}
