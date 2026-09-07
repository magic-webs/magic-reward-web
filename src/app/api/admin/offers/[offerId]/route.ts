import { NextRequest, NextResponse } from "next/server";
import { adminDb, getOfferWithDetails, resolveCompanyAccess, toFormField } from "@/lib/companies";
import { normalizeFomoConfig } from "@/lib/fomo";
import { normalizeEmbedConfig } from "@/lib/embed";

export async function GET(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const offer = await getOfferWithDetails(offerId);
  if (!offer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, offer.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: offer.id,
    title: offer.title,
    type: offer.type,
    event: offer.event ?? "none",
    isActive: offer.isActive,
    askName: offer.askName,
    askPhone: offer.askPhone,
    wheelImageUrl: offer.wheelImage?.url ?? null,
    bgImageUrl: offer.bgImage?.url ?? null,
    pinImageUrl: offer.pinImage?.url ?? null,
    // Normalized on the way out as well as in, so an offer created before
    // these fields existed still hands the admin a complete object to edit.
    fomoConfig: normalizeFomoConfig(offer.fomoConfig),
    embedConfig: normalizeEmbedConfig(offer.embedConfig),
    prizes: (offer.prizes ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        id: p.id,
        label: p.label,
        weight: p.weight,
        color: p.color ?? null,
        order: p.order,
        isWin: p.isWin,
        iconUrl: p.icon?.url ?? null,
      })),
    fields: (offer.formFields ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((f) => ({
        ...toFormField(f),
        order: f.order,
      })),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  
  const { offers } = await adminDb.query({ offers: { $: { where: { id: offerId } } } });
  const offer = offers[0];
  if (!offer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, offer.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const patch: Record<string, any> = {};
  if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body?.type === "string") patch.type = body.type;
  if (typeof body?.event === "string") patch.event = body.event;
  if (typeof body?.isActive === "boolean") patch.isActive = body.isActive;
  if (typeof body?.askName === "boolean") patch.askName = body.askName;
  if (typeof body?.askPhone === "boolean") patch.askPhone = body.askPhone;
  // Both blobs are normalized before they are stored, so nothing a client
  // sends can put an out-of-range interval or an unsafe click selector in
  // front of a visitor.
  if (body?.fomoConfig) patch.fomoConfig = normalizeFomoConfig(body.fomoConfig);
  if (body?.embedConfig) patch.embedConfig = normalizeEmbedConfig(body.embedConfig);

  await adminDb.transact(adminDb.tx.offers[offerId].update(patch));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  
  const { offers } = await adminDb.query({ offers: { $: { where: { id: offerId } } } });
  const offer = offers[0];
  if (!offer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, offer.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await adminDb.transact(adminDb.tx.offers[offerId].delete());
  return NextResponse.json({ ok: true });
}
