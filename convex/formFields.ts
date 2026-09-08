import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const fieldInput = v.object({
  id: v.optional(v.id("formFields")),
  label: v.string(),
  required: v.boolean(),
  type: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
  // Slug derived from the label by the caller (slugifyFieldKey). Only used
  // for new rows — an existing row keeps the key it was created with, so
  // answers already stored under it keep resolving.
  keyBase: v.string(),
});

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    return fields.sort((a, b) => a.order - b.order);
  },
});

async function replaceAll(
  ctx: MutationCtx,
  scope: { companyId: Id<"companies">; offerId?: Id<"offers"> },
  fields: Array<{
    id?: Id<"formFields">;
    label: string;
    required: boolean;
    type?: string;
    options?: string[];
    keyBase: string;
  }>,
) {
  const offerId = scope.offerId;
  const existing = offerId
    ? await ctx.db
        .query("formFields")
        .withIndex("by_offer", (q) => q.eq("offerId", offerId))
        .collect()
    : await ctx.db
        .query("formFields")
        .withIndex("by_company", (q) => q.eq("companyId", scope.companyId))
        .collect();

  const kept = new Set(fields.map((f) => f.id).filter(Boolean));
  for (const row of existing) {
    if (!kept.has(row._id)) await ctx.db.delete(row._id);
  }

  // Keys must stay unique within the scope, since they are the property
  // names on spins.extraFields. Rows we are keeping already own theirs.
  const usedKeys = new Set(existing.filter((r) => kept.has(r._id)).map((r) => r.key));

  for (const [order, f] of fields.entries()) {
    if (f.id) {
      await ctx.db.patch(f.id, {
        label: f.label,
        required: f.required,
        type: f.type,
        options: f.options,
        order,
      });
      continue;
    }

    let key = f.keyBase;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${f.keyBase}-${suffix}`;
      suffix += 1;
    }
    usedKeys.add(key);

    await ctx.db.insert("formFields", {
      companyId: scope.companyId,
      offerId: scope.offerId,
      label: f.label,
      key,
      required: f.required,
      type: f.type,
      options: f.options,
      order,
      createdAt: Date.now(),
    });
  }
}

export const replaceForOffer = mutation({
  args: {
    offerId: v.id("offers"),
    companyId: v.id("companies"),
    fields: v.array(fieldInput),
  },
  handler: async (ctx, { offerId, companyId, fields }) => {
    await replaceAll(ctx, { companyId, offerId }, fields);
    return null;
  },
});

export const replaceForCompany = mutation({
  args: { companyId: v.id("companies"), fields: v.array(fieldInput) },
  handler: async (ctx, { companyId, fields }) => {
    await replaceAll(ctx, { companyId }, fields);
    return null;
  },
});
