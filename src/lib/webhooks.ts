import { createHmac, randomBytes } from "crypto";
import { after } from "next/server";
import { adminDb } from "@/lib/companies";
import {
  buildSamplePayload,
  isWebhookEventId,
  type WebhookCompany,
  type WebhookEnvelope,
  type WebhookEventId,
} from "@/lib/webhookEvents";

export * from "@/lib/webhookEvents";

export interface WebhookRecord {
  id: string;
  url: string;
  secret: string;
  events: WebhookEventId[];
  isActive: boolean;
  createdAt: number;
  lastStatus: number | null;
  lastError: string | null;
  lastAttemptAt: number | null;
}

export interface DeliveryResult {
  ok: boolean;
  status: number | null;
  statusText: string | null;
  durationMs: number;
  responseBody: string | null;
  responseHeaders: Record<string, string>;
  error: string | null;
}

const DELIVERY_TIMEOUT_MS = 8000;
// Enough to show the receiver's error message in the dashboard without
// letting a chatty endpoint bloat what we hold in memory or persist.
const MAX_CAPTURED_BODY = 2000;

export function generateWebhookSecret() {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

// Signs `${timestamp}.${body}` rather than the body alone so a captured
// delivery can't be replayed later against the same endpoint — the
// receiver rejects timestamps outside its tolerance window.
export function signWebhookPayload(secret: string, timestamp: number, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function isValidWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function buildEnvelope(
  event: WebhookEventId,
  company: WebhookCompany,
  data: WebhookEnvelope["data"],
): WebhookEnvelope {
  return {
    id: `evt_${randomBytes(12).toString("base64url")}`,
    event,
    createdAt: Date.now(),
    company,
    data,
  };
}

// A real, freshly-stamped delivery of the documented sample payload —
// what the "Send test" button actually sends. The preview panel renders
// the frozen version straight from lib/webhookEvents.ts.
export function buildSampleEnvelope(event: WebhookEventId, company: WebhookCompany): WebhookEnvelope {
  return buildSamplePayload(event, company, {
    id: `evt_${randomBytes(12).toString("base64url")}`,
    createdAt: Date.now(),
  });
}

async function readCappedText(res: Response): Promise<string | null> {
  try {
    const text = await res.text();
    return text.length > MAX_CAPTURED_BODY ? `${text.slice(0, MAX_CAPTURED_BODY)}…` : text;
  } catch {
    return null;
  }
}

// Posts one envelope to one endpoint and reports exactly what came back.
// Never throws — a receiver being down is an expected outcome here, not an
// error in our own request path.
export async function deliverWebhook(params: {
  url: string;
  secret: string;
  envelope: WebhookEnvelope;
}): Promise<DeliveryResult> {
  const { url, secret, envelope } = params;
  const body = JSON.stringify(envelope, null, 2);
  const timestamp = Date.now();
  const startedAt = Date.now();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MagicReward-Webhooks/1",
        "X-Magic-Event": envelope.event,
        "X-Magic-Delivery": envelope.id,
        "X-Magic-Timestamp": String(timestamp),
        "X-Magic-Signature": `sha256=${signWebhookPayload(secret, timestamp, body)}`,
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      redirect: "follow",
    });

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText || null,
      durationMs: Date.now() - startedAt,
      responseBody: await readCappedText(res),
      responseHeaders,
      error: res.ok ? null : `Endpoint responded with ${res.status}.`,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "TimeoutError"
          ? `No response within ${DELIVERY_TIMEOUT_MS / 1000}s.`
          : err.message
        : "Request failed.";
    return {
      ok: false,
      status: null,
      statusText: null,
      durationMs: Date.now() - startedAt,
      responseBody: null,
      responseHeaders: {},
      error: message,
    };
  }
}

function toEventIds(value: unknown): WebhookEventId[] {
  return Array.isArray(value) ? value.filter(isWebhookEventId) : [];
}

export async function listWebhooks(companyId: string): Promise<WebhookRecord[]> {
  const { webhooks } = await adminDb.query({
    webhooks: { $: { where: { companyId }, order: { createdAt: "asc" } } },
  });
  return webhooks.map((w) => ({
    id: w.id,
    url: w.url,
    secret: w.secret,
    events: toEventIds(w.events),
    isActive: w.isActive,
    createdAt: w.createdAt,
    lastStatus: w.lastStatus ?? null,
    lastError: w.lastError ?? null,
    lastAttemptAt: w.lastAttemptAt ?? null,
  }));
}

// Sends `event` to every active endpoint of `companyId` subscribed to it,
// then records each outcome. Deliberately swallows everything: a customer
// spinning the wheel must never see an error because someone's CRM is
// down.
export async function dispatchWebhookEvent(
  companyId: string,
  event: WebhookEventId,
  data: WebhookEnvelope["data"],
): Promise<void> {
  try {
    const { companies } = await adminDb.query({ companies: { $: { where: { id: companyId } } } });
    const company = companies[0];
    if (!company) return;

    const subscribed = (await listWebhooks(companyId)).filter(
      (w) => w.isActive && w.events.includes(event),
    );
    if (subscribed.length === 0) return;

    const envelope = buildEnvelope(
      event,
      { id: company.id, slug: company.slug, name: company.name },
      data,
    );

    const results = await Promise.all(
      subscribed.map(async (w) => ({
        id: w.id,
        result: await deliverWebhook({ url: w.url, secret: w.secret, envelope }),
      })),
    );

    await adminDb.transact(
      results.map(({ id, result }) =>
        adminDb.tx.webhooks[id].update({
          lastStatus: result.status ?? 0,
          lastError: result.error ?? "",
          lastAttemptAt: Date.now(),
        }),
      ),
    );
  } catch {
    // Delivery is strictly best-effort — never surface it to the caller.
  }
}

// Queues an event to go out *after* the response has been sent, so a slow
// or unreachable receiver never adds latency to a customer registering or
// spinning. Falls back to a floating promise if we're somehow outside a
// request scope, where `after` isn't available.
export function scheduleWebhookEvent(
  companyId: string,
  event: WebhookEventId,
  data: WebhookEnvelope["data"],
): void {
  const run = () => dispatchWebhookEvent(companyId, event, data);
  try {
    after(run);
  } catch {
    void run();
  }
}
