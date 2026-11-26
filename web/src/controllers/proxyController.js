import { sendSuccess } from "../http/responses.js";
import * as service from "../services/storefrontService.js";

// Express answers 304 itself when If-None-Match matches the ETag set here.
export async function getTimer(req, res) {
  const { data, etag, maxAge } = await service.getStorefrontTimer(req.shop, req.validated.query);
  res.set({ "Cache-Control": `public, max-age=${maxAge}`, ETag: etag });
  sendSuccess(res, { message: data ? "Timer" : "No active timer", data });
}
