/** Match bonus: 0 at G ≤ 0.80, up to 50 at G = 1.0. */
export function matchBonus(groupFit: number): number {
  return Math.min(50, Math.max(0, Math.round((50 * (groupFit - 0.8)) / 0.2)));
}

/** XP for completing a Side Quest: base 100 + match bonus + 2 per detour minute (max 50). */
export function sideQuestXp(groupFit: number, detourMin: number): number {
  return 100 + matchBonus(groupFit) + Math.min(50, Math.max(0, Math.round(2 * detourMin)));
}

/** XP for checking in at a planned stop: base 50 + match bonus. */
export function checkInXp(groupFit: number): number {
  return 50 + matchBonus(groupFit);
}
