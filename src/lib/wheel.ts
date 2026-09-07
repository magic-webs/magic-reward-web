import type { FormFieldType } from "@/lib/formFields";

// Generalized, DB-backed version of the arc/draw math that used to live in
// src/lib/prizes.ts against a hardcoded array. src/lib/prizes.ts itself is
// left in place — only the migration script still imports it.

export interface WheelPrize {
  id: string;
  label: string;
  weight: number;
  order: number;
  isWin: boolean;
  color?: string;
  iconUrl?: string;
}

export interface WheelPrizeArc extends WheelPrize {
  start: number;
  end: number;
}

export interface WheelFormField {
  key: string;
  label: string;
  required: boolean;
  // Which control to render — "text" for questions saved before custom
  // types existed. Choices are only meaningful for select/radio/checkboxes.
  type: FormFieldType;
  options: string[];
}

// Fixed equal slices (360 / N), in the given order, centered on the
// cardinal directions when N === 4 (matching today's wheel image layout)
// and generalizing cleanly to any other prize count.
export function getPrizeArcs(prizes: WheelPrize[]): WheelPrizeArc[] {
  const span = 360 / prizes.length;
  return prizes.map((p, i) => ({
    ...p,
    start: i * span - span / 2,
    end: i * span + span / 2,
  }));
}

// Server-only: the actual weighted draw. Never call this from client code.
export function drawWeightedPrize<T extends { weight: number }>(prizes: T[]): T {
  const total = prizes.reduce((sum, p) => sum + p.weight, 0);
  let r = Math.random() * total;
  for (const p of prizes) {
    if (r < p.weight) return p;
    r -= p.weight;
  }
  return prizes[prizes.length - 1];
}
