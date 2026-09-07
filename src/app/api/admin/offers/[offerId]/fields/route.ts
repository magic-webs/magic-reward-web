import { NextRequest, NextResponse } from "next/server";
import { id as generateId } from "@instantdb/admin";
import { adminDb, getOfferWithDetails, resolveCompanyAccess, slugifyFieldKey } from "@/lib/companies";
import { fieldTypeMeta, normalizeFieldOptions, normalizeFieldType } from "@/lib/formFields";

interface FieldInput {
  id?: string;
  label: string;
  required: boolean;
  type?: string;
  options?: unknown;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const offer = await getOfferWithDetails(offerId);
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

  const existing = offer.formFields ?? [];
  const existingById = new Map(existing.map((f) => [f.id, f]));
  const keptIds = new Set(cleaned.filter((f) => f.id).map((f) => f.id!));
  const toDelete = existing.filter((f) => !keptIds.has(f.id)).map((f) => f.id);

  const usedKeys = new Set(existing.filter((f) => keptIds.has(f.id)).map((f) => f.key));

  const txs = [
    ...toDelete.map((existingId) => adminDb.tx.formFields[existingId].delete()),
    ...cleaned.map((f, order) => {
      const prior = f.id ? existingById.get(f.id) : undefined;
      if (prior) {
        return adminDb.tx.formFields[prior.id].update({
          label: f.label,
          required: f.required,
          type: f.type,
          options: f.options,
          order,
          key: prior.key,
        });
      }

      const base = slugifyFieldKey(f.label);
      let key = base;
      let suffix = 2;
      while (usedKeys.has(key)) {
        key = `${base}-${suffix}`;
        suffix += 1;
      }
      usedKeys.add(key);

      const fieldId = generateId();
      return adminDb.tx.formFields[fieldId]
        .update({
          label: f.label,
          required: f.required,
          type: f.type,
          options: f.options,
          order,
          key,
          companyId: offer.companyId,
          offerId,
          createdAt: Date.now()
        })
        .link({ offer: offerId })
        .link({ company: offer.companyId });
    }),
  ];

  await adminDb.transact(txs);
  return NextResponse.json({ ok: true });
}
