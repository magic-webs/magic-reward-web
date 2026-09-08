import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/adminAuth";
import { resolveCompanyAccess } from "@/lib/companies";
import { isWebhookEventId, type WebhookEventId } from "@/lib/webhookEvents";
import {
  findDevice,
  isExpoPushToken,
  registerDevice,
  unregisterDevice,
  updateDeviceEvents,
} from "@/lib/push";

// A company session can only be verified against a companyId (see
// resolveCompanyAccess), so the app sends its own — which it already has
// on the session. No companyId at all means it must be an admin.
async function resolveCaller(
  req: NextRequest,
  companyId: string | null,
): Promise<{ role: "admin" | "company"; companyId: string | null } | null> {
  if (!companyId) {
    return isAdminRequestAuthenticated(req) ? { role: "admin", companyId: null } : null;
  }

  const access = await resolveCompanyAccess(req, companyId);
  if (!access) return null;

  // An admin viewing one company's dashboard still registers as an admin
  // device, so it keeps hearing about every company.
  return access === "admin"
    ? { role: "admin", companyId: null }
    : { role: "company", companyId };
}

function readEvents(value: unknown): WebhookEventId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isWebhookEventId);
}

// Registers (or refreshes) this device's Expo push token. The app calls
// this on every launch: Expo can reissue a token at any time, and the same
// phone may sign in under a different login.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = body?.token;

  if (!isExpoPushToken(token)) {
    return NextResponse.json(
      { error: "invalid_input", message: "A valid Expo push token is required." },
      { status: 400 },
    );
  }

  const companyId = typeof body?.companyId === "string" ? body.companyId : null;
  const caller = await resolveCaller(req, companyId);
  if (!caller) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const device = await registerDevice({
    token,
    role: caller.role,
    companyId: caller.companyId,
    events: readEvents(body?.events),
    platform: typeof body?.platform === "string" ? body.platform : null,
    deviceName: typeof body?.deviceName === "string" ? body.deviceName : null,
  });

  return NextResponse.json({
    device: { token: device.token, events: device.events, role: device.role },
  });
}

// Reads back what this device is subscribed to, so the settings screen can
// render the real state rather than assuming its local copy is current.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const companyId = req.nextUrl.searchParams.get("companyId");

  if (!isExpoPushToken(token)) {
    return NextResponse.json(
      { error: "invalid_input", message: "A valid Expo push token is required." },
      { status: 400 },
    );
  }

  const caller = await resolveCaller(req, companyId);
  if (!caller) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const device = await findDevice(token);
  return NextResponse.json({
    device: device ? { token: device.token, events: device.events, role: device.role } : null,
  });
}

// Changes which events this device wants.
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = body?.token;
  const events = readEvents(body?.events);

  if (!isExpoPushToken(token) || !events) {
    return NextResponse.json(
      { error: "invalid_input", message: "A valid push token and events list are required." },
      { status: 400 },
    );
  }

  const companyId = typeof body?.companyId === "string" ? body.companyId : null;
  const caller = await resolveCaller(req, companyId);
  if (!caller) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const device = await updateDeviceEvents(token, events);
  if (!device) {
    return NextResponse.json(
      { error: "not_found", message: "This device isn't registered for notifications." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    device: { token: device.token, events: device.events, role: device.role },
  });
}

// Called on logout, so a signed-out phone stops receiving a company's
// registrations. Unauthenticated deletes are allowed on purpose: the token
// is the device's own, the session may already be gone by the time this
// fires, and the worst case is a device unsubscribing itself.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = body?.token ?? req.nextUrl.searchParams.get("token");

  if (!isExpoPushToken(token)) {
    return NextResponse.json(
      { error: "invalid_input", message: "A valid Expo push token is required." },
      { status: 400 },
    );
  }

  await unregisterDevice(token);
  return NextResponse.json({ ok: true });
}
