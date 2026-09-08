import { NextRequest, NextResponse } from "next/server";
import { asCompanyId, resolveCompanyAccess } from "@/lib/companies";
import { api, convex } from "@/lib/convex";
import { uploadToStorage } from "@/lib/uploadImage";

// Re-uploading replaces the previous image: companies.setImage deletes the
// blob it swaps out, so nothing is orphaned in storage.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  if (!(await resolveCompanyAccess(req, companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "invalid_input", message: "No file provided." }, { status: 400 });
  }

  const storageId = await uploadToStorage(file);
  await convex.mutation(api.companies.setImage, {
    companyId: asCompanyId(companyId),
    kind: "bg",
    storageId,
  });

  return NextResponse.json({ ok: true });
}
