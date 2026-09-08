import { randomBytes } from "crypto";
import { api, asCompanyId, asOfferId, convex } from "@/lib/convex";
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

  // Resolution order (a valid magic-link token, then an existing phone for
  // this company, then a new row) lives in the Convex mutation so all three
  // branches share one transaction. That also removes the old
  // race-on-phone recovery path: two simultaneous requests for the same
  // number can no longer both insert.
  const result = await convex.mutation(api.spins.register, {
    companyId: asCompanyId(companyId),
    offerId: offerId ? asOfferId(offerId) : undefined,
    name,
    phone,
    extraFields,
    freshToken: generateToken(),
    existingToken: input.token ?? undefined,
  });

  // Only a genuinely new row is a new signup — the returning-visitor and
  // existing-phone branches resolve to an already-registered person, so
  // firing there would double-report the same customer.
  if (result.created) {
    scheduleEvent(
      companyId,
      offerId ?? null,
      "registration.created",
      {
        registration: {
          id: result.id,
          name,
          phone,
          extraFields,
          createdAt: result.createdAt ?? Date.now(),
        },
      },
    );
  }

  return {
    ok: true,
    token: result.token,
    loginUrl: buildLoginUrl(result.token, companySlug, offerId),
  };
}
