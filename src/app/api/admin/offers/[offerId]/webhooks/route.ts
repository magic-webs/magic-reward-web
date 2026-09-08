import { NextRequest, NextResponse } from "next/server";
import { asOfferId, resolveCompanyAccess } from "@/lib/companies";
import { api, convex } from "@/lib/convex";
import {
  generateWebhookSecret,
  isValidWebhookUrl,
  isWebhookEventId,
  listOfferWebhooks,
  replaceOfferWebhooks,
  WEBHOOK_EVENTS,
  type WebhookEventId,
} from "@/lib/webhooks";

interface WebhookInput {
  id?: string;
  url: string;
  events: string[];
  isActive: boolean;
  // Set by the "Regenerate" button — swaps in a fresh signing secret,
  // immediately invalidating signatures the receiver was verifying with.
  regenerateSecret?: boolean;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;

  const offer = await convex.query(api.offers.getConfigs, { offerId: asOfferId(offerId) });
  if (!offer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, offer.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    webhooks: await listOfferWebhooks(offerId),
    availableEvents: WEBHOOK_EVENTS,
  });
}

// Saves this offer's whole endpoint list: rows matched by id are updated
// (keeping their existing secret unless regeneration was asked for), rows
// without an id are created with a fresh secret, and any row not present
// in the submitted array is deleted.
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
  const input: WebhookInput[] = Array.isArray(body?.webhooks) ? body.webhooks : [];

  const cleaned = input.map((w) => ({
    id: typeof w.id === "string" ? w.id : undefined,
    url: typeof w.url === "string" ? w.url.trim() : "",
    events: (Array.isArray(w.events) ? w.events : []).filter(isWebhookEventId) as WebhookEventId[],
    isActive: Boolean(w.isActive),
    regenerateSecret: Boolean(w.regenerateSecret),
  }));

  for (const w of cleaned) {
    if (!isValidWebhookUrl(w.url)) {
      return NextResponse.json(
        { error: "invalid_input", message: `"${w.url || "(empty)"}" isn't a valid http(s) URL.` },
        { status: 400 },
      );
    }
    if (w.events.length === 0) {
      return NextResponse.json(
        { error: "invalid_input", message: "Every endpoint needs at least one event selected." },
        { status: 400 },
      );
    }
  }

  // Secrets are minted here: Convex's function runtime has no node crypto.
  // A new row always gets one; an existing row only when asked, so the
  // secret a receiver is already verifying with survives an edit.
  const webhooks = await replaceOfferWebhooks(
    offerId,
    offer.companyId,
    cleaned.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      isActive: w.isActive,
      secret: !w.id || w.regenerateSecret ? generateWebhookSecret() : undefined,
    })),
  );

  return NextResponse.json({ ok: true, webhooks });
}
