import {
  AlignLeft,
  Calendar,
  CircleDot,
  Hash,
  List,
  ListChecks,
  Mail,
  Phone,
  SquareCheck,
  Type,
  type LucideIcon,
} from "lucide-react";

// The input control a custom signup question is rendered as. Stored on
// formFields.type; absent on rows created before this existed, which
// normalizeFieldType() reads as the original behaviour ("text").
export type FormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkboxes"
  | "checkbox";

export const DEFAULT_FIELD_TYPE: FormFieldType = "text";

export interface FormFieldTypeMeta {
  value: FormFieldType;
  label: string;
  // Shown under the type picker in the admin, and used as the fallback
  // placeholder hint on the player side.
  hint: string;
  icon: LucideIcon;
  // Whether the admin must supply a list of choices for this type.
  hasOptions: boolean;
  // Whether an answer can hold several of those choices at once.
  multi: boolean;
}

export const FIELD_TYPES: FormFieldTypeMeta[] = [
  { value: "text", label: "Short text", hint: "A single line of free text.", icon: Type, hasOptions: false, multi: false },
  { value: "textarea", label: "Paragraph", hint: "Multiple lines of free text.", icon: AlignLeft, hasOptions: false, multi: false },
  { value: "email", label: "Email", hint: "Checked for a valid email address.", icon: Mail, hasOptions: false, multi: false },
  { value: "tel", label: "Phone", hint: "Digits, spaces, dashes and a leading +.", icon: Phone, hasOptions: false, multi: false },
  { value: "number", label: "Number", hint: "Numbers only — age, quantity, score.", icon: Hash, hasOptions: false, multi: false },
  { value: "date", label: "Date", hint: "A date picker.", icon: Calendar, hasOptions: false, multi: false },
  { value: "select", label: "Dropdown", hint: "Pick one from a list.", icon: List, hasOptions: true, multi: false },
  { value: "radio", label: "Radio buttons", hint: "Pick one, all choices visible.", icon: CircleDot, hasOptions: true, multi: false },
  { value: "checkboxes", label: "Checkboxes", hint: "Pick any number of choices.", icon: ListChecks, hasOptions: true, multi: true },
  { value: "checkbox", label: "Single checkbox", hint: "A yes/no tick — consent, opt-in.", icon: SquareCheck, hasOptions: false, multi: false },
];

const BY_VALUE = new Map(FIELD_TYPES.map((t) => [t.value, t]));

export function fieldTypeMeta(type: string | null | undefined): FormFieldTypeMeta {
  return BY_VALUE.get(normalizeFieldType(type))!;
}

export function normalizeFieldType(type: unknown): FormFieldType {
  return typeof type === "string" && BY_VALUE.has(type as FormFieldType)
    ? (type as FormFieldType)
    : DEFAULT_FIELD_TYPE;
}

export const MAX_FIELD_OPTIONS = 25;

// Choices arrive as a JSON array from the DB and as whatever the admin
// typed from the API — trimmed, blank-dropped, de-duped and capped so the
// player side can trust the list it renders and validates against.
export function normalizeFieldOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of options) {
    if (typeof raw !== "string") continue;
    const option = raw.trim();
    if (!option || seen.has(option)) continue;
    seen.add(option);
    cleaned.push(option);
    if (cleaned.length >= MAX_FIELD_OPTIONS) break;
  }
  return cleaned;
}

// Answers stay plain strings in spins.extraFields (so the registrations
// table, search and webhooks keep working untouched) — a multi-choice
// answer is the picked options joined with this.
export const MULTI_ANSWER_SEPARATOR = ", ";

export const CHECKBOX_CHECKED = "Yes";

export function splitMultiAnswer(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function joinMultiAnswer(values: string[]): string {
  return values.join(MULTI_ANSWER_SEPARATOR);
}

export interface AnswerableField {
  key: string;
  label: string;
  required: boolean;
  type?: string | null;
  options?: unknown;
}

// Phrased as the popup asks for it — the API hands the same sentence back
// to whatever posted the registration.
export function missingAnswerMessage(field: AnswerableField): string {
  const type = normalizeFieldType(field.type);
  if (type === "checkbox") return `Please tick "${field.label}" to continue.`;
  const verb = fieldTypeMeta(type).hasOptions ? "choose" : "enter";
  return `Please ${verb} your ${field.label.toLowerCase()}.`;
}

// Runs the same checks the API will, so the popup can refuse a submission
// with the exact message the server would have returned.
export function firstAnswerProblem(
  fields: AnswerableField[],
  values: Record<string, string>,
): string | null {
  for (const field of fields) {
    const result = validateFieldAnswer(field, values[field.key]);
    if (!result.ok) return result.message;
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEL_RE = /^[0-9+][0-9\s-]{6,19}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Server-side counterpart of the popup's own checks: normalizes one
// submitted answer and says why it is unacceptable, if it is. Empty and
// not required always passes and stores "".
export function validateFieldAnswer(
  field: AnswerableField,
  raw: unknown,
): { ok: true; value: string } | { ok: false; message: string } {
  const type = normalizeFieldType(field.type);
  const options = normalizeFieldOptions(field.options);
  const value = typeof raw === "string" ? raw.trim() : "";
  const missing = { ok: false as const, message: missingAnswerMessage(field) };

  if (type === "checkbox") {
    const checked = value.length > 0;
    if (field.required && !checked) return missing;
    return { ok: true, value: checked ? CHECKBOX_CHECKED : "" };
  }

  if (!value) {
    return field.required ? missing : { ok: true, value: "" };
  }

  switch (type) {
    case "email":
      if (!EMAIL_RE.test(value)) {
        return { ok: false, message: `Enter a valid email address for ${field.label}.` };
      }
      return { ok: true, value };
    case "tel":
      if (!TEL_RE.test(value)) {
        return { ok: false, message: `Enter a valid phone number for ${field.label}.` };
      }
      return { ok: true, value };
    case "number":
      if (!Number.isFinite(Number(value))) {
        return { ok: false, message: `${field.label} must be a number.` };
      }
      return { ok: true, value };
    case "date":
      if (!DATE_RE.test(value) || Number.isNaN(new Date(value).getTime())) {
        return { ok: false, message: `Enter a valid date for ${field.label}.` };
      }
      return { ok: true, value };
    case "select":
    case "radio":
      // An offer whose choices were all deleted after the fact would
      // otherwise reject every answer — accept the text as typed.
      if (options.length > 0 && !options.includes(value)) {
        return { ok: false, message: `Pick one of the listed choices for ${field.label}.` };
      }
      return { ok: true, value };
    case "checkboxes": {
      const picked = splitMultiAnswer(value);
      if (options.length > 0) {
        const unknown = picked.filter((p) => !options.includes(p));
        if (unknown.length > 0) {
          return { ok: false, message: `Pick only listed choices for ${field.label}.` };
        }
      }
      if (field.required && picked.length === 0) return missing;
      return { ok: true, value: joinMultiAnswer(picked) };
    }
    default:
      return { ok: true, value };
  }
}
