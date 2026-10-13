"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { bbox, lineString } from "@turf/turf";
import type { LineString } from "geojson";
import { useMemo, useRef } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";

import { getClientEnv } from "@/lib/config/env.client";

export interface RouteMapProps {
  geometry?: LineString;
  origin?: { lon: number; lat: number; label?: string };
  destination?: { lon: number; lat: number; label?: string };
  className?: string;
}

const STYLE = "mapbox://styles/mapbox/standard";
const US_VIEW = { longitude: -98.5, latitude: 39.5, zoom: 3.2 };

export default function RouteMap({ geometry, origin, destination, className }: RouteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const token = getClientEnv().NEXT_PUBLIC_MAPBOX_TOKEN;

  const bounds = useMemo(() => {
    if (!geometry || geometry.coordinates.length < 2) return undefined;
    const [w, s, e, n] = bbox(lineString(geometry.coordinates));
    return [
      [w, s],
      [e, n],
    ] as [[number, number], [number, number]];
  }, [geometry]);

  const fit = () => {
    if (bounds) mapRef.current?.fitBounds(bounds, { padding: 56, duration: 800 });
  };

  if (!token) {
    return (
      <div className={className}>
        <div className="text-muted-foreground flex h-full items-center justify-center rounded-xl border border-dashed p-6 text-sm">
          Set NEXT_PUBLIC_MAPBOX_TOKEN to show the map.
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle={STYLE}
        initialViewState={US_VIEW}
        onLoad={fit}
        style={{ width: "100%", height: "100%", borderRadius: "0.75rem" }}
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
