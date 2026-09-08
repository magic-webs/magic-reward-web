import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const prizeInput = v.object({
  // Present for a row being kept/edited, absent for a new one.
  id: v.optional(v.id("prizes")),
  label: v.string(),
  weight: v.number(),
  isWin: v.boolean(),
  color: v.optional(v.string()),
});

export const listByOffer = query({
  args: { offerId: v.id("offers") },
  handler: async (ctx, { offerId }) => {
    const prizes = await ctx.db
      .query("prizes")
      .withIndex("by_offer", (q) => q.eq("offerId", offerId))
      .collect();
    return prizes.sort((a, b) => a.order - b.order);
  },
});

// Replaces the whole list in one transaction: rows matched by id are
// updated, rows without an id are created, and any existing row missing
// from the submitted array is deleted. `order` comes from array position.
// Validation stays in the route handler, which owns the error copy.
async function replaceAll(
  ctx: MutationCtx,
  scope: { companyId: Id<"companies">; offerId?: Id<"offers"> },
  prizes: Array<{
    id?: Id<"prizes">;
    label: string;
    weight: number;
    isWin: boolean;
    color?: string;
  }>,
) {
  const offerId = scope.offerId;
  const existing = offerId
    ? await ctx.db
        .query("prizes")
        .withIndex("by_offer", (q) => q.eq("offerId", offerId))
        .collect()
    : await ctx.db
        .query("prizes")
        .withIndex("by_company", (q) => q.eq("companyId", scope.companyId))
        .collect();

  const kept = new Set(prizes.map((p) => p.id).filter(Boolean));

  for (const row of existing) {
    if (kept.has(row._id)) continue;
    // The icon belongs to the prize, so it goes with it.
    if (row.iconId) await ctx.storage.delete(row.iconId);
    await ctx.db.delete(row._id);
  }

  for (const [order, p] of prizes.entries()) {
    if (p.id) {
      await ctx.db.patch(p.id, {
        label: p.label,
        weight: p.weight,
        isWin: p.isWin,
        color: p.color,
        order,
      });
      continue;
    }
    await ctx.db.insert("prizes", {
      companyId: scope.companyId,
      offerId: scope.offerId,
      label: p.label,
      weight: p.weight,
      isWin: p.isWin,
      color: p.color,
      order,
      createdAt: Date.now(),
    });
  }
}

export const replaceForOffer = mutation({
  args: {
    offerId: v.id("offers"),
    companyId: v.id("companies"),
    prizes: v.array(prizeInput),
  },
  handler: async (ctx, { offerId, companyId, prizes }) => {
    await replaceAll(ctx, { companyId, offerId }, prizes);
    return null;
  },
});

// The pre-offer company-level wheel. Still writable so an existing legacy
// company can be edited, but new prizes belong to an offer.
export const replaceForCompany = mutation({
  args: { companyId: v.id("companies"), prizes: v.array(prizeInput) },
  handler: async (ctx, { companyId, prizes }) => {
    await replaceAll(ctx, { companyId }, prizes);
    return null;
  },
});

export const setIcon = mutation({
  args: { prizeId: v.id("prizes"), storageId: v.id("_storage") },
  handler: async (ctx, { prizeId, storageId }) => {
    const prize = await ctx.db.get(prizeId);
    if (!prize) return null;

    const previous = prize.iconId;
    await ctx.db.patch(prizeId, { iconId: storageId });
    if (previous && previous !== storageId) await ctx.storage.delete(previous);

    return { url: await ctx.storage.getUrl(storageId) };
  },
});

// Light lookup for the icon-upload route, which only needs to know which
// company owns the prize in order to authorize the request.
export const get = query({
  args: { prizeId: v.id("prizes") },
  handler: async (ctx, { prizeId }) => {
    const doc = await ctx.db.get(prizeId);
    if (!doc) return null;
    return { id: doc._id, companyId: doc.companyId, offerId: doc.offerId ?? null, label: doc.label };
  },
});
