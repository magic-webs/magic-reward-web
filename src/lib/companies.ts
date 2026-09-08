import type { NextRequest } from "next/server";
import type { WheelPrize } from "@/lib/wheel";
import {
  normalizeFieldOptions,
  normalizeFieldType,
  type FormFieldType,
} from "@/lib/formFields";
import { ADMIN_COOKIE_NAME, isValidAdminSessionToken } from "@/lib/adminAuth";
import { COMPANY_COOKIE_NAME, readCompanySessionToken } from "@/lib/companyAuth";
import { extractToken } from "@/lib/authToken";
import { api, asCompanyId, asOfferId, convex } from "@/lib/convex";

export { asCompanyId, asOfferId };

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
  const company = await convex.query(api.companies.getById, {
    companyId: asCompanyId(companyId),
  });
  if (!company) return null;
  return { id: company.id, passwordHash: company.passwordHash ?? null };
}

// `null` disables company login — only the platform admin password can
// reach the dashboard afterwards.
export async function setCompanyPassword(companyId: string, passwordHash: string | null) {
  await convex.mutation(api.companies.setPassword, {
    companyId: asCompanyId(companyId),
    passwordHash,
  });
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

// Every read of a form field goes through this, so a row saved before
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

// Same slug shape as company slugs — used as the stable key on
// spins.extraFields for a form field, derived from its label once at
// creation and never changed afterward.
export const slugifyFieldKey = slugify;

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  return convex.query(api.companies.getBySlug, { slug });
}

export async function getDefaultCompany(): Promise<Company | null> {
  const slug = process.env.DEFAULT_COMPANY_SLUG ?? "default";
  return getCompanyBySlug(slug);
}

export async function listCompaniesWithSpinCounts() {
  return convex.query(api.companies.listWithSpinCounts, {});
}

// The slug is derived here and deduped inside the mutation, where the
// check and the insert share one transaction.
export async function createCompany(name: string): Promise<Company> {
  return convex.mutation(api.companies.create, { name, slug: slugify(name) });
}

export async function getCompanyWithDetails(companyId: string) {
  return convex.query(api.companies.getWithDetails, { companyId: asCompanyId(companyId) });
}

export async function getFormFields(companyId: string): Promise<FormField[]> {
  const fields = await convex.query(api.formFields.listByCompany, {
    companyId: asCompanyId(companyId),
  });
  return fields.map((f) => toFormField({ ...f, id: f._id }));
}

export async function updateCompany(
  companyId: string,
  patch: Partial<Pick<Company, "name" | "isActive" | "askName" | "askPhone" | "gameType">>,
) {
  await convex.mutation(api.companies.update, { companyId: asCompanyId(companyId), ...patch });
}

// With an explicit offerId this resolves that offer whether or not it is
// paused; without one it falls back to the company's newest *active*
// offer. Both behaviours are carried over from the Instant version.
export async function getPublicWheelConfig(
  companyId: string,
  offerId?: string,
): Promise<PublicWheelConfig | null> {
  const config = await convex.query(api.offers.publicConfig, {
    companyId: asCompanyId(companyId),
    offerId: offerId ? asOfferId(offerId) : undefined,
  });
  if (!config) return null;

  return {
    ...config,
    prizes: config.prizes.map((p) => ({
      id: p.id,
      label: p.label,
      weight: p.weight,
      order: p.order,
      isWin: p.isWin,
      color: p.color ?? undefined,
      iconUrl: p.iconUrl ?? undefined,
    })),
    fields: config.fields.map(toFormField),
  };
}

export async function getOfferWithDetails(offerId: string) {
  return convex.query(api.offers.getWithDetails, { offerId: asOfferId(offerId) });
}
