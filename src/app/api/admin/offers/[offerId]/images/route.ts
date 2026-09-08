import { NextRequest, NextResponse } from "next/server";
import { asOfferId, resolveCompanyAccess } from "@/lib/companies";
import { api, convex } from "@/lib/convex";
import { uploadToStorage } from "@/lib/uploadImage";

export async function POST(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;

  const offer = await convex.query(api.offers.getConfigs, { offerId: asOfferId(offerId) });
  if (!offer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, offer.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const kind = req.nextUrl.searchParams.get("kind");
  if (kind !== "wheel" && kind !== "bg" && kind !== "pin") {
    return NextResponse.json(
      { error: "invalid_input", message: "Invalid image kind. Must be wheel, bg, or pin." },
      { status: 400 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "invalid_input", message: "No file provided." }, { status: 400 });
  }

  const storageId = await uploadToStorage(file);
  await convex.mutation(api.offers.setImage, { offerId: asOfferId(offerId), kind, storageId });

  return NextResponse.json({ ok: true });
}
