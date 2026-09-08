import { NextRequest, NextResponse } from "next/server";
import { asCompanyId, resolveCompanyAccess } from "@/lib/companies";
import { api, convex } from "@/lib/convex";
import { resolveStorageId } from "@/lib/uploadImage";

// Re-uploading replaces the previous image: companies.setImage deletes the
// blob it swaps out, so nothing is orphaned in storage.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  if (!(await resolveCompanyAccess(req, companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const storageId = await resolveStorageId(req);
  if (!storageId) {
    return NextResponse.json({ error: "invalid_input", message: "No file provided." }, { status: 400 });
  }

  const result = await convex.mutation(api.companies.setImage, {
    companyId: asCompanyId(companyId),
    kind: "bg",
    storageId,
  });

  return NextResponse.json({ ok: true, url: result?.url ?? null });
}
