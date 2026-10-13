"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { bbox, lineString } from "@turf/turf";
import type { LineString } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";

import { getClientEnv } from "@/lib/config/env.client";

export interface RouteMapProps {
  geometry?: LineString;
  origin?: { lon: number; lat: number; label?: string };
  destination?: { lon: number; lat: number; label?: string };
  /** Numbered stops and Side Quest pins. */
  markers?: MapMarker[];
  /** The simulated car. */
  car?: { lon: number; lat: number };
  className?: string;
}

export interface MapMarker {
  id: string;
  lon: number;
  lat: number;
  /** Short text inside the pin ("3", "✨"). */
  label: string;
  title?: string;
  tone: "stop" | "done" | "quest";
}

const MARKER_TONE: Record<MapMarker["tone"], string> = {
  stop: "bg-orange-600 text-white",
  done: "bg-stone-400 text-white",
  quest: "bg-violet-600 text-white ring-4 ring-violet-300 animate-pulse",
};

const STYLE = "mapbox://styles/mapbox/standard";
const US_VIEW = { longitude: -98.5, latitude: 39.5, zoom: 3.2 };

export default function RouteMap({
  geometry,
  origin,
  destination,
  markers,
  car,
  className,
}: RouteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const token = getClientEnv().NEXT_PUBLIC_MAPBOX_TOKEN;

  const bounds = useMemo(() => {
    if (!geometry || geometry.coordinates.length < 2) return undefined;
    const [w, s, e, n] = bbox(lineString(geometry.coordinates));
    return [
      [w, s],
      [e, n],
    ] as [[number, number], [number, number]];
  }, [geometry]);

  // Fit whenever the route changes once the map is ready. The map and the route load
  // independently, so either can finish first.
  useEffect(() => {
    if (loaded && bounds) mapRef.current?.fitBounds(bounds, { padding: 56, duration: 800 });
  }, [loaded, bounds]);

  if (!token) {
    return (
      <div className={className}>
        <div className="text-muted-foreground flex h-full items-center justify-center rounded-xl border border-dashed p-6 text-sm">
          Set NEXT_PUBLIC_MAPBOX_TOKEN to show the map.
        </div>
      </div>
    );
  }

  // The Map is absolutely positioned so it fills the wrapper even when the wrapper's height
  // comes from min-height or flex (a plain height: 100% would collapse to 0).
  return (
    <div className={`relative ${className ?? ""}`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle={STYLE}
        initialViewState={US_VIEW}
        onLoad={() => setLoaded(true)}
        style={{ position: "absolute", inset: 0, borderRadius: "0.75rem" }}
        reuseMaps
      >
        {geometry && (
          <Source id="route" type="geojson" data={{ type: "Feature", properties: {}, geometry }}>
            <Layer
              id="route-casing"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#ffffff", "line-width": 9, "line-emissive-strength": 1 }}
            />
            <Layer
              id="route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#ea580c", "line-width": 5, "line-emissive-strength": 1 }}
            />
          </Source>
        )}
        {origin && (
          <Pin lon={origin.lon} lat={origin.lat} label={origin.label ?? "Start"} tone="start" />
        )}
        {destination && (
          <Pin
            lon={destination.lon}
            lat={destination.lat}
            label={destination.label ?? "End"}
            tone="end"
          />
        )}
        {markers?.map((m) => (
          <Marker key={m.id} longitude={m.lon} latitude={m.lat} anchor="center">
            <span
              title={m.title}
              className={`flex size-6 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold shadow ${MARKER_TONE[m.tone]}`}
            >
              {m.label}
            </span>
          </Marker>
        ))}
        {car && (
          <Marker longitude={car.lon} latitude={car.lat} anchor="center" style={{ zIndex: 10 }}>
            <span className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-sky-600 text-base shadow-lg">
              🚗
            </span>
          </Marker>
        )}
      </Map>
    </div>
  );
}

function Pin({
  lon,
  lat,
  label,
  tone,
}: {
  lon: number;
  lat: number;
  label: string;
  tone: "start" | "end";
}) {
  return (
    <Marker longitude={lon} latitude={lat} anchor="bottom">
      <div className="flex flex-col items-center">
        <span className="bg-background mb-1 rounded-full px-2 py-0.5 text-xs font-medium shadow">
          {label}
        </span>
        <span
          className={`size-4 rounded-full border-2 border-white shadow ${tone === "start" ? "bg-emerald-600" : "bg-orange-600"}`}
        />
      </div>
    </Marker>
  );
}
