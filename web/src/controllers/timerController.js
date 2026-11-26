import { sendSuccess } from "../http/responses.js";
import { createAdminClient } from "../integrations/targetsMetafield.js";
import { syncTargets } from "../services/targetSyncService.js";
import * as service from "../services/timerService.js";

// app.locals.adminClient and app.locals.logger replace the real ones in tests.
const sync = (req, res) =>
  syncTargets(req.shop, {
    getClient: () => (req.app.locals.adminClient ?? createAdminClient)(res.locals.shopify.session),
    requestId: req.id,
    logger: req.app.locals.logger,
  });

export async function list(req, res) {
  const { timers, limit, nextCursor } = await service.listTimers(req.shop, req.validated.query);
  sendSuccess(res, { message: "Timers", data: timers, pagination: { limit, nextCursor } });
}

export async function create(req, res) {
  const timer = await service.createTimer(req.shop, req.validated.body);
  await sync(req, res);
  sendSuccess(res, { status: 201, message: "Timer created", data: timer });
}

export async function get(req, res) {
  const timer = await service.getTimer(req.shop, req.validated.params.id);
  sendSuccess(res, { message: "Timer", data: timer });
}

export async function update(req, res) {
  const { params, body } = req.validated;
  const timer = await service.updateTimer(req.shop, params.id, body);
  await sync(req, res);
  sendSuccess(res, { message: "Timer updated", data: timer });
}

export async function remove(req, res) {
  await service.deleteTimer(req.shop, req.validated.params.id);
  await sync(req, res);
  sendSuccess(res, { message: "Timer deleted" });
}
