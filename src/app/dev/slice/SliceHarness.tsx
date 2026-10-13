"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MapMarker } from "@/components/map/RouteMap";
import { pointAt, routeLengthKm } from "@/domain/geo/progress";
import {
  ARRIVAL_KM,
  initialJourney,
  journeyReducer,
  nextStop,
  type JourneyAction,
  type JourneyContext,
  type JourneyState,
} from "@/domain/journey";
import type { SliceCandidate, SliceTrip } from "@/services/sliceTrip";

const RouteMap = dynamic(() => import("@/components/map/RouteMap"), {
  ssr: false,
  loading: () => <div className="bg-muted h-full animate-pulse rounded-xl" />,
});

const STORAGE_KEY = "sidequest.slice.v1";
const SAMPLE_PHOTOS = [
  { src: "/samples/desert-road.svg", alt: "Desert road" },
  { src: "/samples/hot-springs.svg", alt: "Hot springs" },
  { src: "/samples/taco-plate.svg", alt: "Tacos" },
];
/** Auto-drive: km per 100 ms tick (the full demo route takes ~30 s). */
const DRIVE_KM_PER_TICK = 5;

interface Saved {
  trip: SliceTrip;
  journey: JourneyState;
}

function load(): Saved | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : undefined;
  } catch {
    return undefined;
  }
}

function save(value: Saved | undefined) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the slice still works for this page view.
  }
}

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; trip: SliceTrip; journey?: JourneyState; planId: number };

/** Loads the saved trip or plans a new one, then hands it to the drive. */
export default function SliceHarness() {
  const [state, setState] = useState<Load>({ status: "loading" });

  const plan = useCallback(async () => {
    setState({ status: "loading" });
    save(undefined);
    try {
      const res = await fetch("/api/dev/slice/plan", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setState({ status: "ready", trip: json as SliceTrip, planId: Date.now() });
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    const saved = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after mount avoids a hydration mismatch
    if (saved?.trip) setState({ status: "ready", ...saved, planId: 0 });
    else void plan();
  }, [plan]);

  if (state.status === "loading")
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-xl border border-dashed p-10 text-sm">
        Scanning the corridor and scoring places for Matt and Alex…
      </div>
    );
  if (state.status === "error")
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-sm">
        <p className="text-destructive">Planning failed: {state.message}</p>
        <Button onClick={() => void plan()}>Try again</Button>
      </div>
    );
  return (
    <Drive
      key={state.planId}
      trip={state.trip}
      saved={state.journey}
      onReplan={() => void plan()}
    />
  );
}

function Drive({
  trip,
  saved,
  onReplan,
}: {
  trip: SliceTrip;
  saved?: JourneyState;
  onReplan: () => void;
}) {
  const ctx: JourneyContext = useMemo(
    () => ({ days: trip.days, pool: trip.pool, routeKm: trip.route.routeKm }),
    [trip],
  );
  const [journey, dispatch] = useReducer(
    (s: JourneyState, a: JourneyAction) => journeyReducer(s, a, ctx),
    saved ?? initialJourney(),
  );
  const [playing, setPlaying] = useState(false);
  const { quest, progressKm } = journey;
  const routeKm = trip.route.routeKm;

  useEffect(() => save({ trip, journey }), [trip, journey]);

  // Auto-drive; stops for an offer, an accepted quest or the end of the route.
  const driving = playing && !quest && progressKm < routeKm;
  useEffect(() => {
    if (!driving) return;
    const id = setInterval(
      () => dispatch({ type: "move", km: progressKm + DRIVE_KM_PER_TICK }),
      100,
    );
    return () => clearInterval(id);
  }, [driving, progressKm]);

  // alongKm values are on the full geometry; the map line is simplified, so scale.
  const displayKm = useMemo(() => routeLengthKm(trip.route.geometry), [trip]);
  const toMap = useCallback(
    (km: number) => {
      const [lon, lat] = pointAt(trip.route.geometry, (km * displayKm) / routeKm);
      return { lon, lat };
    },
    [trip, displayKm, routeKm],
  );

  const stops = useMemo(() => trip.days.flatMap((d) => d.stops), [trip]);
  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = stops.map((s, i) => ({
      id: s.id,
      lon: s.lon,
      lat: s.lat,
      label: String(i + 1),
      title: s.name,
      tone:
        journey.checkedIn.includes(s.id) || s.alongKm < progressKm - ARRIVAL_KM ? "done" : "stop",
    }));
    if (quest)
      list.push({
        id: `quest-${quest.offer.candidate.id}`,
        lon: quest.offer.candidate.lon,
        lat: quest.offer.candidate.lat,
        label: quest.offer.emoji,
        title: quest.offer.candidate.name,
        tone: "quest",
      });
    return list;
  }, [stops, journey.checkedIn, progressKm, quest]);

  const upcoming = nextStop(trip.days, progressKm);
  const origin = trip.route.geometry.coordinates[0];
  const destination = trip.route.geometry.coordinates.at(-1)!;
  const now = () => new Date().toISOString();

  return (
    <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="flex flex-col gap-3">
        <RouteMap
          className="h-[55vh] min-h-80"
          geometry={trip.route.geometry}
          origin={{ lon: origin[0], lat: origin[1], label: "Anaheim" }}
          destination={{ lon: destination[0], lat: destination[1], label: "Denver" }}
          markers={markers}
          car={toMap(progressKm)}
        />
        <div className="flex flex-col gap-2 rounded-xl border p-3">
          <input
            type="range"
            aria-label="Position along the route"
            min={0}
            max={routeKm}
            step={1}
            value={progressKm}
            onChange={(e) => dispatch({ type: "move", km: Number(e.target.value) })}
            className="w-full accent-orange-600"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button
              size="sm"
              onClick={() => setPlaying((p) => !p)}
              disabled={!!quest || progressKm >= routeKm}
            >
              {driving ? "❚❚ Pause" : "▶ Drive"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!upcoming || !!quest}
              onClick={() => upcoming && dispatch({ type: "move", km: upcoming.alongKm })}
            >
              Skip to next stop
            </Button>
            <span className="text-muted-foreground tabular-nums">
              km {Math.round(progressKm)} / {Math.round(routeKm)}
              {upcoming &&
                ` · next: ${upcoming.name} in ${Math.round(upcoming.alongKm - progressKm)} km`}
            </span>
            <span className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPlaying(false);
                  dispatch({ type: "reset" });
                }}
              >
                Restart drive
              </Button>
              <Button size="sm" variant="ghost" onClick={onReplan}>
                Re-plan
              </Button>
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Qloo: {trip.stats.qloo.liveCalls} live / {trip.stats.qloo.cachedCalls} cached calls ·{" "}
            {trip.stats.kept} candidates · {trip.stats.scored} scored · {trip.pool.length} in the
            Side Quest pool · planned in {(trip.stats.ms / 1000).toFixed(1)} s
          </p>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl border p-3">
          <div className="flex gap-3 text-sm">
            {trip.crew.map((t) => (
              <span key={t.id} className="flex items-center gap-1">
                <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                {t.emoji} {t.name}
              </span>
            ))}
          </div>
          <span className="font-semibold tabular-nums">⭐ {journey.xp} XP</span>
        </div>

        {quest && (
          <QuestCard
            quest={quest}
            trip={trip}
            onAccept={() => dispatch({ type: "accept" })}
            onSkip={() => dispatch({ type: "skip" })}
            onArrive={() => dispatch({ type: "arrive" })}
            onComplete={(input) => dispatch({ type: "complete", ...input, at: now() })}
          />
        )}

        <Journal journey={journey} />

        <div className="flex flex-col gap-3">
          {trip.days.map((d) => (
            <Card key={d.index} size="sm">
              <CardHeader>
                <CardTitle>
                  Day {d.index + 1}{" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    km {Math.round(d.startKm)}–{Math.round(d.endKm)} · {d.stops.length} stops
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {d.stops.map((s) => (
                  <StopRow
                    key={s.id}
                    stop={s}
                    number={stops.indexOf(s) + 1}
                    trip={trip}
                    reached={progressKm >= s.alongKm - ARRIVAL_KM}
                    checkedIn={journey.checkedIn.includes(s.id)}
                    onCheckIn={() => dispatch({ type: "checkIn", stopId: s.id, at: now() })}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </aside>
    </div>
  );
}

function Scores({ c, trip }: { c: SliceCandidate; trip: SliceTrip }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-xs">
      <span className="font-semibold">{c.vibePct}% Your Vibe</span>
      {trip.crew.map((t) => (
        <span key={t.id} className="flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ background: t.color }} />
          {t.name} {Math.round(100 * (c.scores?.[t.id]?.percentile ?? 0))}
        </span>
      ))}
      <span className="text-muted-foreground">+{c.detourMin} min</span>
    </span>
  );
}

function StopRow({
  stop,
  number,
  trip,
  reached,
  checkedIn,
  onCheckIn,
}: {
  stop: SliceTrip["days"][number]["stops"][number];
  number: number;
  trip: SliceTrip;
  reached: boolean;
  checkedIn: boolean;
  onCheckIn: () => void;
}) {
  const especially = trip.crew.filter((t) => stop.especiallyFor?.includes(t.id));
  return (
    <div className={`flex gap-3 ${checkedIn ? "opacity-60" : ""}`}>
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-[11px] font-semibold text-white">
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{stop.name}</p>
            <p className="text-muted-foreground text-xs">
              {stop.city} · {stop.bucket === "food" ? "Food & drink" : "Experience"}
            </p>
          </div>
          {checkedIn ? (
            <Badge variant="secondary">Checked in</Badge>
          ) : (
            reached && (
              <Button size="xs" onClick={onCheckIn}>
                Check in
              </Button>
            )
          )}
        </div>
        <Scores c={stop} trip={trip} />
        <p className="text-muted-foreground text-xs">{stop.why.sentence}</p>
        <div className="flex flex-wrap gap-1">
          {especially.map((t) => (
            <Badge key={t.id} variant="outline">
              Especially for {t.name}
            </Badge>
          ))}
          {stop.belowFloor && <Badge variant="outline">Quiet stretch pick</Badge>}
        </div>
      </div>
    </div>
  );
}

function QuestCard({
  quest,
  trip,
  onAccept,
  onSkip,
  onArrive,
  onComplete,
}: {
  quest: NonNullable<JourneyState["quest"]>;
  trip: SliceTrip;
  onAccept: () => void;
  onSkip: () => void;
  onArrive: () => void;
  onComplete: (input: { photo?: string; rating?: number; note?: string }) => void;
}) {
  const { offer, status } = quest;
  // The pool candidate carries the precomputed "why" (the offer holds a plain Candidate).
  const c = (trip.pool.find((p) => p.id === offer.candidate.id) ??
    offer.candidate) as SliceCandidate;
  const [photo, setPhoto] = useState<string>();
  const [rating, setRating] = useState<number>();
  const [note, setNote] = useState("");

  return (
    <Card className="border-violet-400 bg-violet-50/60 dark:bg-violet-950/30">
      <CardHeader>
        <p className="text-xs font-semibold tracking-wide text-violet-700 uppercase dark:text-violet-300">
          {status === "offered"
            ? "Side Quest unlocked"
            : status === "accepted"
              ? "Quest accepted"
              : "You've arrived"}
        </p>
        <CardTitle className="text-lg">
          {offer.emoji} {offer.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <p className="font-medium">{c.name}</p>
          <p className="text-muted-foreground text-xs">
            {c.city} · {c.detourMin} minutes off the route · +{offer.xp} XP
          </p>
        </div>
        <Scores c={c} trip={trip} />
        {c.why && <p className="text-sm">{c.why.sentence}</p>}

        {status === "offered" && (
          <div className="flex gap-2">
            <Button onClick={onAccept}>Take the detour</Button>
            <Button variant="outline" onClick={onSkip}>
              Skip
            </Button>
          </div>
        )}
        {status === "accepted" && <Button onClick={onArrive}>Jump to arrival</Button>}
        {status === "arrived" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {SAMPLE_PHOTOS.map((p) => (
                <button
                  key={p.src}
                  type="button"
                  onClick={() => setPhoto(p.src)}
                  className={`overflow-hidden rounded-lg border-2 ${photo === p.src ? "border-violet-600" : "border-transparent"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local SVG samples */}
                  <img src={p.src} alt={p.alt} className="aspect-4/3 w-full object-cover" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => setRating(n)}
                  className="text-xl"
                >
                  {rating !== undefined && n <= rating ? "★" : "☆"}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A line for the journal (optional)"
              rows={2}
              className="bg-background rounded-lg border p-2 text-sm"
            />
            <Button onClick={() => onComplete({ photo, rating, note })}>
              Complete quest · +{offer.xp} XP
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Journal({ journey }: { journey: JourneyState }) {
  if (journey.journal.length === 0)
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-3 text-xs">
        Journal is empty. Drive, check in at stops and take Side Quests to fill it.
      </p>
    );
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Journal</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {[...journey.journal].reverse().map((e) => (
          <div key={e.id} className="flex items-center gap-3 text-sm">
            {e.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local SVG samples
              <img src={e.photo} alt="" className="size-10 rounded-md object-cover" />
            ) : (
              <span className="bg-muted flex size-10 items-center justify-center rounded-md">
                {e.kind === "side_quest" ? e.emoji : "📍"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {e.kind === "side_quest" ? `${e.emoji} ${e.title}: ` : "Checked in: "}
                {e.name}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {e.city} · km {e.km}
                {e.rating ? ` · ${"★".repeat(e.rating)}` : ""}
                {e.note ? ` · “${e.note}”` : ""}
              </p>
            </div>
            <span className="text-xs font-semibold tabular-nums">+{e.xp}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
