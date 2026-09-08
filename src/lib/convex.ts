import { ConvexHttpClient } from "convex/browser";

// Convex has no ad-hoc query API the way InstantDB's admin SDK did — every
// read and write is a deployed function in convex/. Route handlers and the
// lib/ modules call them through this client.
//
// NEXT_PUBLIC_CONVEX_URL is written into .env.local by `convex dev`, and
// must also be set in the deployment environment.
const url = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!url) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` locally, or set it in the deployment environment.",
  );
}

export const convex = new ConvexHttpClient(url);

// Re-exported so callers do not each import from the generated tree.
export { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
export type { Id };

// Convex ids are branded strings. Route params arrive as plain strings, so
// they are cast at the boundary; a malformed id surfaces as a Convex
// argument error, which callers already treat as a failed lookup.
export function asCompanyId(value: string): Id<"companies"> {
  return value as Id<"companies">;
}

export function asOfferId(value: string): Id<"offers"> {
  return value as Id<"offers">;
}

export function asPrizeId(value: string): Id<"prizes"> {
  return value as Id<"prizes">;
}

export function asFieldId(value: string): Id<"formFields"> {
  return value as Id<"formFields">;
}

export function asWebhookId(value: string): Id<"webhooks"> {
  return value as Id<"webhooks">;
}
