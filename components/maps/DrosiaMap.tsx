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
  /** Makes `points` markers clickable (keyboard-focusable) and reports the click back. */
  onPointSelect?: (point: DrosiaMapPoint) => void;
  onMapReady?: (map: LeafletMapInstance) => void;
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
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
  onPointSelect,
  onMapReady,
  onMapClick,
}: DrosiaMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const overlaysRef = useRef<Layer[]>([]);
  const onMapReadyRef = useRef(onMapReady);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

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

        map.on("click", (e) => {
          onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        mapRef.current = map;
        onMapReadyRef.current?.(map);
      }

      const map = mapRef.current;
      overlaysRef.current.forEach((layer) => layer.remove());
      overlaysRef.current = [];

      if (mode === "heat") {
        // Heat visualizes severity of PUBLISHED reports; pending pins have no
        // votes/verified age semantics yet, so they stay out of this mode.
        overlaysRef.current.push(
          ...mappedReports.filter((report) => !report.pending).map((report) => addHeatCircle(L, map, report)),
        );
      } else {
        overlaysRef.current.push(
          ...mappedReports.map((report) =>
            addReportMarker(L, map, report, selectedToken === report.public_token, () => onReportSelect?.(report)),
          ),
        );
      }

      overlaysRef.current.push(
        ...mappedPoints.map((point) =>
          addPointMarker(
            L,
            map,
            point,
            selectedToken != null && point.id === selectedToken,
            onPointSelect ? () => onPointSelect(point) : undefined,
          ),
        ),
      );

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
    onPointSelect,
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
  // Pending (not yet approved/anonymized): neutral gray + hourglass, so it
  // reads as "received, in review" rather than a severity-rated open report.
  const color = report.pending
    ? "var(--muted)"
    : report.status === "resolved"
      ? "var(--success)"
      : severityColor(days);
  const label = String(displayedVoteCount(report));
  const marker = L.marker([report.lat, report.lng], {
    icon: L.divIcon({
      className: "drosia-leaflet-marker",
      html: report.pending ? pinHtmlRaw(color, PENDING_GLYPH_SVG, selected) : pinHtml(color, label, selected),
      iconSize: [46, 54],
      iconAnchor: [23, 50],
    }),
    keyboard: true,
    title: label,
  });

  marker.on("click keypress", onClick);
  marker.addTo(map);
  return marker;
}

function addPointMarker(
  L: typeof import("leaflet"),
  map: LeafletMapInstance,
  point: DrosiaMapPoint,
  selected: boolean,
  onClick?: () => void,
): Marker {
  const clickable = !!onClick;
  const marker = L.marker([point.lat, point.lng], {
    icon: L.divIcon({
      className: "drosia-leaflet-marker",
      html: pinHtml(point.color ?? "var(--primary)", point.label ?? "", selected),
      iconSize: [46, 54],
      iconAnchor: [23, 50],
    }),
    interactive: clickable,
    keyboard: clickable,
    title: point.title,
  });

  if (onClick) marker.on("click keypress", onClick);
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

function displayedVoteCount(report: PublicReport): number {
  return Math.max(1, Number.isFinite(report.vote_count) ? report.vote_count : 0);
}

function pinHtml(color: string, label: string, selected: boolean): string {
  return pinHtmlRaw(color, escapeHtml(label), selected);
}

/** `inner` must already be safe HTML (escaped text or a trusted SVG string). */
function pinHtmlRaw(color: string, inner: string, selected: boolean): string {
  const shadow = selected ? "0 0 0 6px rgba(30,202,217,.22),0 8px 20px rgba(11,43,48,.2)" : undefined;
  const shadowRule = shadow ? `box-shadow:${shadow}` : "";
  return `<span class="drosia-map-pin" style="--pin-color:${color};${shadowRule}"><span class="drosia-map-pin__count">${inner}</span></span>`;
}

/** Hourglass line icon for pending pins (no emoji in pins — handover 1b). */
const PENDING_GLYPH_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22"/><path d="M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/></svg>';

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
