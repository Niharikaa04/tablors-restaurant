import "server-only";

export async function getOffersPageNow(): Promise<number> {
  return Date.now();
}
