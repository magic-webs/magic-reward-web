import { NextRequest, NextResponse } from "next/server";
import { asOfferId, resolveCompanyAccess, toFormField } from "@/lib/companies";
import { api, convex } from "@/lib/convex";
import { normalizeFomoConfig } from "@/lib/fomo";
import { normalizeEmbedConfig } from "@/lib/embed";

export async function GET(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const offer = await convex.query(api.offers.getWithDetails, { offerId: asOfferId(offerId) });
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
    event: offer.event,
    isActive: offer.isActive,
    askName: offer.askName,
    askPhone: offer.askPhone,
    wheelImageUrl: offer.wheelImageUrl,
    bgImageUrl: offer.bgImageUrl,
    pinImageUrl: offer.pinImageUrl,
    // Normalized on the way out as well as in, so an offer created before
    // these fields existed still hands the admin a complete object to edit.
    fomoConfig: normalizeFomoConfig(offer.fomoConfig),
    embedConfig: normalizeEmbedConfig(offer.embedConfig),
    prizes: offer.prizes,
    fields: offer.fields.map((f) => ({ ...toFormField(f), order: f.order })),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;

  const offer = await convex.query(api.offers.getConfigs, { offerId: asOfferId(offerId) });
  if (!offer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, offer.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  // Only fields actually present are sent: the mutation treats an absent
  // one as "leave alone", matching how this route always behaved.
  const patch: Record<string, unknown> = {};
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

  await convex.mutation(api.offers.update, { offerId: asOfferId(offerId), ...patch });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;

  const offer = await convex.query(api.offers.getConfigs, { offerId: asOfferId(offerId) });
  if (!offer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, offer.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Convex has no cascade, so offers.remove clears the offer's prizes,
  // questions, webhooks and artwork itself — and unlinks its spins rather
  // than deleting them, so registration history survives.
  await convex.mutation(api.offers.remove, { offerId: asOfferId(offerId) });
  return NextResponse.json({ ok: true });
}
