import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

function toWebhook(doc: Doc<"webhooks">) {
  return {
    id: doc._id,
    companyId: doc.companyId,
    offerId: doc.offerId,
    url: doc.url,
    secret: doc.secret,
    events: doc.events,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    lastStatus: doc.lastStatus ?? null,
    lastError: doc.lastError ?? null,
    lastAttemptAt: doc.lastAttemptAt ?? null,
  };
}

// Endpoints are per-offer now, so this is the list the dashboard edits.
export const listByOffer = query({
  args: { offerId: v.id("offers") },
  handler: async (ctx, { offerId }) => {
    const rows = await ctx.db
      .query("webhooks")
      .withIndex("by_offer", (q) => q.eq("offerId", offerId))
      .collect();
    return rows.sort((a, b) => a.createdAt - b.createdAt).map(toWebhook);
  },
});

// Every endpoint a company owns, across its offers — for a company-wide
// overview, and so authorization never has to walk the offer list.
export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const rows = await ctx.db
      .query("webhooks")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    return rows.sort((a, b) => a.createdAt - b.createdAt).map(toWebhook);
  },
});

export const get = query({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, { webhookId }) => {
    const doc = await ctx.db.get(webhookId);
    return doc ? toWebhook(doc) : null;
  },
});

// Replace-all for one offer's endpoints. Secrets are minted by the caller
// (node randomBytes is unavailable here): `secret` is required for a new
// row, and supplied for an existing one only when the dashboard asked to
// regenerate it.
export const replaceForOffer = mutation({
  args: {
    offerId: v.id("offers"),
    companyId: v.id("companies"),
    webhooks: v.array(
      v.object({
        id: v.optional(v.id("webhooks")),
        url: v.string(),
        events: v.array(v.string()),
        isActive: v.boolean(),
        secret: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { offerId, companyId, webhooks }) => {
    const existing = await ctx.db
      .query("webhooks")
      .withIndex("by_offer", (q) => q.eq("offerId", offerId))
      .collect();

    const kept = new Set(webhooks.map((w) => w.id).filter(Boolean));
    for (const row of existing) {
      if (!kept.has(row._id)) await ctx.db.delete(row._id);
    }

    for (const w of webhooks) {
      if (w.id) {
        await ctx.db.patch(w.id, {
          url: w.url,
          events: w.events,
          isActive: w.isActive,
          // Absent means "keep the secret the receiver is already
          // verifying with".
          ...(w.secret ? { secret: w.secret } : {}),
        });
        continue;
      }
      await ctx.db.insert("webhooks", {
        companyId,
        offerId,
        url: w.url,
        events: w.events,
        isActive: w.isActive,
        secret: w.secret ?? "",
        createdAt: Date.now(),
      });
    }

    const after = await ctx.db
      .query("webhooks")
      .withIndex("by_offer", (q) => q.eq("offerId", offerId))
      .collect();
    return after.sort((a, b) => a.createdAt - b.createdAt).map(toWebhook);
  },
});

// Which endpoints should hear about an event on this offer. Only the
// offer's own endpoints: a company-wide webhook is no longer a concept.
export const subscribersForOffer = query({
  args: { offerId: v.id("offers"), event: v.string() },
  handler: async (ctx, { offerId, event }) => {
    const rows = await ctx.db
      .query("webhooks")
      .withIndex("by_offer", (q) => q.eq("offerId", offerId))
      .collect();
    return rows.filter((w) => w.isActive && w.events.includes(event)).map(toWebhook);
  },
});

export const recordDelivery = mutation({
  args: {
    webhookId: v.id("webhooks"),
    lastStatus: v.number(),
    lastError: v.string(),
    lastAttemptAt: v.number(),
  },
  handler: async (ctx, { webhookId, ...patch }) => {
    await ctx.db.patch(webhookId, patch);
    return null;
  },
});
