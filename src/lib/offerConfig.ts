import { api, convex, asOfferId } from "@/lib/convex";

// Small focused read of just the two JSON config blobs on an offer, so the
// FOMO and embed endpoints do not have to pull prizes, form fields and
// three image URLs they never look at.
export async function getOfferConfigs(offerId: string): Promise<{
  fomo: unknown;
  embed: unknown;
  title: string | null;
  companyId: string | null;
  isActive: boolean;
}> {
  const offer = await convex.query(api.offers.getConfigs, { offerId: asOfferId(offerId) });
  if (!offer) {
    return { fomo: null, embed: null, title: null, companyId: null, isActive: false };
  }
  return {
    fomo: offer.fomo,
    embed: offer.embed,
    title: offer.title,
    companyId: offer.companyId,
    isActive: offer.isActive,
  };
}
