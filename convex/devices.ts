import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

function toDevice(doc: Doc<"deviceTokens">) {
  return {
    id: doc._id,
    token: doc.token,
    role: doc.role === "admin" ? ("admin" as const) : ("company" as const),
    companyId: doc.companyId ?? null,
    events: doc.events,
    platform: doc.platform ?? null,
    deviceName: doc.deviceName ?? null,
    createdAt: doc.createdAt,
    lastSeenAt: doc.lastSeenAt,
  };
}

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const doc = await ctx.db
      .query("deviceTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    return doc ? toDevice(doc) : null;
  },
});

// Upsert: the app re-registers on every launch, because Expo can reissue a
// token at any time and the same phone may sign in under a different login.
// Omitting `events` leaves an existing device's choices alone — a plain
// re-register must not undo what the user set in Settings.
export const upsert = mutation({
  args: {
    token: v.string(),
    role: v.string(),
    companyId: v.optional(v.id("companies")),
    events: v.optional(v.array(v.string())),
    platform: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    // Used only when creating, so the caller owns the default list.
    defaultEvents: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("deviceTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        companyId: args.companyId,
        events: args.events ?? existing.events,
        platform: args.platform ?? existing.platform,
        deviceName: args.deviceName ?? existing.deviceName,
        lastSeenAt: now,
      });
      const updated = await ctx.db.get(existing._id);
      return updated ? toDevice(updated) : null;
    }

    const deviceId = await ctx.db.insert("deviceTokens", {
      token: args.token,
      role: args.role,
      companyId: args.companyId,
      events: args.events ?? args.defaultEvents,
      platform: args.platform,
      deviceName: args.deviceName,
      createdAt: now,
      lastSeenAt: now,
    });
    const created = await ctx.db.get(deviceId);
    return created ? toDevice(created) : null;
  },
});

export const updateEvents = mutation({
  args: { token: v.string(), events: v.array(v.string()) },
  handler: async (ctx, { token, events }) => {
    const existing = await ctx.db
      .query("deviceTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!existing) return null;

    await ctx.db.patch(existing._id, { events, lastSeenAt: Date.now() });
    const updated = await ctx.db.get(existing._id);
    return updated ? toDevice(updated) : null;
  },
});

export const remove = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const existing = await ctx.db
      .query("deviceTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

// Every device allowed to hear about this company: its own company-scoped
// devices, plus every admin device.
export const listTargets = query({
  args: { companyId: v.id("companies"), event: v.string() },
  handler: async (ctx, { companyId, event }) => {
    const [own, admins] = await Promise.all([
      ctx.db
        .query("deviceTokens")
        .withIndex("by_company", (q) => q.eq("companyId", companyId))
        .collect(),
      ctx.db
        .query("deviceTokens")
        .withIndex("by_role", (q) => q.eq("role", "admin"))
        .collect(),
    ]);

    // An admin device also carrying this companyId would otherwise appear
    // in both lists.
    const seen = new Set<string>();
    return [...own, ...admins]
      .filter((d) => {
        if (seen.has(d.token)) return false;
        seen.add(d.token);
        return d.events.includes(event);
      })
      .map(toDevice);
  },
});

// Delivery receipts said these will never arrive again (the app was
// uninstalled, or the token was reissued).
export const removeMany = mutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, { tokens }) => {
    for (const token of tokens) {
      const doc = await ctx.db
        .query("deviceTokens")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (doc) await ctx.db.delete(doc._id);
    }
    return null;
  },
});
