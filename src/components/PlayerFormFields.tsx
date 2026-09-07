"use client";

import {
  CHECKBOX_CHECKED,
  joinMultiAnswer,
  normalizeFieldType,
  splitMultiAnswer,
} from "@/lib/formFields";
import type { WheelFormField } from "@/lib/wheel";

// The two looks the games use for their signup popup: the wheel and
// scratch card are placeholder-driven on amber/emerald, the rest label
// their inputs above a neutral field.
type Variant = "amber" | "neutral";

const STYLES: Record<
  Variant,
  { control: string; label: string; choice: string; tick: string }
> = {
  amber: {
    control:
      "w-full rounded-2xl border border-emerald-800/60 bg-white/5 px-4 py-3 text-sm text-white shadow-sm outline-none placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-60",
    label: "mb-1.5 block text-xs font-semibold text-gray-400",
    choice:
      "flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-800/60 bg-white/5 px-3 py-2 text-sm text-white has-disabled:opacity-60",
    tick: "h-4 w-4 shrink-0 accent-amber-400",
  },
  neutral: {
    control:
      "w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60",
    label: "mb-1 block text-xs font-semibold text-neutral-400",
    choice:
      "flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white has-disabled:opacity-60",
    tick: "h-4 w-4 shrink-0 accent-emerald-500",
  },
};

const TEXT_INPUT_TYPES: Record<string, string> = {
  text: "text",
  email: "email",
  tel: "tel",
  number: "number",
  date: "date",
};

export interface PlayerFormFieldsProps {
  fields: WheelFormField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  variant?: Variant;
}

// Renders an offer's custom signup questions — every input type the admin
// can pick in the Form Fields tab — for all six games.
export default function PlayerFormFields({
  fields,
  values,
  onChange,
  disabled = false,
  variant = "neutral",
}: PlayerFormFieldsProps) {
  const s = STYLES[variant];

  return (
    <>
      {fields.map((field) => {
        const type = normalizeFieldType(field.type);
        const value = values[field.key] ?? "";
        // The amber popup asks with placeholders instead of labels, but a
        // list of choices has nowhere to put one.
        const showLabel = variant === "neutral" || type === "select";
        // Labelled fields keep the games' original hint wording; the
        // unlabelled amber popup carries the question in the placeholder.
        const placeholder = showLabel
          ? `Your ${field.label.toLowerCase()}`
          : field.required
            ? `${field.label} *`
            : field.label;

        const labelEl = showLabel ? (
          <label htmlFor={`field-${field.key}`} className={s.label}>
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
        ) : null;

        if (type === "textarea") {
          return (
            <div key={field.key}>
              {labelEl}
              <textarea
                id={`field-${field.key}`}
                rows={3}
                required={variant === "neutral" && field.required}
                disabled={disabled}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                className={`${s.control} resize-y`}
              />
            </div>
          );
        }

        if (type === "select") {
          return (
            <div key={field.key}>
              {labelEl}
              <select
                id={`field-${field.key}`}
                required={variant === "neutral" && field.required}
                disabled={disabled}
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                className={s.control}
              >
                <option value="">
                  {field.required ? "Please choose…" : "Choose (optional)"}
                </option>
                {field.options.map((option) => (
                  <option key={option} value={option} className="bg-neutral-800 text-white">
                    {option}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (type === "radio") {
          return (
            <fieldset key={field.key} className="border-0 p-0">
              <legend className={s.label}>
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </legend>
              <div className="space-y-1.5">
                {field.options.map((option) => (
                  <label key={option} className={s.choice}>
                    <input
                      type="radio"
                      name={`field-${field.key}`}
                      value={option}
                      checked={value === option}
                      disabled={disabled}
                      onChange={() => onChange(field.key, option)}
                      className={s.tick}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }

        if (type === "checkboxes") {
          const picked = splitMultiAnswer(value);
          return (
            <fieldset key={field.key} className="border-0 p-0">
              <legend className={s.label}>
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </legend>
              <div className="space-y-1.5">
                {field.options.map((option) => (
                  <label key={option} className={s.choice}>
                    <input
                      type="checkbox"
                      checked={picked.includes(option)}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange(
                          field.key,
                          // Rebuilt from the admin's order rather than the
                          // click order, so answers stay comparable.
                          joinMultiAnswer(
                            field.options.filter((o) =>
                              o === option ? e.target.checked : picked.includes(o),
                            ),
                          ),
                        )
                      }
                      className={s.tick}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }

        if (type === "checkbox") {
          return (
            <label key={field.key} className={s.choice}>
              <input
                type="checkbox"
                checked={value.length > 0}
                required={variant === "neutral" && field.required}
                disabled={disabled}
                onChange={(e) => onChange(field.key, e.target.checked ? CHECKBOX_CHECKED : "")}
                className={s.tick}
              />
              <span>
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </span>
            </label>
          );
        }

        return (
          <div key={field.key}>
            {labelEl}
            <input
              id={`field-${field.key}`}
              type={TEXT_INPUT_TYPES[type] ?? "text"}
              required={variant === "neutral" && field.required}
              disabled={disabled}
              placeholder={type === "date" ? undefined : placeholder}
              value={value}
              onChange={(e) => onChange(field.key, e.target.value)}
              className={s.control}
            />
          </div>
        );
      })}
    </>
  );
}
