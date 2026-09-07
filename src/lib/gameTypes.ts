import {
  Brain,
  Cake,
  Cherry,
  CircleDot,
  Ghost,
  Gift,
  Package,
  Palette,
  Sparkles,
  Target,
  TreePine,
  type LucideIcon,
} from "lucide-react";

export type GameTypeOption = {
  value: string;
  label: string;
  icon: LucideIcon;
};

export const GAME_TYPES: GameTypeOption[] = [
  { value: "wheel", label: "Spin the Wheel", icon: Target },
  { value: "scratch", label: "Scratch Card", icon: Gift },
  { value: "slot", label: "Slot Machine", icon: Cherry },
  { value: "giftbox", label: "Pick a Box", icon: Package },
  { value: "plinko", label: "Drop the Ball", icon: CircleDot },
  { value: "memory", label: "Memory Match", icon: Brain },
];

export const EVENT_THEMES: GameTypeOption[] = [
  { value: "none", label: "Default Style", icon: Palette },
  { value: "halloween", label: "Halloween", icon: Ghost },
  { value: "christmas", label: "Christmas", icon: TreePine },
  { value: "birthday", label: "Birthday", icon: Cake },
  { value: "anniversary", label: "Anniversary", icon: Sparkles },
];

export function findGameType(value: string | null | undefined) {
  return GAME_TYPES.find((g) => g.value === value);
}

export function findEventTheme(value: string | null | undefined) {
  return EVENT_THEMES.find((e) => e.value === (value ?? "none"));
}
