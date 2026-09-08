import { NextRequest, NextResponse } from "next/server";
import { asCompanyId, resolveCompanyAccess } from "@/lib/companies";
import { api, asPrizeId, convex } from "@/lib/convex";

interface PrizeInput {
  id?: string;
  label: string;
  weight: number;
  isWin: boolean;
  color?: string | null;
}

// The pre-offer company-level wheel. Saves the whole list in one Convex
// mutation: rows matched by id are updated, rows without one are created,
// and anything missing from the submitted array is deleted. `order` comes
// from array position.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  if (!(await resolveCompanyAccess(req, companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const input: PrizeInput[] = Array.isArray(body?.prizes) ? body.prizes : [];

  const cleaned = input
    .map((p) => ({
      id: typeof p.id === "string" ? p.id : undefined,
      label: typeof p.label === "string" ? p.label.trim() : "",
      weight: Number.isFinite(p.weight) ? Math.max(0, Number(p.weight)) : 0,
      isWin: Boolean(p.isWin),
      color: typeof p.color === "string" && p.color ? p.color : undefined,
    }))
    .filter((p) => p.label.length > 0);

  if (cleaned.length === 0) {
    return NextResponse.json(
      { error: "invalid_input", message: "At least one prize is required." },
      { status: 400 },
    );
  }

  await convex.mutation(api.prizes.replaceForCompany, {
    companyId: asCompanyId(companyId),
    prizes: cleaned.map((p) => ({ ...p, id: p.id ? asPrizeId(p.id) : undefined })),
  });

  return NextResponse.json({ ok: true });
}
