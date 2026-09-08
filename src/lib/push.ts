import { api, asCompanyId, convex } from "@/lib/convex";
import {
  WEBHOOK_EVENTS,
  isWebhookEventId,
  type WebhookEnvelope,
  type WebhookEventId,
} from "@/lib/webhookEvents";

// Expo relays to APNs/FCM for us, so the app never handles either
// directly — it just hands us the ExponentPushToken it was issued.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Expo rejects anything larger in a single call.
const MAX_PER_REQUEST = 100;

export type DeviceRole = "admin" | "company";

export interface DeviceRecord {
  id: string;
  token: string;
  role: DeviceRole;
  companyId: string | null;
  events: WebhookEventId[];
  platform: string | null;
  deviceName: string | null;
  createdAt: number;
  lastSeenAt: number;
}

// Everything is on by default: a device that just opted into notifications
// wants them, and the app's settings screen is where it narrows them down.
export const DEFAULT_DEVICE_EVENTS: WebhookEventId[] = WEBHOOK_EVENTS.map((e) => e.id);

export function toEventIds(value: unknown): WebhookEventId[] {
  return Array.isArray(value) ? value.filter(isWebhookEventId) : [];
}

// Expo's own format check. Worth doing before we store anything: a
// malformed token is a permanent delivery failure that would otherwise sit
// in the table forever.
export function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("ExponentPushToken[") || value.startsWith("ExpoPushToken[")) &&
    value.endsWith("]")
  );
}

export async function findDevice(token: string): Promise<DeviceRecord | null> {
  const device = await convex.query(api.devices.getByToken, { token });
  return device ? { ...device, events: toEventIds(device.events) } : null;
}

// Upsert: the app re-registers on every launch because Expo can reissue a
// token at any time, and the same physical device may switch between an
// admin and a company login. Omitting `events` leaves whatever the user
// already chose in Settings alone.
export async function registerDevice(params: {
  token: string;
  role: DeviceRole;
  companyId: string | null;
  events?: WebhookEventId[];
  platform?: string | null;
  deviceName?: string | null;
}): Promise<DeviceRecord | null> {
  const device = await convex.mutation(api.devices.upsert, {
    token: params.token,
    role: params.role,
    companyId: params.companyId ? asCompanyId(params.companyId) : undefined,
    events: params.events,
    platform: params.platform ?? undefined,
    deviceName: params.deviceName ?? undefined,
    defaultEvents: DEFAULT_DEVICE_EVENTS,
  });
  return device ? { ...device, events: toEventIds(device.events) } : null;
}

export async function updateDeviceEvents(
  token: string,
  events: WebhookEventId[],
): Promise<DeviceRecord | null> {
  const device = await convex.mutation(api.devices.updateEvents, { token, events });
  return device ? { ...device, events: toEventIds(device.events) } : null;
}

export async function unregisterDevice(token: string): Promise<void> {
  await convex.mutation(api.devices.remove, { token });
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

// Copy for each event. Kept here rather than in webhookEvents.ts because a
// webhook payload is machine-facing and this is a phone lockscreen: it has
// to be short, and to say the customer's name where there is one.
function buildMessage(
  event: WebhookEventId,
  companyName: string,
  data: WebhookEnvelope["data"],
): { title: string; body: string } | null {
  const who = data.registration?.name?.trim() || "Someone";

  switch (event) {
    case "registration.created":
      return { title: `New registration · ${companyName}`, body: `${who} just signed up.` };
    case "spin.completed":
      return {
        title: `Spin completed · ${companyName}`,
        body: data.prize ? `${who} played and got ${data.prize.label}.` : `${who} just played.`,
      };
    case "prize.won":
      return {
        title: `Prize won · ${companyName}`,
        body: data.prize ? `${who} won ${data.prize.label}.` : `${who} won a prize.`,
      };
    case "prize.lost":
      return { title: `No prize · ${companyName}`, body: `${who} played and didn't win.` };
    default:
      return null;
  }
}

// Sends to every device subscribed to `event` that is allowed to see this
// company: its own company-scoped devices, plus every admin device.
// Swallows everything for the same reason dispatchWebhookEvent does — a
// customer registering must never fail because a push could not go out.
export async function dispatchPushEvent(
  companyId: string,
  event: WebhookEventId,
  data: WebhookEnvelope["data"],
): Promise<void> {
  try {
    const [company, targets] = await Promise.all([
      convex.query(api.companies.getById, { companyId: asCompanyId(companyId) }),
      convex.query(api.devices.listTargets, {
        companyId: asCompanyId(companyId),
        event,
      }),
    ]);

    if (!company) return;

    const valid = targets.filter((d) => isExpoPushToken(d.token));
    if (valid.length === 0) return;

    const message = buildMessage(event, company.name, data);
    if (!message) return;

    const payload = valid.map((d) => ({
      to: d.token,
      title: message.title,
      body: message.body,
      sound: "default" as const,
      // Read by the app to route the tap to the right screen.
      data: {
        event,
        companyId,
        companySlug: company.slug,
        registrationId: data.registration?.id ?? null,
      },
    }));

    const dead: string[] = [];

    for (let i = 0; i < payload.length; i += MAX_PER_REQUEST) {
      const batch = payload.slice(i, i + MAX_PER_REQUEST);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(batch),
      });

      if (!res.ok) continue;
      const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
      const tickets = json?.data ?? [];

      // A ticket is positional, so index i of the response is index i of
      // the batch we sent.
      tickets.forEach((ticket, idx) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          const token = batch[idx]?.to;
          if (token) dead.push(token);
        }
      });
    }

    // The app was uninstalled or the token was reissued — it will never
    // deliver again, so drop it rather than retrying forever.
    if (dead.length > 0) await convex.mutation(api.devices.removeMany, { tokens: dead });
  } catch {
    // Deliberately silent, as above.
  }
}
