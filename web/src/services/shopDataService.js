import { deleteSessionsByShop } from "../repositories/sessionRepository.js";

// Deletes every record of the shop; safe to run twice.
// Later plans that store shop data add their repository's delete here.
export async function redactShop(shop) {
  await deleteSessionsByShop(shop);
}
