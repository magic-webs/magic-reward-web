import { NextRequest, NextResponse } from "next/server";
import { asCompanyId, resolveCompanyAccess } from "@/lib/companies";
import { api, convex } from "@/lib/convex";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  if (!(await resolveCompanyAccess(req, companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const offers = await convex.query(api.offers.listByCompany, {
    companyId: asCompanyId(companyId),
  });
  return NextResponse.json({ offers });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  if (!(await resolveCompanyAccess(req, companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const type = typeof body?.type === "string" ? body.type.trim() : "wheel";
  const event = typeof body?.event === "string" ? body.event.trim() : "none";

  if (!title) {
    return NextResponse.json(
      { error: "invalid_input", message: "Offer title is required." },
      { status: 400 },
    );
  }

  // Created inactive — see the note on offers.create.
  const offer = await convex.mutation(api.offers.create, {
    companyId: asCompanyId(companyId),
    title,
    type,
    event,
  });

  return NextResponse.json({ offer });
}
