import { NextRequest, NextResponse } from "next/server";
import { asOfferId, resolveCompanyAccess, slugifyFieldKey } from "@/lib/companies";
import { api, asFieldId, convex } from "@/lib/convex";
import { fieldTypeMeta, normalizeFieldOptions, normalizeFieldType } from "@/lib/formFields";

interface FieldInput {
  id?: string;
  label: string;
  required: boolean;
  type?: string;
  options?: unknown;
}

// Replaces the whole question list. The delete/update/insert and the key
// deduping all happen inside one Convex mutation, so a half-applied save is
// no longer possible; validation stays here, where the error copy lives.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;

  const offer = await convex.query(api.offers.getConfigs, { offerId: asOfferId(offerId) });
  if (!offer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, offer.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const input: FieldInput[] = Array.isArray(body?.fields) ? body.fields : [];

  const cleaned = input
    .map((f) => ({
      id: typeof f.id === "string" ? f.id : undefined,
      label: typeof f.label === "string" ? f.label.trim() : "",
      required: Boolean(f.required),
      type: normalizeFieldType(f.type),
      options: normalizeFieldOptions(f.options),
    }))
    .filter((f) => f.label.length > 0);

  // A dropdown/radio/checkbox question with nothing to pick from would
  // render as an unanswerable dead end on the offer page, so it is
  // rejected here rather than silently saved.
  const optionless = cleaned.find((f) => fieldTypeMeta(f.type).hasOptions && f.options.length === 0);
  if (optionless) {
    return NextResponse.json(
      {
        error: "invalid_input",
        message: `"${optionless.label}" is a ${fieldTypeMeta(optionless.type).label.toLowerCase()} question — add at least one choice.`,
      },
      { status: 400 },
    );
  }

  await convex.mutation(api.formFields.replaceForOffer, {
    offerId: asOfferId(offerId),
    companyId: offer.companyId,
    fields: cleaned.map((f) => ({
      id: f.id ? asFieldId(f.id) : undefined,
      label: f.label,
      required: f.required,
      type: f.type,
      options: f.options,
      keyBase: slugifyFieldKey(f.label),
    })),
  });

  return NextResponse.json({ ok: true });
}
