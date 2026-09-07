"use client";

import {
  Bell,
  Cake,
  Cherry,
  Citrus,
  Clover,
  Coins,
  Crown,
  Gem,
  Gift,
  Grape,
  HelpCircle,
  Rocket,
  Star,
  Trophy,
  type LucideIcon,
} from "lucide-react";

// Every game used emoji for its artwork, which renders differently on
// every OS and can't be animated or recoloured. These are the shared SVG
// replacements.

// A gift box that actually opens: the lid group lifts and tilts as the
// state moves closed -> opening -> opened, hinged on its own box rather
// than the viewBox origin.
export function GiftBoxIcon({
  state = "closed",
  className = "size-11 sm:size-12",
}: {
  state?: "closed" | "opening" | "opened";
  className?: string;
}) {
  const lidTransform =
    state === "opened"
      ? "-translate-y-[7px] -rotate-[26deg]"
      : state === "opening"
        ? "-translate-y-[3px] -rotate-[12deg]"
        : "group-hover:-translate-y-[2px] group-hover:-rotate-[7deg]";

  return (
    <svg
      viewBox="0 0 48 48"
      className={`${className} ${
        state === "opening" ? "animate-[box-shake_0.4s_ease-in-out_infinite]" : ""
      }`}
      aria-hidden="true"
    >
      {/* body, with the ribbon running down it */}
      <rect x="9" y="22" width="30" height="19" rx="2.5" fill="#f59e0b" />
      <rect x="9" y="22" width="30" height="3" fill="#fbbf24" />
      <rect x="21" y="22" width="6" height="19" fill="#10b981" />
      {/* lid and bow */}
      <g
        className={`transition-transform duration-500 ease-out ${lidTransform}`}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <rect x="6" y="15" width="36" height="8" rx="2" fill="#fbbf24" />
        <rect x="21" y="15" width="6" height="8" fill="#10b981" />
        <ellipse cx="19.5" cy="11.5" rx="4.2" ry="3" transform="rotate(-22 19.5 11.5)" fill="#34d399" />
        <ellipse cx="28.5" cy="11.5" rx="4.2" ry="3" transform="rotate(22 28.5 11.5)" fill="#34d399" />
        <circle cx="24" cy="13" r="2.1" fill="#10b981" />
      </g>
      {/* drawn after the lid so the contents read as bursting past it */}
      {state === "opened" && (
        <g fill="#fde68a">
          <circle cx="14" cy="19" r="1.4" />
          <circle cx="34" cy="17" r="1.1" />
          <circle cx="24" cy="14" r="1.7" />
        </g>
      )}
    </svg>
  );
}

// The prize artwork every result panel leads with: the admin's uploaded
// prize icon when there is one, otherwise a trophy for a win and a plain
// gift for a non-win — replacing the 💫 / 🎁 / 🎉 emoji.
export function PrizeBadge({
  won,
  iconUrl,
  label,
  size = "md",
}: {
  won: boolean;
  iconUrl?: string | null;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const box = { sm: "size-16", md: "size-20", lg: "size-24" }[size];
  const glyph = { sm: "size-8", md: "size-10", lg: "size-12" }[size];

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={label}
        className={`mx-auto ${box} object-contain drop-shadow-lg`}
      />
    );
  }

  const Icon = won ? Trophy : Gift;
  return (
    <div
      className={`mx-auto flex ${box} items-center justify-center rounded-full ${
        won
          ? "bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/40"
          : "bg-neutral-800 text-neutral-400 ring-1 ring-neutral-700"
      }`}
    >
      <Icon className={glyph} aria-hidden="true" />
    </div>
  );
}

export interface GameSymbol {
  id: string;
  Icon: LucideIcon;
  className: string;
}

// Slot reel faces. `jackpot` is the one all three reels land on for a win.
// Light steps: these sit in the near-black reel windows of the cabinet
// artwork (see SlotMachine), so the -500/-600 steps they used to carry —
// picked for the old white reels — read as almost unlit against it.
export const SLOT_SYMBOLS: GameSymbol[] = [
  { id: "cherry", Icon: Cherry, className: "text-rose-400" },
  { id: "lemon", Icon: Citrus, className: "text-amber-300" },
  { id: "grape", Icon: Grape, className: "text-violet-400" },
  { id: "bell", Icon: Bell, className: "text-yellow-300" },
  { id: "gem", Icon: Gem, className: "text-cyan-300" },
  { id: "clover", Icon: Clover, className: "text-emerald-400" },
  { id: "crown", Icon: Crown, className: "text-amber-300" },
  { id: "coins", Icon: Coins, className: "text-yellow-400" },
];

export const SLOT_JACKPOT_ID = "gem";

export function slotSymbol(id: string): GameSymbol {
  return SLOT_SYMBOLS.find((s) => s.id === id) ?? SLOT_SYMBOLS[0];
}

// Memory Match card faces — six pairs.
export const MEMORY_SYMBOLS: GameSymbol[] = [
  { id: "gift", Icon: Gift, className: "text-rose-400" },
  { id: "crown", Icon: Crown, className: "text-amber-400" },
  { id: "gem", Icon: Gem, className: "text-cyan-400" },
  { id: "star", Icon: Star, className: "text-yellow-400" },
  { id: "cake", Icon: Cake, className: "text-pink-400" },
  { id: "rocket", Icon: Rocket, className: "text-violet-400" },
];

export function memorySymbol(id: string): GameSymbol {
  return MEMORY_SYMBOLS.find((s) => s.id === id) ?? MEMORY_SYMBOLS[0];
}

// The face-down side of a memory card, replacing the ❓ emoji.
export function CardBackIcon({ className = "size-6" }: { className?: string }) {
  return <HelpCircle className={`${className} text-neutral-500`} aria-hidden="true" />;
}
