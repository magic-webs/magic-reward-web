import { randomBytes } from "crypto";
import { id } from "@instantdb/admin";
import { adminDb } from "@/lib/companies";
import { buildLoginUrl } from "@/lib/siteUrl";
import { scheduleEvent } from "@/lib/notify";
import { validateFieldAnswer, type FormFieldType } from "@/lib/formFields";

const PHONE_RE = /^[0-9+][0-9\s-]{6,14}$/;

export interface RegisterSpinInput {
  companyId: string;
  companySlug: string | null;
  offerId?: string | null;
  name: string | null;
  phone: string | null;
  // Present when this is a returning magic-link visitor confirming/editing
  // their already-known info, rather than a brand-new registration.
  token?: string | null;
  extraFields?: Record<string, string>;
  settings: { askName: boolean; askPhone: boolean };
  fields?: { key: string; label: string; required: boolean; type?: FormFieldType; options?: string[] }[];
}

export type RegisterSpinResult =
  | { ok: true; token: string; loginUrl: string }
  | { ok: false; status: number; error: string; message: string };

function generateToken() {
  return randomBytes(9).toString("base64url");
}

// Registers a person once (scoped to a single company/offer) and hands back a
// token that acts as a magic link. Calling this repeatedly with the same
// phone number for the same company/offer always returns the same token.
export async function registerSpin(input: RegisterSpinInput): Promise<RegisterSpinResult> {
  const { companyId, companySlug, offerId, settings, fields = [] } = input;

  let name = input.name?.trim() ?? "";
  let phone = input.phone?.trim() ?? "";

  if (settings.askName && !name) {
    return { ok: false, status: 400, error: "invalid_input", message: "Name is required." };
  }
  name = name || "Guest";

  if (settings.askPhone) {
    if (!phone) {
      return { ok: false, status: 400, error: "invalid_input", message: "Phone number is required." };
    }
    if (!PHONE_RE.test(phone)) {
      return { ok: false, status: 400, error: "invalid_input", message: "Enter a valid phone number." };
    }
  } else {
    phone = phone && PHONE_RE.test(phone) ? phone : `anon-${randomBytes(8).toString("hex")}`;
  }

  // Answers are checked here as well as in the popup form (see SpinWheel's
  // handleRegister), because a custom question can now constrain what a
  // valid answer even is — a dropdown answer has to be one of its choices,
  // and an embed or a replayed request never went through the popup.
  const extraFields: Record<string, string> = {};
  for (const field of fields) {
    const answer = validateFieldAnswer(field, input.extraFields?.[field.key]);
    if (!answer.ok) {
      return { ok: false, status: 400, error: "invalid_input", message: answer.message };
    }
    extraFields[field.key] = answer.value;
  }

  // A returning magic-link visitor confirming/editing their info — update
  // their existing row directly by id, no phone-uniqueness lookup needed
  // since it's their own already-issued link.
  if (input.token) {
    const { spins } = await adminDb.query({
      spins: { $: { where: { token: input.token, companyId } } },
    });
    const existing = spins[0];
    if (existing?.token) {
      await adminDb.transact(adminDb.tx.spins[existing.id].update({ name, phone, extraFields }));
      return { ok: true, token: existing.token, loginUrl: buildLoginUrl(existing.token, companySlug, offerId) };
    }
    // Stale/invalid token — fall through to the normal lookup-or-create flow.
  }

  const existing = await adminDb.query({
    spins: {
      $: {
        where: offerId
          ? { phone, companyId, offerId }
          : { phone, companyId },
      },
    },
  });
  if (existing.spins.length > 0) {
    const prev = existing.spins[0];
    if (prev.token) {
      return { ok: true, token: prev.token, loginUrl: buildLoginUrl(prev.token, companySlug, offerId) };
    }
    const token = generateToken();
    await adminDb.transact(adminDb.tx.spins[prev.id].update({ token }));
    return { ok: true, token, loginUrl: buildLoginUrl(token, companySlug, offerId) };
  }

  const token = generateToken();
  const spinId = id();
  const createdAt = Date.now();
  try {
    await adminDb.transact(
      adminDb.tx.spins[spinId]
        .update({ name, phone, token, companyId, offerId: offerId ?? undefined, extraFields, createdAt })
        .link({ company: companyId })
        .link(offerId ? { offer: offerId } : {}),
    );
  } catch {
    // Race on phone+companyId — someone else's request for the same
    // number landed first. Fetch their token instead of erroring.
    const afterRace = await adminDb.query({
      spins: {
        $: {
          where: offerId
            ? { phone, companyId, offerId }
            : { phone, companyId },
        },
      },
    });
    const prev = afterRace.spins[0];
    if (prev?.token) {
      return { ok: true, token: prev.token, loginUrl: buildLoginUrl(prev.token, companySlug, offerId) };
    }
    return { ok: false, status: 500, error: "server_error", message: "Something went wrong. Please try again." };
  }

  // Only this path is a genuinely new signup — the returning-visitor and
  // existing-phone branches above all resolve to an already-registered
  // person, so firing there would double-report the same customer.
  scheduleEvent(companyId, "registration.created", {
    registration: { id: spinId, name, phone, extraFields, createdAt },
  });

  return { ok: true, token, loginUrl: buildLoginUrl(token, companySlug, offerId) };
}
