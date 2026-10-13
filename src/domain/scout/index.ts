import type { Candidate } from "../candidate";
import { sideQuestXp } from "../xp";

export interface ScoutOptions {
  /** Look this far ahead of the car (km). */
  windowStartKm?: number;
  windowEndKm?: number;
  /** Side Quests are worth a detour, but not a big one. */
  minDetourMin?: number;
  maxDetourMin?: number;
  /** Local baseline radius (km) and minimum sample size before falling back to the whole pool. */
  baselineRadiusKm?: number;
  minBaselineSamples?: number;
  /** Robust z-score and absolute group-fit thresholds. */
  minZ?: number;
  minGroupFit?: number;
  /** No new offer within this distance of the previous one (km). */
  cooldownKm?: number;
  maxOffersPerDay?: number;
}

export const SCOUT_DEFAULTS: Required<ScoutOptions> = {
  windowStartKm: 5,
  windowEndKm: 80,
  minDetourMin: 5,
  maxDetourMin: 25,
  baselineRadiusKm: 150,
  minBaselineSamples: 8,
  minZ: 1.5,
  minGroupFit: 0.8,
  cooldownKm: 150,
  maxOffersPerDay: 2,
};

export interface ScoutState {
  progressKm: number;
  dayIndex: number;
  /** km position of the last offer, if any. */
  lastOfferKm?: number;
  offersToday: number;
  /** Candidates already offered (accepted or skipped): never offered twice. */
  offeredIds: ReadonlySet<string> | string[];
}

export interface SideQuestOffer {
  candidate: Candidate;
  title: string;
  emoji: string;
  /** Robust z-score of the candidate's group fit against its local baseline. */
  z: number;
  xp: number;
}

/** Median and MAD (median absolute deviation). */
export function medianMad(values: number[]): { median: number; mad: number } {
  if (values.length === 0) return { median: 0, mad: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const median = medianOfSorted(sorted);
  const deviations = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  return { median, mad: medianOfSorted(deviations) };
}

function medianOfSorted(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** z = (G − median) / max(1.4826·MAD, 0.03): MAD scaled to a normal σ, with a floor so a flat baseline can't divide by ~0. */
export function robustZ(value: number, baseline: number[]): number {
  const { median, mad } = medianMad(baseline);
  return (value - median) / Math.max(1.4826 * mad, 0.03);
}

/**
 * The Scout: among unused candidates just ahead of the car, is one unusually strong for this crew
 * compared with what's normal around here? Pure: everything was computed at plan time.
 */
export function findSideQuest(
  pool: Candidate[],
  state: ScoutState,
  options: ScoutOptions = {},
): SideQuestOffer | undefined {
  const o = { ...SCOUT_DEFAULTS, ...options };
  if (state.offersToday >= o.maxOffersPerDay) return undefined;
  if (state.lastOfferKm !== undefined && state.progressKm - state.lastOfferKm < o.cooldownKm)
    return undefined;

  const offered = state.offeredIds instanceof Set ? state.offeredIds : new Set(state.offeredIds);
  const scored = pool.filter((c) => c.groupFit !== undefined);
  const ahead = scored.filter(
    (c) =>
      !offered.has(c.id) &&
      c.alongKm >= state.progressKm + o.windowStartKm &&
      c.alongKm <= state.progressKm + o.windowEndKm &&
      c.detourMin >= o.minDetourMin &&
      c.detourMin <= o.maxDetourMin &&
      c.groupFit! >= o.minGroupFit,
  );

  let best: SideQuestOffer | undefined;
  for (const c of ahead) {
    const local = scored
      .filter((x) => Math.abs(x.alongKm - c.alongKm) <= o.baselineRadiusKm)
      .map((x) => x.groupFit!);
    const baseline = local.length >= o.minBaselineSamples ? local : scored.map((x) => x.groupFit!);
    const z = robustZ(c.groupFit!, baseline);
    if (z >= o.minZ && (!best || z > best.z)) {
      const { title, emoji } = questTitle(c);
      best = {
        candidate: c,
        title,
        emoji,
        z: Math.round(z * 100) / 100,
        xp: sideQuestXp(c.groupFit!, c.detourMin),
      };
    }
  }
  return best;
}

const TITLES: { match: RegExp; emoji: string; title: string }[] = [
  { match: /taco/, emoji: "🌮", title: "The Taco Detour" },
  { match: /vietnamese|pho/, emoji: "🍜", title: "The Pho Pilgrimage" },
  { match: /mexican/, emoji: "🌶️", title: "The Salsa Side Road" },
  { match: /coffee|cafe/, emoji: "☕", title: "The Coffee Run" },
  { match: /bakery|pastry/, emoji: "🥐", title: "The Pastry Pit Stop" },
  { match: /barbecue|bbq/, emoji: "🍖", title: "The Smoke Signal" },
  { match: /hot_spring/, emoji: "♨️", title: "The Hot Springs Soak" },
  { match: /hiking|national_park|state_park|forest/, emoji: "🥾", title: "The Trailhead Detour" },
  { match: /art_gallery|art_museum|museum/, emoji: "🎨", title: "The Gallery Hop" },
  { match: /record_store/, emoji: "💿", title: "The Crate Dig" },
  { match: /vintage|thrift|antique/, emoji: "🧥", title: "The Vintage Hunt" },
  { match: /live_music/, emoji: "🎸", title: "The Encore" },
  { match: /racing_track/, emoji: "🏁", title: "The Pit Lane" },
  { match: /scenic|viewpoint/, emoji: "🏜️", title: "The Scenic Detour" },
];

/** Playful title from the candidate's tags (first rule that matches). */
export function questTitle(c: Candidate): { title: string; emoji: string } {
  const haystack = c.tags.map((t) => t.id).join(" ") + ` ${c.name.toLowerCase()}`;
  const rule = TITLES.find((r) => r.match.test(haystack));
  return rule ? { title: rule.title, emoji: rule.emoji } : { title: "The Side Quest", emoji: "✨" };
}
