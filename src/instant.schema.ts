// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
    todos: i.entity({
      text: i.string(),
      done: i.boolean(),
      createdAt: i.number(),
    }),
    spins: i.entity({
      name: i.string(),
      // No longer globally unique — uniqueness is per-company and enforced
      // in application code (see /api/register), since InstantDB has no
      // compound-unique constraint.
      phone: i.string().indexed(),
      token: i.string().unique().indexed().optional(),
      prizeId: i.string().indexed().optional(),
      prizeLabel: i.string().optional(),
      // Optional only so the schema push doesn't choke on pre-migration
      // rows; every row created going forward always has one.
      companyId: i.string().indexed().optional(),
      offerId: i.string().indexed().optional(),
      // { [formField.key]: answer } for whatever extra fields the company
      // has configured — see the `formFields` entity below.
      extraFields: i.json().optional(),
      createdAt: i.number().indexed(),
    }),
    settings: i.entity({
      key: i.string().unique().indexed(),
      askName: i.boolean(),
      askPhone: i.boolean(),
    }),
    companies: i.entity({
      slug: i.string().unique().indexed(),
      name: i.string(),
      isActive: i.boolean().indexed(),
      askName: i.boolean(),
      askPhone: i.boolean(),
      createdAt: i.number().indexed(),
      gameType: i.string().optional(),
      // "salt:hex-hash" from lib/companyAuth.ts, scrypt-derived. Absent
      // means company login is disabled — only the platform admin password
      // can reach this company's dashboard. Never sent to the client;
      // only a `hasPassword` boolean is ever exposed over the API.
      passwordHash: i.string().optional(),
    }),
    prizes: i.entity({
      label: i.string(),
      weight: i.number(),
      color: i.string().optional(),
      // Clockwise slice position, ascending, starting at the top of the
      // wheel image — must match how the admin lays out their uploaded
      // wheel image.
      order: i.number().indexed(),
      // Replaces the old hardcoded id==="no_win" string check now that
      // prize ids are opaque DB row ids.
      isWin: i.boolean(),
      // Plain field (alongside the `company` link below) so the hot-path
      // /api/spin route can filter with the same `where: { companyId }`
      // idiom already used on `spins`. Optional in the type only so the
      // push doesn't choke on the 4 pre-existing rows from the initial
      // migration (backfilled immediately after this push); every row
      // created going forward always has one.
      companyId: i.string().indexed().optional(),
      offerId: i.string().indexed().optional(),
      createdAt: i.number().indexed(),
    }),
    webhooks: i.entity({
      companyId: i.string().indexed(),
      url: i.string(),
      // Shared secret this endpoint's deliveries are HMAC-signed with, so
      // the receiver can prove a POST really came from us. Generated
      // server-side and only ever revealed to an authenticated dashboard.
      secret: i.string(),
      // string[] of WEBHOOK_EVENT ids (see lib/webhooks.ts) this endpoint
      // is subscribed to. JSON rather than a linked entity because it's a
      // small closed set that's always read and written together.
      events: i.json(),
      isActive: i.boolean().indexed(),
      createdAt: i.number().indexed(),
      // Last delivery outcome, so the dashboard can show at a glance
      // whether an endpoint is actually healthy.
      lastStatus: i.number().optional(),
      lastError: i.string().optional(),
      lastAttemptAt: i.number().optional(),
    }),
    // One installed app on one device, as far as push is concerned. Keyed
    // by the Expo push token, which is what the Expo push service accepts;
    // it can change on reinstall, so the app re-registers on every launch
    // and dead tokens are pruned from delivery receipts (see lib/push.ts).
    deviceTokens: i.entity({
      token: i.string().unique().indexed(),
      // Which login this device registered under. "admin" devices hear
      // about every company; "company" devices only about their own.
      role: i.string().indexed(),
      // Set for role "company", absent for "admin".
      companyId: i.string().indexed().optional(),
      // string[] of WEBHOOK_EVENT ids this device wants (same catalog the
      // webhooks entity uses). JSON for the same reason: a small closed
      // set always read and written together.
      events: i.json(),
      // "ios" | "android" | "web" — only used to label the device in the
      // dashboard, never to branch delivery.
      platform: i.string().optional(),
      deviceName: i.string().optional(),
      createdAt: i.number().indexed(),
      // Refreshed on every re-register, so a device that has not opened
      // the app in months can be identified.
      lastSeenAt: i.number().indexed(),
    }),
    formFields: i.entity({
      label: i.string(),
      // Stable slug derived from the label at creation time, used as the
      // JSON key on spins.extraFields — kept unchanged on edits so
      // already-collected answers keep resolving to the right field.
      key: i.string(),
      required: i.boolean(),
      // Which input control the question renders as — see the
      // FormFieldType union in lib/formFields.ts. Optional because rows
      // created before it existed have none; those read back as "text".
      type: i.string().optional(),
      // string[] of choices for the select/radio/checkboxes types, always
      // read through normalizeFieldOptions(). JSON rather than a linked
      // entity because it is a short list only ever read and written
      // together with the field itself.
      options: i.json().optional(),
      order: i.number().indexed(),
      companyId: i.string().indexed(),
      offerId: i.string().indexed().optional(),
      createdAt: i.number().indexed(),
    }),
    offers: i.entity({
      title: i.string(),
      type: i.string().indexed(), // wheel | scratch | slot | giftbox | plinko | memory
      event: i.string().indexed().optional(), // none | halloween | christmas | birthday | anniversary
      isActive: i.boolean().indexed(),
      askName: i.boolean(),
      askPhone: i.boolean(),
      createdAt: i.number().indexed(),
      companyId: i.string().indexed(),
      // Social-proof notification settings — see lib/fomo.ts for the shape
      // and normalizeFomoConfig(), which every read goes through. JSON
      // rather than a linked entity because it is a small closed set of
      // toggles that is always read and written as one blob.
      fomoConfig: i.json().optional(),
      // Website-embed / exit-intent settings — see lib/embed.ts. Read by
      // the public /embed.js loader on the merchant's own site.
      embedConfig: i.json().optional(),
    }),
  },
  links: {
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    companyPrizes: {
      forward: { on: "prizes", has: "one", label: "company", onDelete: "cascade" },
      reverse: { on: "companies", has: "many", label: "prizes" },
    },
    companySpins: {
      forward: { on: "spins", has: "one", label: "company", onDelete: "cascade" },
      reverse: { on: "companies", has: "many", label: "spins" },
    },
    companyWheelImage: {
      forward: { on: "companies", has: "one", label: "wheelImage" },
      reverse: { on: "$files", has: "many", label: "wheelImageOfCompanies" },
    },
    companyBgImage: {
      forward: { on: "companies", has: "one", label: "bgImage" },
      reverse: { on: "$files", has: "many", label: "bgImageOfCompanies" },
    },
    companyPinImage: {
      forward: { on: "companies", has: "one", label: "pinImage" },
      reverse: { on: "$files", has: "many", label: "pinImageOfCompanies" },
    },
    prizeIcon: {
      forward: { on: "prizes", has: "one", label: "icon" },
      reverse: { on: "$files", has: "many", label: "iconOfPrizes" },
    },
    companyFormFields: {
      forward: { on: "formFields", has: "one", label: "company", onDelete: "cascade" },
      reverse: { on: "companies", has: "many", label: "formFields" },
    },
    companyWebhooks: {
      forward: { on: "webhooks", has: "one", label: "company", onDelete: "cascade" },
      reverse: { on: "companies", has: "many", label: "webhooks" },
    },
    companyOffers: {
      forward: { on: "offers", has: "one", label: "company", onDelete: "cascade" },
      reverse: { on: "companies", has: "many", label: "offers" },
    },
    offerPrizes: {
      forward: { on: "prizes", has: "one", label: "offer", onDelete: "cascade" },
      reverse: { on: "offers", has: "many", label: "prizes" },
    },
    offerFormFields: {
      forward: { on: "formFields", has: "one", label: "offer", onDelete: "cascade" },
      reverse: { on: "offers", has: "many", label: "formFields" },
    },
    offerSpins: {
      forward: { on: "spins", has: "one", label: "offer", onDelete: "cascade" },
      reverse: { on: "offers", has: "many", label: "spins" },
    },
    offerWheelImage: {
      forward: { on: "offers", has: "one", label: "wheelImage" },
      reverse: { on: "$files", has: "many", label: "wheelImageOfOffers" },
    },
    offerBgImage: {
      forward: { on: "offers", has: "one", label: "bgImage" },
      reverse: { on: "$files", has: "many", label: "bgImageOfOffers" },
    },
    offerPinImage: {
      forward: { on: "offers", has: "one", label: "pinImage" },
      reverse: { on: "$files", has: "many", label: "pinImageOfOffers" },
    },
  },
  rooms: {
    todos: {
      presence: i.entity({}),
    },
  },
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
