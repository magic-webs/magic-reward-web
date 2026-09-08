import { NextRequest, NextResponse } from "next/server";
import { asOfferId, resolveCompanyAccess } from "@/lib/companies";
import { api, convex } from "@/lib/convex";
import { resolveStorageId } from "@/lib/uploadImage";

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

  const storageId = await resolveStorageId(req);
  if (!storageId) {
    return NextResponse.json({ error: "invalid_input", message: "No file provided." }, { status: 400 });
  }

  // The admin UI swaps the preview in from this url, so hand back the one the
  // mutation resolved rather than making the page refetch the whole offer.
  const result = await convex.mutation(api.offers.setImage, {
    offerId: asOfferId(offerId),
    kind,
    storageId,
  });

  return NextResponse.json({ ok: true, url: result?.url ?? null });
}
