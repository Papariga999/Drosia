"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CircleMarker, Layer, Map as LeafletMapInstance, Marker } from "leaflet";
import { reportAgeDays, severityColor } from "@/lib/severity";
import type { PublicReport } from "@/lib/mock";

type MapMode = "pins" | "heat";

export interface DrosiaMapPoint {
  id?: string;
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  title?: string;
}

interface DrosiaMapProps {
  reports?: PublicReport[];
  points?: DrosiaMapPoint[];
  mode?: MapMode;
  center?: [number, number];
  zoom?: number;
  fitToMarkers?: boolean;
  interactive?: boolean;
  showAttribution?: boolean;
  showZoomControl?: boolean;
  className?: string;
  ariaLabel?: string;
  selectedToken?: string | null;
  onReportSelect?: (report: PublicReport) => void;
  onMapReady?: (map: LeafletMapInstance) => void;
}

const DEFAULT_CENTER: [number, number] = [
  publicNumber(process.env.NEXT_PUBLIC_DEFAULT_MAP_LAT, 36.3461),
  publicNumber(process.env.NEXT_PUBLIC_DEFAULT_MAP_LNG, 28.1233),
];
const DEFAULT_ZOOM = publicNumber(process.env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM, 11);
const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim() ||
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim() ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function DrosiaMap({
  reports = [],
  points = [],
  mode = "pins",
  center,
  zoom = DEFAULT_ZOOM,
  fitToMarkers = true,
  interactive = true,
  showAttribution = true,
  showZoomControl = true,
  className = "h-full w-full",
  ariaLabel = "Map",
  selectedToken,
  onReportSelect,
  onMapReady,
}: DrosiaMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const overlaysRef = useRef<Layer[]>([]);
  const onMapReadyRef = useRef(onMapReady);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  const mappedReports = useMemo(
    () => reports.filter((report) => isValidLatLng(report.lat, report.lng)),
    [reports],
  );
  const mappedPoints = useMemo(
    () => points.filter((point) => isValidLatLng(point.lat, point.lng)),
    [points],
  );
  const locations = useMemo(
    () => [
      ...mappedReports.map((report): [number, number] => [report.lat, report.lng]),
      ...mappedPoints.map((point): [number, number] => [point.lat, point.lng]),
    ],
    [mappedPoints, mappedReports],
  );

  useEffect(() => {
    let cancelled = false;

    async function drawMap() {
      if (!mapElementRef.current) return;

      const L = await import("leaflet");
      if (cancelled || !mapElementRef.current) return;

      const initialCenter = center ?? locations[0] ?? DEFAULT_CENTER;
      if (!mapRef.current) {
        const map = L.map(mapElementRef.current, {
          attributionControl: showAttribution,
          zoomControl: false,
          dragging: interactive,
          scrollWheelZoom: interactive,
          doubleClickZoom: interactive,
          boxZoom: interactive,
          keyboard: interactive,
          touchZoom: interactive,
        }).setView(initialCenter, zoom);

        if (interactive && showZoomControl) L.control.zoom({ position: "bottomleft" }).addTo(map);
        L.tileLayer(TILE_URL, {
          attribution: showAttribution ? TILE_ATTRIBUTION : "",
          maxZoom: 19,
          detectRetina: true,
        }).addTo(map);

        mapRef.current = map;
        onMapReadyRef.current?.(map);
      }

      const map = mapRef.current;
      overlaysRef.current.forEach((layer) => layer.remove());
      overlaysRef.current = [];

      if (mode === "heat") {
        overlaysRef.current.push(...mappedReports.map((report) => addHeatCircle(L, map, report)));
      } else {
        overlaysRef.current.push(
          ...mappedReports.map((report) =>
            addReportMarker(L, map, report, selectedToken === report.public_token, () => onReportSelect?.(report)),
          ),
        );
      }

      overlaysRef.current.push(...mappedPoints.map((point) => addPointMarker(L, map, point)));

      if (fitToMarkers && locations.length > 1) {
        const bounds = L.latLngBounds(locations);
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.2), { animate: false, maxZoom: 14 });
      } else {
        map.setView(center ?? locations[0] ?? DEFAULT_CENTER, locations.length ? zoom : DEFAULT_ZOOM, {
          animate: false,
        });
      }

      window.requestAnimationFrame(() => map.invalidateSize());
    }

    drawMap().catch((error) => {
      console.error("[DrosiaMap] Leaflet render failed:", error);
    });

    return () => {
      cancelled = true;
      overlaysRef.current.forEach((layer) => layer.remove());
      overlaysRef.current = [];
    };
  }, [
    center,
    fitToMarkers,
    interactive,
    locations,
    mappedPoints,
    mappedReports,
    mode,
    onReportSelect,
    selectedToken,
    showAttribution,
    showZoomControl,
    zoom,
  ]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mapElementRef}
      className={`${className} bg-[#cfe3e6]`}
      role={interactive ? "application" : "img"}
      aria-label={ariaLabel}
    />
  );
}

function addReportMarker(
  L: typeof import("leaflet"),
  map: LeafletMapInstance,
  report: PublicReport,
  selected: boolean,
  onClick: () => void,
): Marker {
  const days = reportAgeDays(report);
  const color = report.status === "resolved" ? "var(--success)" : severityColor(days);
  const marker = L.marker([report.lat, report.lng], {
    icon: L.divIcon({
      className: "drosia-leaflet-marker",
      html: pinHtml(color, String(days), selected),
      iconSize: [46, 54],
      iconAnchor: [23, 50],
    }),
    keyboard: true,
    title: String(days),
  });

  marker.on("click keypress", onClick);
  marker.addTo(map);
  return marker;
}

function addPointMarker(
  L: typeof import("leaflet"),
  map: LeafletMapInstance,
  point: DrosiaMapPoint,
): Marker {
  const marker = L.marker([point.lat, point.lng], {
    icon: L.divIcon({
      className: "drosia-leaflet-marker",
      html: pinHtml(point.color ?? "var(--primary)", point.label ?? "", false),
      iconSize: [46, 54],
      iconAnchor: [23, 50],
    }),
    interactive: false,
    keyboard: false,
    title: point.title,
  });

  marker.addTo(map);
  return marker;
}

function addHeatCircle(L: typeof import("leaflet"), map: LeafletMapInstance, report: PublicReport): CircleMarker {
  const days = reportAgeDays(report);
  const color = report.status === "resolved" ? "var(--success)" : severityColor(days);
  const radius = Math.min(34, 14 + Math.max(report.vote_count, report.confirm_count));
  const circle = L.circleMarker([report.lat, report.lng], {
    radius,
    color,
    weight: 1,
    opacity: 0.45,
    fillColor: color,
    fillOpacity: 0.28,
  });

  circle.addTo(map);
  return circle;
}

function pinHtml(color: string, label: string, selected: boolean): string {
  const shadow = selected ? "0 0 0 6px rgba(30,202,217,.22),0 8px 20px rgba(11,43,48,.2)" : undefined;
  const shadowRule = shadow ? `box-shadow:${shadow}` : "";
  return `<span class="drosia-map-pin" style="--pin-color:${color};${shadowRule}"><span class="drosia-map-pin__count">${escapeHtml(label)}</span></span>`;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function publicNumber(value: string | undefined, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
