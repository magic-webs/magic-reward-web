import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// A company as the app reads it. `passwordHash` is deliberately included —
// resolveCompanyAccess and the login route both need it, and every public
// path goes through a shape that drops it (see the API routes, which only
// ever expose `hasPassword`).
function toCompany(doc: Doc<"companies">) {
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    isActive: doc.isActive,
    askName: doc.askName,
    askPhone: doc.askPhone,
    createdAt: doc.createdAt,
    gameType: doc.gameType,
    passwordHash: doc.passwordHash,
  };
}

export async function companyBySlug(ctx: QueryCtx, slug: string) {
  return ctx.db
    .query("companies")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const doc = await companyBySlug(ctx, slug);
    return doc ? toCompany(doc) : null;
  },
});

export const getById = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const doc = await ctx.db.get(companyId);
    return doc ? toCompany(doc) : null;
  },
});

// Newest first, each with how many registrations it has. Instant did this
// by loading every spin row and counting in memory; here the count comes
// from the by_company index per company, which stays bounded as the table
// grows.
export const listWithSpinCounts = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query("companies").withIndex("by_createdAt").order("desc").collect();

    return Promise.all(
      companies.map(async (c) => {
        const spins = await ctx.db
          .query("spins")
          .withIndex("by_company", (q) => q.eq("companyId", c._id))
          .collect();
        return { ...toCompany(c), hasPassword: Boolean(c.passwordHash), spinCount: spins.length };
      }),
    );
  },
});

// The caller does the slug deduping, because it needs to be inside the same
// mutation to be race-free.
export const create = mutation({
  args: { name: v.string(), slug: v.string() },
  handler: async (ctx, { name, slug }) => {
    // Dedupe here rather than in the caller: two simultaneous creates with
    // the same name would otherwise both see the slug as free.
    let candidate = slug;
    let suffix = 2;
    while (await companyBySlug(ctx, candidate)) {
      candidate = `${slug}-${suffix}`;
      suffix += 1;
    }

    const createdAt = Date.now();
    const companyId = await ctx.db.insert("companies", {
      slug: candidate,
      name,
      isActive: true,
      askName: true,
      askPhone: true,
      createdAt,
    });

    return {
      id: companyId,
      slug: candidate,
      name,
      isActive: true,
      askName: true,
      askPhone: true,
      createdAt,
    };
  },
});

export const update = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    askName: v.optional(v.boolean()),
    askPhone: v.optional(v.boolean()),
    gameType: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, ...patch }) => {
    // Strip undefined so an absent field means "leave alone" rather than
    // "clear", matching how the old Instant update behaved.
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(defined).length > 0) await ctx.db.patch(companyId, defined);
    return null;
  },
});

// Null clears it, which is how company login gets disabled.
export const setPassword = mutation({
  args: { companyId: v.id("companies"), passwordHash: v.union(v.string(), v.null()) },
  handler: async (ctx, { companyId, passwordHash }) => {
    await ctx.db.patch(companyId, { passwordHash: passwordHash ?? undefined });
    return null;
  },
});

export const setImage = mutation({
  args: {
    companyId: v.id("companies"),
    kind: v.union(v.literal("wheel"), v.literal("bg"), v.literal("pin")),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { companyId, kind, storageId }) => {
    const field = ({ wheel: "wheelImageId", bg: "bgImageId", pin: "pinImageId" } as const)[kind];
    const company = await ctx.db.get(companyId);
    if (!company) return null;

    // Replacing artwork should not leave the old blob behind — Instant
    // overwrote by path, which made this implicit.
    const previous = company[field];
    await ctx.db.patch(companyId, { [field]: storageId });
    if (previous && previous !== storageId) await ctx.storage.delete(previous);

    return { url: await ctx.storage.getUrl(storageId) };
  },
});

// The legacy company-level wheel: prizes and form fields that predate
// offers, with image URLs resolved.
export const getWithDetails = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.db.get(companyId);
    if (!company) return null;

    const [prizes, formFields] = await Promise.all([
      ctx.db
        .query("prizes")
        .withIndex("by_company", (q) => q.eq("companyId", companyId))
        .collect(),
      ctx.db
        .query("formFields")
        .withIndex("by_company", (q) => q.eq("companyId", companyId))
        .collect(),
    ]);

    const withIcons = await Promise.all(
      prizes
        .sort((a, b) => a.order - b.order)
        .map(async (p) => ({
          id: p._id,
          label: p.label,
          weight: p.weight,
          color: p.color,
          order: p.order,
          isWin: p.isWin,
          iconUrl: p.iconId ? await ctx.storage.getUrl(p.iconId) : null,
        })),
    );

    return {
      ...toCompany(company),
      wheelImageUrl: company.wheelImageId ? await ctx.storage.getUrl(company.wheelImageId) : null,
      bgImageUrl: company.bgImageId ? await ctx.storage.getUrl(company.bgImageId) : null,
      pinImageUrl: company.pinImageId ? await ctx.storage.getUrl(company.pinImageId) : null,
      prizes: withIcons,
      formFields: formFields
        .sort((a, b) => a.order - b.order)
        .map((f) => ({
          id: f._id,
          key: f.key,
          label: f.label,
          required: f.required,
          type: f.type,
          options: f.options,
          order: f.order,
        })),
    };
  },
});

export type CompanyId = Id<"companies">;
