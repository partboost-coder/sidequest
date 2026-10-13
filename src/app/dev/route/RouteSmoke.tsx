"use client";

import type { LineString } from "geojson";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const RouteMap = dynamic(() => import("@/components/map/RouteMap"), {
  ssr: false,
  loading: () => <div className="bg-muted h-full animate-pulse rounded-xl" />,
});

const ANAHEIM = { lon: -117.9145, lat: 33.8366, label: "Anaheim, CA" };
const DENVER = { lon: -104.9903, lat: 39.7392, label: "Denver, CO" };

interface RouteResponse {
  durationSec: number;
  distanceM: number;
  legs: { summary?: string }[];
  geometry: LineString;
  fullPointCount: number;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; route: RouteResponse };

export default function RouteSmoke() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: [ANAHEIM.lon, ANAHEIM.lat],
        destination: [DENVER.lon, DENVER.lat],
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
        setState({ status: "ok", route: json });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ status: "error", message: e.message });
      });
    return () => controller.abort();
  }, []);

  const route = state.status === "ok" ? state.route : undefined;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Route" value={`${ANAHEIM.label} → ${DENVER.label}`} />
        <Stat label="Drive time" value={route ? formatDuration(route.durationSec) : "…"} />
        <Stat
          label="Distance"
          value={route ? `${Math.round(route.distanceM / 1609.34).toLocaleString()} mi` : "…"}
        />
        <Stat
          label="Points (display / full)"
          value={
            route
              ? `${route.geometry.coordinates.length} / ${route.fullPointCount.toLocaleString()}`
              : "…"
          }
        />
      </dl>
      {route?.legs[0]?.summary && (
        <p className="text-muted-foreground text-sm">Via {route.legs[0].summary}</p>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm"
        >
          Route failed: {state.message}
        </p>
      )}
      <RouteMap
        className="min-h-[420px] flex-1"
        geometry={route?.geometry}
        origin={ANAHEIM}
        destination={DENVER}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h}h ${m}m`;
}
