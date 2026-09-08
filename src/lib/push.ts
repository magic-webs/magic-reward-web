import { init, id as generateId } from "@instantdb/admin";
import schema from "@/instant.schema";
import {
  WEBHOOK_EVENTS,
  isWebhookEventId,
  type WebhookEnvelope,
  type WebhookEventId,
} from "@/lib/webhookEvents";

const adminDb = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
  schema,
});

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

function toRecord(row: {
  id: string;
  token: string;
  role: string;
  companyId?: string | null;
  events?: unknown;
  platform?: string | null;
  deviceName?: string | null;
  createdAt: number;
  lastSeenAt: number;
}): DeviceRecord {
  return {
    id: row.id,
    token: row.token,
    role: row.role === "admin" ? "admin" : "company",
    companyId: row.companyId ?? null,
    events: toEventIds(row.events),
    platform: row.platform ?? null,
    deviceName: row.deviceName ?? null,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
  };
}

export async function findDevice(token: string): Promise<DeviceRecord | null> {
  const { deviceTokens } = await adminDb.query({
    deviceTokens: { $: { where: { token } } },
  });
  const row = deviceTokens[0];
  return row ? toRecord(row) : null;
}

// Upsert: the app re-registers on every launch because Expo can reissue a
// token at any time, and the same physical device may switch between an
// admin and a company login.
export async function registerDevice(params: {
  token: string;
  role: DeviceRole;
  companyId: string | null;
  events?: WebhookEventId[];
  platform?: string | null;
  deviceName?: string | null;
}): Promise<DeviceRecord> {
  const now = Date.now();
  const existing = await findDevice(params.token);

  // Only replace the subscription list when the caller actually sent one —
  // a plain re-register on launch must not silently undo the user's
  // choices in Settings.
  const events = params.events ?? existing?.events ?? DEFAULT_DEVICE_EVENTS;

  const patch = {
    token: params.token,
    role: params.role,
    companyId: params.companyId ?? undefined,
    events,
    platform: params.platform ?? undefined,
    deviceName: params.deviceName ?? undefined,
    lastSeenAt: now,
  };

  if (existing) {
    await adminDb.transact(adminDb.tx.deviceTokens[existing.id].update(patch));
    // `patch` carries `undefined` where a field should be left alone (which
    // is how InstantDB reads it), so the record handed back is rebuilt from
    // the merged values rather than spread straight from the patch.
    return {
      ...existing,
      role: params.role,
      companyId: params.companyId ?? null,
      events,
      platform: params.platform ?? existing.platform,
      deviceName: params.deviceName ?? existing.deviceName,
      lastSeenAt: now,
    };
  }

  const deviceId = generateId();
  await adminDb.transact(
    adminDb.tx.deviceTokens[deviceId].update({ ...patch, createdAt: now }),
  );
  return {
    id: deviceId,
    token: params.token,
    role: params.role,
    companyId: params.companyId ?? null,
    events,
    platform: params.platform ?? null,
    deviceName: params.deviceName ?? null,
    createdAt: now,
    lastSeenAt: now,
  };
}

export async function updateDeviceEvents(
  token: string,
  events: WebhookEventId[],
): Promise<DeviceRecord | null> {
  const existing = await findDevice(token);
  if (!existing) return null;
  await adminDb.transact(
    adminDb.tx.deviceTokens[existing.id].update({ events, lastSeenAt: Date.now() }),
  );
  return { ...existing, events };
}

export async function unregisterDevice(token: string): Promise<void> {
  const existing = await findDevice(token);
  if (!existing) return;
  await adminDb.transact(adminDb.tx.deviceTokens[existing.id].delete());
}

async function deleteTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const { deviceTokens } = await adminDb.query({
    deviceTokens: { $: { where: { token: { $in: tokens } } } },
  });
  if (deviceTokens.length === 0) return;
  await adminDb.transact(deviceTokens.map((d) => adminDb.tx.deviceTokens[d.id].delete()));
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
    const [{ companies }, { deviceTokens }] = await Promise.all([
      adminDb.query({ companies: { $: { where: { id: companyId } } } }),
      adminDb.query({
        deviceTokens: { $: { where: { or: [{ companyId }, { role: "admin" }] } } },
      }),
    ]);

    const company = companies[0];
    if (!company) return;

    const targets = deviceTokens
      .map(toRecord)
      .filter((d) => d.events.includes(event) && isExpoPushToken(d.token));
    if (targets.length === 0) return;

    const message = buildMessage(event, company.name, data);
    if (!message) return;

    const payload = targets.map((d) => ({
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
    await deleteTokens(dead);
  } catch {
    // Deliberately silent, as above.
  }
}
