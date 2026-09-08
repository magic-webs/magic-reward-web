import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyAccess } from "@/lib/companies";
import { api, convex } from "@/lib/convex";

// Company-scoped counterpart of the offer upload-url route — used for the
// company wheel artwork and for prize icons, both of which the mobile app
// uploads straight to storage rather than through a route.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  if (!(await resolveCompanyAccess(req, companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const uploadUrl = await convex.mutation(api.files.generateUploadUrl, {});
  return NextResponse.json({ uploadUrl });
}
