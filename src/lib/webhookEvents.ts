// Client-safe half of the webhook model: the event catalogue, the payload
// shape, and a deterministic sample builder. Kept free of `crypto`,
// `next/server` and the admin DB so dashboard components can import it
// directly to render the payload preview. The delivery/signing side lives
// in lib/webhooks.ts.

// Ordered roughly by when they fire in a customer's journey. Ids are
// stable strings stored on webhooks.events — never rename one without a
// migration, or existing subscriptions silently stop matching.
export const WEBHOOK_EVENTS = [
  {
    id: "registration.created",
    label: "Registration created",
    description: "A customer submitted the signup form for the first time.",
  },
  {
    id: "spin.completed",
    label: "Spin completed",
    description: "A customer spun the wheel — fires for every result, win or not.",
  },
  {
    id: "prize.won",
    label: "Prize won",
    description: "The spin landed on a segment marked as a win.",
  },
  {
    id: "prize.lost",
    label: "No prize",
    description: "The spin landed on a segment that isn't a win.",
  },
] as const;

export type WebhookEventId = (typeof WEBHOOK_EVENTS)[number]["id"];

const EVENT_IDS = new Set<string>(WEBHOOK_EVENTS.map((e) => e.id));

export function isWebhookEventId(value: unknown): value is WebhookEventId {
  return typeof value === "string" && EVENT_IDS.has(value);
}

export interface WebhookCompany {
  id: string;
  slug: string;
  name: string;
}

export interface WebhookRegistration {
  id: string;
  name: string;
  phone: string;
  extraFields: Record<string, string>;
  createdAt: number;
}

export interface WebhookPrize {
  id: string;
  label: string;
  isWin: boolean;
}

export interface WebhookEnvelope {
  id: string;
  event: WebhookEventId;
  createdAt: number;
  company: WebhookCompany;
  data: {
    registration: WebhookRegistration;
    prize?: WebhookPrize;
  };
}

// Frozen so the rendered preview is byte-identical on server and client —
// a live Date.now() here would trip a hydration mismatch.
const SAMPLE_TIMESTAMP = 1_740_000_000_000;

// The payload shown in the dashboard's preview panel, and the one the
// "Send test" button actually delivers — identical in shape to a real
// event, so whatever a receiver builds against this keeps working live.
export function buildSamplePayload(
  event: WebhookEventId,
  company: WebhookCompany,
  overrides?: { id?: string; createdAt?: number },
): WebhookEnvelope {
  const createdAt = overrides?.createdAt ?? SAMPLE_TIMESTAMP;
  const registration: WebhookRegistration = {
    id: "spin_sample0000000000",
    name: "Jane Doe",
    phone: "+919876543210",
    extraFields: { email: "jane@example.com" },
    createdAt,
  };

  const envelope: WebhookEnvelope = {
    id: overrides?.id ?? "evt_sample000000000000",
    event,
    createdAt,
    company,
    data: { registration },
  };

  if (event !== "registration.created") {
    envelope.data.prize = {
      id: "prize_sample000000000",
      label: event === "prize.lost" ? "Better luck next time" : "20% off",
      isWin: event !== "prize.lost",
    };
  }

  return envelope;
}

// The headers every delivery carries, shown alongside the payload preview
// so a receiver knows exactly what to verify against.
export function sampleHeaders(event: WebhookEventId) {
  return {
    "Content-Type": "application/json",
    "User-Agent": "MagicReward-Webhooks/1",
    "X-Magic-Event": event,
    "X-Magic-Delivery": "evt_sample000000000000",
    "X-Magic-Timestamp": String(SAMPLE_TIMESTAMP),
    "X-Magic-Signature": "sha256=<hmac of `${timestamp}.${body}` with your signing secret>",
  };
}
