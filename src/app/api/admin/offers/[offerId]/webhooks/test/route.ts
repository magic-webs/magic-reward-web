import { NextRequest, NextResponse } from "next/server";
import { asOfferId, resolveCompanyAccess } from "@/lib/companies";
import { api, asWebhookId, convex } from "@/lib/convex";
import {
  buildSampleEnvelope,
  deliverWebhook,
  isValidWebhookUrl,
  isWebhookEventId,
  listOfferWebhooks,
  type WebhookEventId,
} from "@/lib/webhooks";

// Fires one sample delivery at a URL and hands the whole HTTP exchange
// back to the dashboard so it can be shown verbatim — status, timing,
// headers and body. Accepts a raw `url` (so an endpoint can be tried
// before it's ever saved) and, optionally, the id of a saved endpoint to
// sign with its real secret and record the outcome against.
export async function POST(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;

  const offer = await convex.query(api.offers.getConfigs, { offerId: asOfferId(offerId) });
  if (!offer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await resolveCompanyAccess(req, offer.companyId))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const company = await convex.query(api.companies.getById, { companyId: offer.companyId });
  if (!company) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const event: WebhookEventId = isWebhookEventId(body?.event) ? body.event : "registration.created";
  const webhookId = typeof body?.webhookId === "string" ? body.webhookId : null;

  if (!isValidWebhookUrl(url)) {
    return NextResponse.json(
      { error: "invalid_input", message: "Enter a valid http(s) URL first." },
      { status: 400 },
    );
  }

  // An unsaved endpoint has no secret yet, so sign with a throwaway one —
  // the receiver can't verify it, but the round trip still proves the URL
  // is reachable and shows exactly what it returns.
  const saved = webhookId
    ? (await listOfferWebhooks(offerId)).find((w) => w.id === webhookId)
    : undefined;
  const secret = saved?.secret ?? "whsec_unsaved-endpoint-test";

  const envelope = buildSampleEnvelope(event, {
    id: company.id,
    slug: company.slug,
    name: company.name,
  });
  const result = await deliverWebhook({ url, secret, envelope });

  if (saved) {
    await convex.mutation(api.webhooks.recordDelivery, {
      webhookId: asWebhookId(saved.id),
      lastStatus: result.status ?? 0,
      lastError: result.error ?? "",
      lastAttemptAt: Date.now(),
    });
  }

  return NextResponse.json({ result, sentPayload: envelope });
}
