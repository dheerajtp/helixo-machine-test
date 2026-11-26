import { sendSuccess } from "../http/responses.js";
import * as impressions from "../services/impressionService.js";
import * as service from "../services/storefrontService.js";

// Express answers 304 itself when If-None-Match matches the ETag set here.
export async function getTimer(req, res) {
  const { data, etag, maxAge } = await service.getStorefrontTimer(req.shop, req.validated.query);
  res.set({ "Cache-Control": `public, max-age=${maxAge}`, ETag: etag });
  sendSuccess(res, { message: data ? "Timer" : "No active timer", data });
}

// 202 whether new or repeated, so a client cannot tell which.
export async function recordImpression(req, res) {
  await impressions.recordImpression(req.shop, req.validated.body);
  sendSuccess(res, { status: 202, message: "Impression accepted" });
}
