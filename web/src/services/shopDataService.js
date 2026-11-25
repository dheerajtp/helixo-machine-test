import { deleteSessionsByShop } from "../repositories/sessionRepository.js";
import { deleteTimersByShop } from "../repositories/timerRepository.js";

// Deletes every record of the shop; safe to run twice.
// Later plans that store shop data add their repository's delete here.
export async function redactShop(shop) {
  await deleteTimersByShop(shop);
  await deleteSessionsByShop(shop);
}
