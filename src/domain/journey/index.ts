import type { Candidate } from "../candidate";
import { findSideQuest, type ScoutOptions, type SideQuestOffer } from "../scout";
import { checkInXp } from "../xp";

/**
 * The simulated drive as a pure reducer: moving the car runs the Scout; Side Quests go
 * offered → accepted → arrived → completed (or skipped); planned stops can be checked in.
 * Every completion earns XP and writes a journal entry. Plain JSON, so it can be saved as-is.
 */

export interface JourneyDay {
  index: number;
  startKm: number;
  endKm: number;
  stops: Candidate[];
}

export interface JournalEntry {
  id: string;
  kind: "side_quest" | "check_in";
  placeId: string;
  name: string;
  city?: string;
  /** Side Quests only. */
  title?: string;
  emoji?: string;
  photo?: string;
  rating?: number;
  note?: string;
  xp: number;
  km: number;
  at: string;
}

export interface ActiveQuest {
  offer: SideQuestOffer;
  status: "offered" | "accepted" | "arrived";
}

export interface JourneyState {
  progressKm: number;
  offeredIds: string[];
  lastOfferKm?: number;
  /** Offers made per day index. */
  offersByDay: Record<number, number>;
  quest?: ActiveQuest;
  /** Skipped Side Quests, for the recap. */
  skipped: string[];
  checkedIn: string[];
  journal: JournalEntry[];
  xp: number;
}

export interface CompleteInput {
  photo?: string;
  rating?: number;
  note?: string;
  at: string;
}

export type JourneyAction =
  | { type: "move"; km: number }
  | { type: "accept" }
  | { type: "skip" }
  | { type: "arrive" }
  | ({ type: "complete" } & CompleteInput)
  | ({ type: "checkIn"; stopId: string } & Pick<CompleteInput, "at">)
  | { type: "reset" };

export interface JourneyContext {
  days: JourneyDay[];
  pool: Candidate[];
  routeKm: number;
  scout?: ScoutOptions;
}

/** A planned stop counts as reached within this distance (km). */
export const ARRIVAL_KM = 3;

export const initialJourney = (): JourneyState => ({
  progressKm: 0,
  offeredIds: [],
  offersByDay: {},
  skipped: [],
  checkedIn: [],
  journal: [],
  xp: 0,
});

export function dayAt(days: JourneyDay[], km: number): number {
  const i = days.findIndex((d) => km >= d.startKm && km < d.endKm);
  return i === -1 ? Math.max(0, days.length - 1) : i;
}

/** The next planned stop strictly ahead of the car, if any. */
export function nextStop(days: JourneyDay[], km: number): Candidate | undefined {
  return days.flatMap((d) => d.stops).find((s) => s.alongKm > km + ARRIVAL_KM);
}

export function journeyReducer(
  state: JourneyState,
  action: JourneyAction,
  ctx: JourneyContext,
): JourneyState {
  switch (action.type) {
    case "move": {
      // While a quest is accepted, the car is heading there: keep driving, no new offers.
      const km = clamp(action.km, 0, ctx.routeKm);
      const moved = { ...state, progressKm: km };
      if (state.quest) return moved;
      const dayIndex = dayAt(ctx.days, km);
      const offer = findSideQuest(
        ctx.pool,
        {
          progressKm: km,
          dayIndex,
          lastOfferKm: state.lastOfferKm,
          offersToday: state.offersByDay[dayIndex] ?? 0,
          offeredIds: state.offeredIds,
        },
        ctx.scout,
      );
      if (!offer) return moved;
      return {
        ...moved,
        quest: { offer, status: "offered" },
        offeredIds: [...state.offeredIds, offer.candidate.id],
        lastOfferKm: km,
        offersByDay: { ...state.offersByDay, [dayIndex]: (state.offersByDay[dayIndex] ?? 0) + 1 },
      };
    }
    case "accept":
      return state.quest?.status === "offered"
        ? { ...state, quest: { ...state.quest, status: "accepted" } }
        : state;
    case "skip":
      return state.quest?.status === "offered"
        ? {
            ...state,
            quest: undefined,
            skipped: [...state.skipped, state.quest.offer.candidate.id],
          }
        : state;
    case "arrive":
      return state.quest?.status === "accepted"
        ? {
            ...state,
            progressKm: Math.max(state.progressKm, state.quest.offer.candidate.alongKm),
            quest: { ...state.quest, status: "arrived" },
          }
        : state;
    case "complete": {
      if (state.quest?.status !== "arrived") return state;
      const { offer } = state.quest;
      const c = offer.candidate;
      const entry: JournalEntry = {
        id: `sq-${c.id}`,
        kind: "side_quest",
        placeId: c.id,
        name: c.name,
        city: c.city,
        title: offer.title,
        emoji: offer.emoji,
        photo: action.photo,
        rating: action.rating && clamp(Math.round(action.rating), 1, 5),
        note: action.note?.trim() || undefined,
        xp: offer.xp,
        km: Math.round(state.progressKm),
        at: action.at,
      };
      return {
        ...state,
        quest: undefined,
        journal: [...state.journal, entry],
        xp: state.xp + offer.xp,
      };
    }
    case "checkIn": {
      const stop = ctx.days.flatMap((d) => d.stops).find((s) => s.id === action.stopId);
      if (!stop || state.checkedIn.includes(stop.id)) return state;
      if (state.progressKm < stop.alongKm - ARRIVAL_KM) return state;
      const xp = checkInXp(stop.groupFit ?? 0);
      const entry: JournalEntry = {
        id: `ci-${stop.id}`,
        kind: "check_in",
        placeId: stop.id,
        name: stop.name,
        city: stop.city,
        xp,
        km: Math.round(stop.alongKm),
        at: action.at,
      };
      return {
        ...state,
        checkedIn: [...state.checkedIn, stop.id],
        journal: [...state.journal, entry],
        xp: state.xp + xp,
      };
    }
    case "reset":
      return initialJourney();
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
