import { api, asCompanyId, asOfferId, convex } from "@/lib/convex";
import {
  FOMO_TYPES,
  anonymizeName,
  applyTemplate,
  relativeTime,
  type FomoConfig,
  type FomoFeed,
  type FomoItem,
} from "@/lib/fomo";

const ICONS = new Map(FOMO_TYPES.map((t) => [t.id, t.icon]));

// How many live rows a single feed will ever draw from. The feed loops, so
// there is no reason to ship the entire registration history to a visitor.
const MAX_LIVE_ITEMS = 12;

// Deterministic-per-minute pseudo random, so the simulated visitor count
// drifts smoothly instead of flickering on every request, and two visitors
// loading the page at the same moment see the same number.
function drift(min: number, max: number, seed: string, now: number): number {
  if (max <= min) return min;
  const bucket = Math.floor(now / 60000);
  let hash = bucket;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const normalized = Math.abs(Math.sin(hash)) % 1;
  return min + Math.floor(normalized * (max - min + 1));
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Interleaves the different notification types so a visitor does not get
// eight "recent winner" toasts in a row before seeing anything else.
function interleave(groups: FomoItem[][]): FomoItem[] {
  const out: FomoItem[] = [];
  const longest = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < longest; i += 1) {
    for (const group of groups) {
      if (group[i]) out.push(group[i]);
    }
  }
  return out;
}

export interface BuildFomoFeedInput {
  config: FomoConfig;
  companyId: string;
  offerId?: string | null;
  // Seeds the simulated visitor drift so different offers show different
  // numbers at the same moment.
  seed: string;
}

export async function buildFomoFeed({
  config,
  companyId,
  offerId,
  seed,
}: BuildFomoFeedInput): Promise<FomoFeed> {
  const now = Date.now();
  const t = config.types;

  const base: Omit<FomoFeed, "items"> = {
    enabled: config.enabled,
    position: config.position,
    theme: config.theme,
    displayMs: config.displayMs,
    gapMs: config.gapMs,
    initialDelayMs: config.initialDelayMs,
    loop: config.loop,
    showOnMobile: config.showOnMobile,
  };

  if (!config.enabled) return { ...base, items: [] };

  const needsSpins =
    t.recent_winner.enabled ||
    t.recent_signup.enabled ||
    t.signup_count.enabled ||
    t.low_stock.enabled;

  // One query covers every live type; they all read the same rows over
  // different time windows.
  let spins: { id: string; name: string; prizeLabel?: string; createdAt: number }[] = [];
  if (needsSpins) {
    const windows = [
      t.recent_winner.enabled ? t.recent_winner.maxAgeHours : 0,
      t.recent_signup.enabled ? t.recent_signup.maxAgeHours : 0,
      t.signup_count.enabled ? t.signup_count.windowHours : 0,
      t.low_stock.enabled ? 24 : 0,
    ];
    const oldest = now - Math.max(...windows) * 3600_000;

    // Instant filtered and limited server-side in the query; the Convex
    // equivalents read the offer's (or company's) spins by index and the
    // window is applied here.
    const rows = offerId
      ? await convex.query(api.spins.recentWins, { offerId: asOfferId(offerId), limit: 200 })
      : (await convex.query(api.spins.listByCompany, { companyId: asCompanyId(companyId) }))
          .slice(0, 200)
          .map((s) => ({ name: s.name, prizeLabel: s.prizeLabel, createdAt: s.createdAt }));

    spins = rows
      .filter((s) => s.createdAt > oldest)
      .map((s, index) => ({
        // The feed only ever renders name/prize/time; an index is enough of
        // a react key and avoids carrying row ids to the client.
        id: `f${index}`,
        name: s.name,
        prizeLabel: s.prizeLabel ?? undefined,
        createdAt: s.createdAt,
      }));
  }

  const groups: FomoItem[][] = [];

  if (t.recent_winner.enabled) {
    const cutoff = now - t.recent_winner.maxAgeHours * 3600_000;
    groups.push(
      spins
        .filter((s) => s.createdAt >= cutoff && s.prizeLabel)
        .slice(0, MAX_LIVE_ITEMS)
        .map((s) => ({
          id: `winner-${s.id}`,
          type: "recent_winner" as const,
          icon: ICONS.get("recent_winner")!,
          text: applyTemplate(t.recent_winner.template, {
            name: t.recent_winner.anonymize ? anonymizeName(s.name) : s.name,
            prize: s.prizeLabel ?? "a prize",
            time: relativeTime(s.createdAt, now),
          }),
        })),
    );
  }

  if (t.recent_signup.enabled) {
    const cutoff = now - t.recent_signup.maxAgeHours * 3600_000;
    groups.push(
      spins
        .filter((s) => s.createdAt >= cutoff)
        .slice(0, MAX_LIVE_ITEMS)
        .map((s) => ({
          id: `signup-${s.id}`,
          type: "recent_signup" as const,
          icon: ICONS.get("recent_signup")!,
          text: applyTemplate(t.recent_signup.template, {
            name: t.recent_signup.anonymize ? anonymizeName(s.name) : s.name,
            time: relativeTime(s.createdAt, now),
          }),
        })),
    );
  }

  if (t.signup_count.enabled) {
    const cutoff = now - t.signup_count.windowHours * 3600_000;
    const count = spins.filter((s) => s.createdAt >= cutoff).length;
    // Below the threshold the real number is weak proof, so say nothing
    // rather than announce "2 people entered".
    if (count >= t.signup_count.minimum) {
      groups.push([
        {
          id: "signup-count",
          type: "signup_count",
          icon: ICONS.get("signup_count")!,
          text: applyTemplate(t.signup_count.template, {
            count,
            hours: t.signup_count.windowHours,
          }),
        },
      ]);
    }
  }

  if (t.low_stock.enabled) {
    const today = now - 24 * 3600_000;
    const claimedToday = spins.filter((s) => s.createdAt >= today).length;
    const left = Math.max(t.low_stock.floor, t.low_stock.dailyTotal - claimedToday);
    groups.push([
      {
        id: "low-stock",
        type: "low_stock",
        icon: ICONS.get("low_stock")!,
        text: applyTemplate(t.low_stock.template, {
          left,
          total: t.low_stock.dailyTotal,
        }),
      },
    ]);
  }

  if (t.countdown.enabled) {
    // A fixed end date wins; otherwise the timer rolls forward so the offer
    // always looks like it is about to close.
    const endsAt =
      t.countdown.endsAt && t.countdown.endsAt > now
        ? t.countdown.endsAt
        : now + t.countdown.rollingHours * 3600_000;
    if (!t.countdown.endsAt || t.countdown.endsAt > now) {
      groups.push([
        {
          id: "countdown",
          type: "countdown",
          icon: ICONS.get("countdown")!,
          text: applyTemplate(t.countdown.template, { time: "" }).trim(),
          countdownEndsAt: endsAt,
          template: t.countdown.template,
        },
      ]);
    }
  }

  if (t.live_visitors.enabled) {
    groups.push([
      {
        id: "live-visitors",
        type: "live_visitors",
        icon: ICONS.get("live_visitors")!,
        text: applyTemplate(t.live_visitors.template, {
          count: drift(t.live_visitors.min, t.live_visitors.max, seed, now),
        }),
      },
    ]);
  }

  if (t.custom.enabled && t.custom.messages.length > 0) {
    groups.push(
      shuffle(t.custom.messages).map((message, i) => ({
        id: `custom-${i}`,
        type: "custom" as const,
        icon: ICONS.get("custom")!,
        text: message,
      })),
    );
  }

  return { ...base, items: interleave(groups.filter((g) => g.length > 0)) };
}
