import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Ported from the InstantDB schema this replaced (src/instant.schema.ts).
// Two structural differences, both because Convex models these natively:
//
//  * Instant's `links` are gone. Every child row already carried a plain
//    `companyId`/`offerId` string alongside its link, and the code filtered
//    on those rather than traversing, so the ids simply become typed
//    `v.id(...)` references and the links have nothing left to express.
//  * Instant's `$files` entity is gone. Convex has first-class storage, so
//    an image is a `v.id("_storage")` on the row that owns it and the URL
//    is resolved at read time via `ctx.storage.getUrl()` instead of being
//    denormalised onto a file row.
//
// Instant's `settings`, `todos`, `$users` and `rooms` are not ported:
// `settings` was already dead (lib/settingsStore.ts reads the default
// company's own askName/askPhone) and the rest were starter-template
// leftovers with no reader in the codebase.
//
// `createdAt` is kept even though Convex supplies `_creationTime`, because
// it is read and ordered on throughout the app.
export default defineSchema({
  companies: defineTable({
    slug: v.string(),
    name: v.string(),
    isActive: v.boolean(),
    askName: v.boolean(),
    askPhone: v.boolean(),
    createdAt: v.number(),
    gameType: v.optional(v.string()),
    // "salt:hex-hash" from lib/companyAuth.ts, scrypt-derived. Absent means
    // company login is disabled — only the platform admin password can
    // reach this company's dashboard. Never sent to the client; only a
    // `hasPassword` boolean is ever exposed over the API.
    passwordHash: v.optional(v.string()),
    // Legacy company-level artwork. Superseded by the per-offer images
    // below, and only still read for pre-offer companies.
    wheelImageId: v.optional(v.id("_storage")),
    bgImageId: v.optional(v.id("_storage")),
    pinImageId: v.optional(v.id("_storage")),
  })
    .index("by_slug", ["slug"])
    .index("by_createdAt", ["createdAt"]),

  offers: defineTable({
    companyId: v.id("companies"),
    title: v.string(),
    // wheel | scratch | slot | giftbox | plinko | memory
    type: v.string(),
    // none | halloween | christmas | birthday | anniversary
    event: v.optional(v.string()),
    isActive: v.boolean(),
    askName: v.boolean(),
    askPhone: v.boolean(),
    createdAt: v.number(),
    // Social-proof notification settings — see lib/fomo.ts for the shape
    // and normalizeFomoConfig(), which every read goes through. Stored as
    // one blob because it is a small closed set of toggles always read and
    // written together.
    fomoConfig: v.optional(v.any()),
    // Website-embed / exit-intent settings — see lib/embed.ts. Read by the
    // public /embed.js loader on the merchant's own site.
    embedConfig: v.optional(v.any()),
    wheelImageId: v.optional(v.id("_storage")),
    bgImageId: v.optional(v.id("_storage")),
    pinImageId: v.optional(v.id("_storage")),
  })
    .index("by_company", ["companyId"])
    .index("by_company_active", ["companyId", "isActive"]),

  prizes: defineTable({
    companyId: v.id("companies"),
    // Absent only on the legacy company-level wheel, which predates offers.
    offerId: v.optional(v.id("offers")),
    label: v.string(),
    weight: v.number(),
    color: v.optional(v.string()),
    // Clockwise slice position, ascending, starting at the top of the wheel
    // image — must match how the admin laid out their uploaded artwork.
    order: v.number(),
    isWin: v.boolean(),
    createdAt: v.number(),
    iconId: v.optional(v.id("_storage")),
  })
    .index("by_company", ["companyId"])
    .index("by_offer", ["offerId"]),

  formFields: defineTable({
    companyId: v.id("companies"),
    offerId: v.optional(v.id("offers")),
    label: v.string(),
    // Stable slug derived from the label at creation time, used as the key
    // on spins.extraFields — kept unchanged on edits so already-collected
    // answers keep resolving to the right field.
    key: v.string(),
    required: v.boolean(),
    // Which input control the question renders as — see the FormFieldType
    // union in lib/formFields.ts. Optional because rows created before it
    // existed have none; those read back as "text".
    type: v.optional(v.string()),
    // Choices for the select/radio/checkboxes types, always read through
    // normalizeFieldOptions().
    options: v.optional(v.array(v.string())),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_offer", ["offerId"]),

  spins: defineTable({
    companyId: v.id("companies"),
    offerId: v.optional(v.id("offers")),
    name: v.string(),
    // Uniqueness is per-company, not global, and is enforced in application
    // code — see registerSpin.
    phone: v.string(),
    token: v.optional(v.string()),
    prizeId: v.optional(v.id("prizes")),
    prizeLabel: v.optional(v.string()),
    // { [formField.key]: answer } for whatever questions the offer asks.
    extraFields: v.optional(v.record(v.string(), v.string())),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_company", ["companyId"])
    .index("by_offer", ["offerId"])
    // The duplicate-registration check in registerSpin.
    .index("by_company_phone", ["companyId", "phone"]),

  // Now scoped to a single offer rather than the whole company: a merchant
  // running several games wants each one reporting somewhere different.
  // companyId is kept alongside it so authorization and the dashboard
  // listing can still work company-wide without loading every offer.
  webhooks: defineTable({
    companyId: v.id("companies"),
    offerId: v.id("offers"),
    url: v.string(),
    // Shared secret this endpoint's deliveries are HMAC-signed with, so the
    // receiver can prove a POST really came from us. Generated server-side
    // and only ever revealed to an authenticated dashboard.
    secret: v.string(),
    // WEBHOOK_EVENT ids (see lib/webhookEvents.ts) this endpoint wants.
    events: v.array(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    // Last delivery outcome, so the dashboard can show at a glance whether
    // an endpoint is actually healthy.
    lastStatus: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
  })
    .index("by_company", ["companyId"])
    .index("by_offer", ["offerId"]),

  // One installed app on one device, as far as push is concerned. Keyed by
  // the Expo push token, which is what the Expo push service accepts; it can
  // change on reinstall, so the app re-registers on every launch and dead
  // tokens are pruned from delivery receipts (see lib/push.ts).
  deviceTokens: defineTable({
    token: v.string(),
    // Which login this device registered under. "admin" devices hear about
    // every company; "company" devices only about their own.
    role: v.string(),
    companyId: v.optional(v.id("companies")),
    events: v.array(v.string()),
    // "ios" | "android" | "web" — only used to label the device, never to
    // branch delivery.
    platform: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    createdAt: v.number(),
    // Refreshed on every re-register, so a device that has not opened the
    // app in months can be identified.
    lastSeenAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_company", ["companyId"])
    .index("by_role", ["role"]),
});
