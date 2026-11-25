import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedRedirectUrl } from "../frontend/utils/redirectUrl.js";

const APP = "app.example.com";

test("allows https to the app, Shopify admin and store domains", () => {
  for (const uri of [
    "https://app.example.com/api/auth",
    "https://admin.shopify.com/store/demo",
    "https://demo.myshopify.com/admin",
  ]) {
    assert.equal(allowedRedirectUrl(uri, APP)?.href, uri);
  }
});

test("rejects other schemes, other hosts and malformed input", () => {
  for (const uri of [
    "javascript://admin.shopify.com/%0Aalert(1)",
    "data://admin.shopify.com/x",
    "http://admin.shopify.com/",
    "https://evil.example.com/",
    "https://admin.shopify.com.evil.com/",
    "https://evilmyshopify.com/",
    "not a url",
    null,
  ]) {
    assert.equal(allowedRedirectUrl(uri, APP), null, String(uri));
  }
});
