import { NextRequest, NextResponse } from "next/server";
import { asCompanyId, resolveCompanyAccess, slugifyFieldKey } from "@/lib/companies";
import { api, asFieldId, convex } from "@/lib/convex";

interface FieldInput {
  id?: string;
  label: string;
  required: boolean;
}

// The pre-offer company-level question list. Deliberately still ignores
// `type` and `options`: nothing reads company-level fields on the player
// side any more, so accepting them here would imply they take effect.
// New questions belong to an offer.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  if (!(await resolveCompanyAccess(req, companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const input: FieldInput[] = Array.isArray(body?.fields) ? body.fields : [];

  const cleaned = input
    .map((f) => ({
      id: typeof f.id === "string" ? f.id : undefined,
      label: typeof f.label === "string" ? f.label.trim() : "",
      required: Boolean(f.required),
    }))
    .filter((f) => f.label.length > 0);

  await convex.mutation(api.formFields.replaceForCompany, {
    companyId: asCompanyId(companyId),
    fields: cleaned.map((f) => ({
      id: f.id ? asFieldId(f.id) : undefined,
      label: f.label,
      required: f.required,
      keyBase: slugifyFieldKey(f.label),
    })),
  });

  return NextResponse.json({ ok: true });
}
