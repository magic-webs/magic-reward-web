import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Instant denormalised a file's URL onto a `$files` row, so callers read
// `offer.wheelImage.url` straight from a join. Convex stores only the
// storage id and mints URLs on demand, so every read that needs one goes
// through here (or through the resolved shapes in offers.ts / companies.ts).
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { storageId }) => ctx.storage.getUrl(storageId),
});

// Upload happens in two steps in Convex: the client (here, a Next.js route
// handler) asks for a short-lived signed URL, POSTs the bytes straight to
// it, and gets back a storage id to attach. That keeps file bytes off the
// function transport entirely.
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const remove = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    await ctx.storage.delete(storageId);
    return null;
  },
});
