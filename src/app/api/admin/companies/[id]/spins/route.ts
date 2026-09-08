import { NextRequest, NextResponse } from "next/server";
import { asCompanyId, resolveCompanyAccess } from "@/lib/companies";
import { api, convex } from "@/lib/convex";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  if (!(await resolveCompanyAccess(req, companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // spins.listByCompany already resolves each row's offer title and type,
  // so the offer lookup that used to happen here is gone.
  const spins = await convex.query(api.spins.listByCompany, {
    companyId: asCompanyId(companyId),
  });

  return NextResponse.json({ spins });
}
