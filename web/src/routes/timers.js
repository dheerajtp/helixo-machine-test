import { Router } from "express";
import * as controller from "../controllers/timerController.js";
import { asyncHandler } from "../http/asyncHandler.js";
import { validate } from "../http/validate.js";
import { createBody, idParams, listQuery, patchBody } from "../validators/timerRequests.js";

// Mounted behind the /api session check and rate limit, which set req.shop.
export function createTimersRouter() {
  const router = Router();
  router.get("/", validate({ query: listQuery }), asyncHandler(controller.list));
  router.post("/", validate({ body: createBody }), asyncHandler(controller.create));
  router.get("/:id", validate({ params: idParams }), asyncHandler(controller.get));
  router.patch(
    "/:id",
    validate({ params: idParams, body: patchBody }),
    asyncHandler(controller.update)
  );
  router.delete("/:id", validate({ params: idParams }), asyncHandler(controller.remove));
  return router;
}
