import { init, id } from "@instantdb/admin";
import type { NextRequest } from "next/server";
import schema from "@/instant.schema";
import type { WheelPrize } from "@/lib/wheel";
import {
  normalizeFieldOptions,
  normalizeFieldType,
  type FormFieldType,
} from "@/lib/formFields";
import { ADMIN_COOKIE_NAME, isValidAdminSessionToken } from "@/lib/adminAuth";
import { COMPANY_COOKIE_NAME, readCompanySessionToken } from "@/lib/companyAuth";
import { extractToken } from "@/lib/authToken";

const adminDb = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
  schema,
});

export interface Company {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  askName: boolean;
  askPhone: boolean;
  createdAt: number;
  passwordHash?: string;
  gameType?: string;
}

export type CompanyAccessRole = "admin" | "company";

// The single, shared authorization check for every /api/admin/companies/**
// route: either the platform admin token, or a company token whose
// signature is valid against this exact company's current passwordHash
// (so it can never authorize a different company, and a password
// change/removal invalidates it immediately). Each token can arrive
// either as its named cookie (web) or an Authorization: Bearer header
// (mobile) — see lib/authToken.ts.
export async function resolveCompanyAccess(
  req: NextRequest,
  companyId: string | undefined | null,
): Promise<CompanyAccessRole | null> {
  const adminToken = extractToken(req, ADMIN_COOKIE_NAME);
  if (isValidAdminSessionToken(adminToken)) return "admin";
  if (!companyId) return null;

  const companyToken = extractToken(req, COMPANY_COOKIE_NAME);
  if (!companyToken) return null;

  const auth = await getCompanyAuthById(companyId);
  if (!auth?.passwordHash) return null;

  const authedId = readCompanySessionToken(companyToken, auth.passwordHash);
  return authedId === companyId ? "company" : null;
}

export async function getCompanyAuthById(
  companyId: string,
): Promise<{ id: string; passwordHash: string | null } | null> {
  const { companies } = await adminDb.query({ companies: { $: { where: { id: companyId } } } });
  const company = companies[0];
  if (!company) return null;
  return { id: company.id, passwordHash: company.passwordHash ?? null };
}

export async function setCompanyPassword(companyId: string, passwordHash: string | null) {
  // `null` (not `undefined`) is required here to actually clear an
  // existing value — InstantDB's `update()` treats an `undefined` value as
  // "leave this attribute untouched", not "unset it".
  await adminDb.transact(
    adminDb.tx.companies[companyId].update({ passwordHash: passwordHash as unknown as string | undefined }),
  );
}

export interface FormField {
  id: string;
  key: string;
  label: string;
  required: boolean;
  type: FormFieldType;
  options: string[];
}

export interface PublicWheelConfig {
  title: string;
  askName: boolean;
  askPhone: boolean;
  wheelImageUrl: string | null;
  bgImageUrl: string | null;
  pinImageUrl: string | null;
  prizes: WheelPrize[];
  fields: FormField[];
  gameType?: string;
  event?: string;
  offerId?: string;
}

// Every read of a formFields row goes through this, so a row saved before
// custom input types existed still hands callers a complete field.
export function toFormField(row: {
  id: string;
  key: string;
  label: string;
  required: boolean;
  type?: string | null;
  options?: unknown;
}): FormField {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    required: row.required,
    type: normalizeFieldType(row.type),
    options: normalizeFieldOptions(row.options),
  };
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "company"
  );
}

// Same slug shape as company slugs — used as the stable JSON key on
// spins.extraFields for a form field, derived from its label once at
// creation and never changed afterward.
export const slugifyFieldKey = slugify;

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const { companies } = await adminDb.query({ companies: { $: { where: { slug } } } });
  return companies[0] ?? null;
}

export async function getDefaultCompany(): Promise<Company | null> {
  const slug = process.env.DEFAULT_COMPANY_SLUG ?? "default";
  return getCompanyBySlug(slug);
}

export async function listCompaniesWithSpinCounts() {
  const { companies, spins } = await adminDb.query({
    companies: { $: { order: { createdAt: "desc" } } },
    spins: {},
  });
  const counts = new Map<string, number>();
  for (const s of spins) {
    if (!s.companyId) continue;
    counts.set(s.companyId, (counts.get(s.companyId) ?? 0) + 1);
  }
  return companies.map((c) => ({ ...c, spinCount: counts.get(c.id) ?? 0 }));
}

// Generates a unique slug from a name (e.g. "Test Salon" -> "test-salon",
// deduped to "test-salon-2" if that slug is already taken) and creates the
// company row.
export async function createCompany(name: string): Promise<Company> {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  while (await getCompanyBySlug(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  const companyId = id();
  await adminDb.transact(
    adminDb.tx.companies[companyId].update({
      slug,
      name,
      isActive: true,
      askName: true,
      askPhone: true,
      createdAt: Date.now(),
    }),
  );

  return { id: companyId, slug, name, isActive: true, askName: true, askPhone: true, createdAt: Date.now() };
}

export async function getCompanyWithDetails(companyId: string) {
  const { companies } = await adminDb.query({
    companies: {
      $: { where: { id: companyId } },
      prizes: { $: { order: { order: "asc" } }, icon: {} },
      formFields: { $: { order: { order: "asc" } } },
      wheelImage: {},
      bgImage: {},
      pinImage: {},
    },
  });
  return companies[0] ?? null;
}

export async function getFormFields(companyId: string): Promise<FormField[]> {
  const { formFields } = await adminDb.query({
    formFields: { $: { where: { companyId }, order: { order: "asc" } } },
  });
  return formFields.map(toFormField);
}

export async function updateCompany(
  companyId: string,
  patch: Partial<Pick<Company, "name" | "isActive" | "askName" | "askPhone" | "gameType">>,
) {
  await adminDb.transact(adminDb.tx.companies[companyId].update(patch));
}

export async function getPublicWheelConfig(companyId: string, offerId?: string): Promise<PublicWheelConfig | null> {
  let offer;
  if (offerId) {
    offer = await getOfferWithDetails(offerId);
    if (!offer || offer.companyId !== companyId) return null;
  } else {
    const { offers } = await adminDb.query({
      offers: {
        $: { where: { companyId, isActive: true }, order: { createdAt: "desc" } },
        prizes: { $: { order: { order: "asc" } }, icon: {} },
        formFields: { $: { order: { order: "asc" } } },
        wheelImage: {},
        bgImage: {},
        pinImage: {},
      }
    });
    offer = offers[0];
  }
  if (!offer) return null;

  return {
    title: offer.title,
    askName: offer.askName,
    askPhone: offer.askPhone,
    gameType: offer.type ?? "wheel",
    event: offer.event ?? "none",
    wheelImageUrl: offer.wheelImage?.url ?? null,
    bgImageUrl: offer.bgImage?.url ?? null,
    pinImageUrl: offer.pinImage?.url ?? null,
    prizes: (offer.prizes ?? []).map((p) => ({
      id: p.id,
      label: p.label,
      weight: p.weight,
      order: p.order,
      isWin: p.isWin,
      color: p.color,
      iconUrl: p.icon?.url,
    })),
    fields: (offer.formFields ?? []).map(toFormField),
    offerId: offer.id,
  };
}

export async function getOfferWithDetails(offerId: string) {
  const { offers } = await adminDb.query({
    offers: {
      $: { where: { id: offerId } },
      prizes: { $: { order: { order: "asc" } }, icon: {} },
      formFields: { $: { order: { order: "asc" } } },
      wheelImage: {},
      bgImage: {},
      pinImage: {},
    },
  });
  return offers[0] ?? null;
}

export { adminDb };
