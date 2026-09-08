import { NextRequest, NextResponse } from "next/server";
import { asOfferId, resolveCompanyAccess } from "@/lib/companies";
import { api, convex } from "@/lib/convex";

// Mints a short-lived Convex upload URL so a client can PUT the bytes
// straight to storage and then attach the resulting id via the sibling
// images route. Mobile uses this instead of multipart because a phone
// photo routinely exceeds the 4.5MB serverless request body cap.
export async function POST(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;

  const offer = await convex.query(api.offers.getConfigs, { offerId: asOfferId(offerId) });
  if (!offer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, offer.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const uploadUrl = await convex.mutation(api.files.generateUploadUrl, {});
  return NextResponse.json({ uploadUrl });
}
