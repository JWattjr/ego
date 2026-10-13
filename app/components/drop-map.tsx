"use client";
import { useEffect } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { DropPublic, Position } from "@/lib/types";
import { ENUGU, money } from "@/lib/format";

const coinHtml = (label?: string, cls = "") =>
  `<div class="coin-pin-inner ${cls}"><div class="coin"><span class="coin-dollar">$</span></div>${
    label ? `<span class="coin-pin-label">${label}</span>` : ""
  }</div>`;
const coinIcon = (label?: string, cls = "") =>
  L.divIcon({ className: "coin-pin", html: coinHtml(label, cls), iconSize: [0, 0] });
const meIcon = L.divIcon({ className: "coin-pin", html: '<div class="me-pin"></div>', iconSize: [0, 0] });

// offsetY > 0 keeps the focus point above a bottom sheet that covers the lower map.
function Focus({ center, offsetY = 0 }: { center: { lat: number; lng: number }; offsetY?: number }) {
  const map = useMap();
  useEffect(() => {
    const p = map.project([center.lat, center.lng], map.getZoom()).add([0, offsetY]);
    map.flyTo(map.unproject(p, map.getZoom()), map.getZoom(), { duration: 0.6 });
  }, [center.lat, center.lng, offsetY, map]);
  return null;
}
function Picker({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  const map = useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) });
  if (!onPick) return null;
  return (
    <button
      type="button"
      className="map-centre-button"
      onClick={(e) => {
        e.stopPropagation();
        const c = map.getCenter();
        onPick(c.lat, c.lng);
      }}
    >
      Place drop at map centre
    </button>
  );
}

export default function DropMap({
  drops = [],
  onSelect,
  selectedId,
  position,
  exact,
  center = ENUGU,
  zoom = 15,
  offsetY = 0,
  onPick,
  picked,
  areas = [],
  dots = [],
}: {
  drops?: DropPublic[];
  onSelect?: (d: DropPublic) => void;
  selectedId?: string;
  position?: Position | null;
  exact?: { lat: number; lng: number };
  center?: { lat: number; lng: number };
  zoom?: number;
  offsetY?: number;
  onPick?: (lat: number, lng: number) => void;
  picked?: { lat: number; lng: number };
  areas?: { lat: number; lng: number; radiusM: number }[]; // Hide money: chosen areas
  dots?: { lat: number; lng: number }[]; // Hide money: preview of where drops will land
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className="leaflet-map"
      zoomControl={false}
      scrollWheelZoom={false}
      attributionControl
      aria-label="Map of nearby drops"
    >
      {/* Standard OSM tiles, softened in CSS (.leaflet-tile-pane) so the coins carry the colour. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Focus center={center} offsetY={offsetY} />
      <Picker onPick={onPick} />
      {drops
        .filter((d) => d.approx && !d.claimed)
        .map((d) => (
          <Circle
            key={`area-${d.dropId}`}
            center={[d.approx!.lat, d.approx!.lng]}
            radius={d.approx!.radiusM}
            pathOptions={{
              color: "#1f6bff",
              weight: d.dropId === selectedId ? 2 : 0,
              dashArray: "4 6",
              fillColor: "#1f6bff",
              fillOpacity: d.dropId === selectedId ? 0.12 : 0.06,
            }}
            eventHandlers={{ click: () => onSelect?.(d) }}
          />
        ))}
      {!exact &&
        drops
          .filter((d) => d.approx && !d.claimed)
          .map((d) => (
            <Marker
              key={d.dropId}
              position={[d.approx!.lat, d.approx!.lng]}
              icon={coinIcon(`${money(d.amount)} USDC`, `${Number(money(d.amount)) >= 2 ? "big" : ""} ${d.dropId === selectedId ? "selected" : ""}`)}
              eventHandlers={{ click: () => onSelect?.(d) }}
              title={`${money(d.amount)} USDC drop, approximate area`}
            />
          ))}
      {exact && <Marker position={[exact.lat, exact.lng]} icon={coinIcon("Right here", "big selected")} />}
      {areas.map((a, i) => (
        <Circle key={`hide-${i}`} center={[a.lat, a.lng]} radius={a.radiusM} pathOptions={{ color: "#1f6bff", weight: 1.5, dashArray: "4 5", fillColor: "#1f6bff", fillOpacity: 0.1 }} />
      ))}
      {dots.map((d, i) => (
        <CircleMarker key={`dot-${i}`} center={[d.lat, d.lng]} radius={3.5} pathOptions={{ color: "#fff", weight: 1, fillColor: "#1f6bff", fillOpacity: 1 }} />
      ))}
      {picked && <Marker position={[picked.lat, picked.lng]} icon={coinIcon("Your drop", "big")} />}
      {position && <Marker position={[position.lat, position.lng]} icon={meIcon} title="You" />}
    </MapContainer>
  );
}
