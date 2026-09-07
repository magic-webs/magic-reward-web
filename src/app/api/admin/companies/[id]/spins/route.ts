import { NextRequest, NextResponse } from "next/server";
import { adminDb, resolveCompanyAccess } from "@/lib/companies";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  if (!(await resolveCompanyAccess(req, companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { spins, offers } = await adminDb.query({
    spins: { $: { where: { companyId }, order: { createdAt: "desc" } } },
    offers: { $: { where: { companyId } } },
  });

  // registerSpin stores the plain `offerId` field and never populates the
  // `offerSpins` link, so a nested query would come back empty — resolve
  // each spin's offer through this map instead.
  const offersById = new Map(offers.map((o) => [o.id, o]));

  return NextResponse.json({
    spins: spins.map((s) => {
      const offer = s.offerId ? offersById.get(s.offerId) : undefined;
      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        prizeLabel: s.prizeLabel ?? null,
        extraFields: s.extraFields ?? {},
        createdAt: s.createdAt,
        // null for rows registered before offers existed.
        offerId: s.offerId ?? null,
        offerTitle: offer?.title ?? null,
        offerType: offer?.type ?? null,
      };
    }),
  });
}
