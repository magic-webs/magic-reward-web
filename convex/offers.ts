import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

function toOffer(doc: Doc<"offers">) {
  return {
    id: doc._id,
    companyId: doc.companyId,
    title: doc.title,
    type: doc.type,
    event: doc.event ?? "none",
    isActive: doc.isActive,
    askName: doc.askName,
    askPhone: doc.askPhone,
    createdAt: doc.createdAt,
    fomoConfig: doc.fomoConfig,
    embedConfig: doc.embedConfig,
  };
}

// The full offer as both the admin dashboard and the public game page need
// it: prizes and questions in display order, with every image URL already
// resolved. Instant expressed this as a nested query over links; here it is
// three index reads plus storage lookups.
async function offerDetails(ctx: QueryCtx, offerId: Id<"offers">) {
  const offer = await ctx.db.get(offerId);
  if (!offer) return null;

  const [prizes, formFields] = await Promise.all([
    ctx.db
      .query("prizes")
      .withIndex("by_offer", (q) => q.eq("offerId", offerId))
      .collect(),
    ctx.db
      .query("formFields")
      .withIndex("by_offer", (q) => q.eq("offerId", offerId))
      .collect(),
  ]);

  const resolvedPrizes = await Promise.all(
    prizes
      .sort((a, b) => a.order - b.order)
      .map(async (p) => ({
        id: p._id,
        label: p.label,
        weight: p.weight,
        color: p.color ?? null,
        order: p.order,
        isWin: p.isWin,
        iconUrl: p.iconId ? await ctx.storage.getUrl(p.iconId) : null,
      })),
  );

  return {
    ...toOffer(offer),
    wheelImageUrl: offer.wheelImageId ? await ctx.storage.getUrl(offer.wheelImageId) : null,
    bgImageUrl: offer.bgImageId ? await ctx.storage.getUrl(offer.bgImageId) : null,
    pinImageUrl: offer.pinImageId ? await ctx.storage.getUrl(offer.pinImageId) : null,
    prizes: resolvedPrizes,
    fields: formFields
      .sort((a, b) => a.order - b.order)
      .map((f) => ({
        id: f._id,
        key: f.key,
        label: f.label,
        required: f.required,
        type: f.type ?? null,
        options: f.options ?? [],
        order: f.order,
      })),
  };
}

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const offers = await ctx.db
      .query("offers")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    return offers.sort((a, b) => b.createdAt - a.createdAt).map(toOffer);
  },
});

export const getWithDetails = query({
  args: { offerId: v.id("offers") },
  handler: async (ctx, { offerId }) => offerDetails(ctx, offerId),
});

// What the public game page renders. With an explicit offerId it resolves
// that offer whether or not it is paused; without one it falls back to the
// company's newest *active* offer. Both behaviours are carried over
// deliberately — see the note in the app's overview screen.
export const publicConfig = query({
  args: { companyId: v.id("companies"), offerId: v.optional(v.id("offers")) },
  handler: async (ctx, { companyId, offerId }) => {
    let resolvedId = offerId ?? null;

    if (resolvedId) {
      const offer = await ctx.db.get(resolvedId);
      // An id from another company must not resolve, or one merchant's
      // link would open another's game.
      if (!offer || offer.companyId !== companyId) return null;
    } else {
      const active = await ctx.db
        .query("offers")
        .withIndex("by_company_active", (q) => q.eq("companyId", companyId).eq("isActive", true))
        .collect();
      const newest = active.sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!newest) return null;
      resolvedId = newest._id;
    }

    const details = await offerDetails(ctx, resolvedId);
    if (!details) return null;

    return {
      title: details.title,
      askName: details.askName,
      askPhone: details.askPhone,
      gameType: details.type || "wheel",
      event: details.event,
      wheelImageUrl: details.wheelImageUrl,
      bgImageUrl: details.bgImageUrl,
      pinImageUrl: details.pinImageUrl,
      prizes: details.prizes,
      fields: details.fields,
      offerId: details.id,
    };
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    title: v.string(),
    type: v.string(),
    event: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, title, type, event }) => {
    const createdAt = Date.now();
    const offerId = await ctx.db.insert("offers", {
      companyId,
      title,
      type,
      event: event ?? "none",
      // Inactive on creation: the merchant activates it once prizes and
      // questions are set up. Matches the behaviour of the route this
      // replaced — an offer must never go live half-configured.
      isActive: false,
      askName: true,
      askPhone: true,
      createdAt,
    });
    const doc = await ctx.db.get(offerId);
    return doc ? toOffer(doc) : null;
  },
});

export const update = mutation({
  args: {
    offerId: v.id("offers"),
    title: v.optional(v.string()),
    type: v.optional(v.string()),
    event: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    askName: v.optional(v.boolean()),
    askPhone: v.optional(v.boolean()),
    fomoConfig: v.optional(v.any()),
    embedConfig: v.optional(v.any()),
  },
  handler: async (ctx, { offerId, ...patch }) => {
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(defined).length > 0) await ctx.db.patch(offerId, defined);
    return null;
  },
});

// Instant cascaded these deletes through its links; Convex has no cascade,
// so everything hanging off the offer is removed here explicitly. Spins are
// deliberately kept — they are the merchant's registration history and must
// outlive the game that collected them, so they are only unlinked.
export const remove = mutation({
  args: { offerId: v.id("offers") },
  handler: async (ctx, { offerId }) => {
    const offer = await ctx.db.get(offerId);
    if (!offer) return null;

    const [prizes, formFields, webhooks, spins] = await Promise.all([
      ctx.db.query("prizes").withIndex("by_offer", (q) => q.eq("offerId", offerId)).collect(),
      ctx.db.query("formFields").withIndex("by_offer", (q) => q.eq("offerId", offerId)).collect(),
      ctx.db.query("webhooks").withIndex("by_offer", (q) => q.eq("offerId", offerId)).collect(),
      ctx.db.query("spins").withIndex("by_offer", (q) => q.eq("offerId", offerId)).collect(),
    ]);

    for (const p of prizes) {
      if (p.iconId) await ctx.storage.delete(p.iconId);
      await ctx.db.delete(p._id);
    }
    for (const f of formFields) await ctx.db.delete(f._id);
    for (const w of webhooks) await ctx.db.delete(w._id);
    for (const s of spins) await ctx.db.patch(s._id, { offerId: undefined });

    for (const storageId of [offer.wheelImageId, offer.bgImageId, offer.pinImageId]) {
      if (storageId) await ctx.storage.delete(storageId);
    }

    await ctx.db.delete(offerId);
    return null;
  },
});

export const setImage = mutation({
  args: {
    offerId: v.id("offers"),
    kind: v.union(v.literal("wheel"), v.literal("bg"), v.literal("pin")),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { offerId, kind, storageId }) => {
    const field = ({ wheel: "wheelImageId", bg: "bgImageId", pin: "pinImageId" } as const)[kind];
    const offer = await ctx.db.get(offerId);
    if (!offer) return null;

    const previous = offer[field];
    await ctx.db.patch(offerId, { [field]: storageId });
    if (previous && previous !== storageId) await ctx.storage.delete(previous);

    return { url: await ctx.storage.getUrl(storageId) };
  },
});

// Just the two JSON config blobs plus enough identity for the FOMO and
// embed endpoints, so they do not pull prizes, questions and three image
// URLs they never look at.
export const getConfigs = query({
  args: { offerId: v.id("offers") },
  handler: async (ctx, { offerId }) => {
    const offer = await ctx.db.get(offerId);
    if (!offer) return null;
    return {
      fomo: offer.fomoConfig ?? null,
      embed: offer.embedConfig ?? null,
      title: offer.title,
      companyId: offer.companyId,
      isActive: offer.isActive,
    };
  },
});
