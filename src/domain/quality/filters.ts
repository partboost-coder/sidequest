import { CHAIN_NAMES } from "./chains";

/** Minimal candidate shape the quality filters need (structurally compatible with QlooEntity). */
export interface QualityCandidate {
  id: string;
  name: string;
  isClosed?: boolean;
  location?: { lat: number; lon: number };
  tags: { id: string }[];
}

export type DropReason = "closed" | "chain" | "excluded_tag" | "no_location" | "duplicate";

/** Lowercase, strip accents and punctuation, "&" → "and", drop store numbers and branch suffixes. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\s+[-–—|]\s+.*$/, "") // "Starbucks - Main St" → "starbucks"
    .replace(/#\s*\d+/g, " ") // store numbers
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const CHAINS = new Set(CHAIN_NAMES.map(normalizeName));

/** True if the name is a known chain, alone or followed by more words ("Starbucks Reserve"). */
export function isChain(name: string): boolean {
  const n = normalizeName(name);
  const withoutThe = n.replace(/^the /, "");
  for (const candidate of [n, withoutThe]) {
    if (CHAINS.has(candidate)) return true;
    const words = candidate.split(" ");
    for (let i = words.length - 1; i >= 1; i--) {
      if (CHAINS.has(words.slice(0, i).join(" "))) return true;
    }
  }
  return false;
}

/**
 * Removes candidates Sidequest must never recommend. Runs before per-traveler scoring so no
 * Qloo calls are spent on them. Returns what was dropped and why (for the quality review).
 */
export function filterCandidates<T extends QualityCandidate>(
  candidates: T[],
  excludedTagIds: readonly string[],
): { kept: T[]; dropped: { candidate: T; reason: DropReason }[] } {
  const excluded = new Set(excludedTagIds);
  const seen = new Set<string>();
  const kept: T[] = [];
  const dropped: { candidate: T; reason: DropReason }[] = [];
  for (const c of candidates) {
    const reason: DropReason | undefined = seen.has(c.id)
      ? "duplicate"
      : c.isClosed
        ? "closed"
        : !c.location
          ? "no_location"
          : c.tags.some((t) => excluded.has(t.id))
            ? "excluded_tag"
            : isChain(c.name)
              ? "chain"
              : undefined;
    seen.add(c.id);
    if (reason) dropped.push({ candidate: c, reason });
    else kept.push(c);
  }
  return { kept, dropped };
}
