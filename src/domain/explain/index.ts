import type { Traveler } from "@/config/demoCrew";

import type { Candidate } from "../candidate";

export interface Why {
  /** "94% Your Vibe · Matt 93 · Alex 95" */
  headline: string;
  /** One short reason per traveler that has one, e.g. "Alex: art, coffee". */
  reasons: { travelerId: string; text: string; loves: string[] }[];
  /** "Known for chocoflan and mole" or a description excerpt. */
  snippet?: string;
  /** Single sentence for cards. */
  sentence: string;
}

/**
 * Template explanation grounded only in data we hold: per-traveler scores, overlap between the
 * place's tags and each traveler's taste tags, and Qloo's description/specialty dishes.
 * Explainability is only a tie-breaker (spike S2: credit is flat with many signals).
 */
export function templateWhy(c: Candidate, crew: Traveler[]): Why {
  const headline = [
    `${c.vibePct ?? 0}% Your Vibe`,
    ...crew.map((t) => `${t.name} ${Math.round(100 * (c.scores?.[t.id]?.percentile ?? 0))}`),
  ].join(" · ");

  const placeTags = new Set(c.tags.map((t) => t.id));
  const reasons = crew
    .map((t) => {
      const labels = [
        ...new Set(t.tasteTags.filter((tag) => placeTags.has(tag.id)).map((tag) => tag.label)),
      ];
      if (labels.length > 0) {
        const loves = labels.slice(0, 2);
        return { travelerId: t.id, text: `${t.name}: ${loves.join(", ")}`, loves };
      }
      // Tie-breaker: a favorite that contributed to the group match.
      const fav = t.favorites.find((f) =>
        c.contributions.some((k) => k.signalId === f.qlooId && k.score >= 0.2),
      );
      return fav
        ? { travelerId: t.id, text: `${t.name}: because of ${fav.name}`, loves: [fav.name] }
        : undefined;
    })
    .filter((r): r is Why["reasons"][number] => r !== undefined);

  const snippet = c.specialtyDishes?.length
    ? `Known for ${listJoin(c.specialtyDishes.slice(0, 2).map(cleanDish))}`
    : c.description
      ? excerpt(c.description, 110)
      : undefined;

  const loves = reasons.map(
    (r) => `${crew.find((x) => x.id === r.travelerId)!.name}'s love of ${listJoin(r.loves)}`,
  );
  const especially = (c.especiallyFor ?? [])
    .map((id) => crew.find((t) => t.id === id)?.name)
    .filter(Boolean);
  const sentence = [
    loves.length
      ? `Picked for ${listJoin(loves)}.`
      : `A strong match for your crew's overall taste.`,
    especially.length ? `Especially for ${listJoin(especially as string[])}.` : "",
    snippet ? `${snippet}${/[.!?…]$/.test(snippet) ? "" : "."}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { headline, reasons, snippet, sentence };
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Qloo dish names sometimes carry list debris ("And Cornbread"): lowercase and trim connectors. */
function cleanDish(dish: string): string {
  return dish
    .toLowerCase()
    .replace(/^(and|with|or)\s+/, "")
    .trim();
}

function excerpt(text: string, max: number): string {
  const first = text.split(/(?<=[.!?])\s/)[0];
  return first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
}
