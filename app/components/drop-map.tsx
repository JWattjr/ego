"use client";
import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { DropPublic, Position } from "@/lib/types";
import { ENUGU, money } from "@/lib/format";
function Focus({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: false });
  }, [center.lat, center.lng, map]);
  return null;
}
function Picker({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click: (e) => onPick?.(e.latlng.lat, e.latlng.lng),
  });
  if (!onPick) return null;
  return (
    <button
      type="button"
      className="map-centre-button"
      onClick={(e) => {
        e.stopPropagation();
        const centre = map.getCenter();
        onPick(centre.lat, centre.lng);
      }}
    >
      Place drop at map centre
    </button>
  );
}
export default function DropMap({
  drops = [],
  onSelect,
  position,
  exact,
  center = ENUGU,
  onPick,
  picked,
}: {
  drops?: DropPublic[];
  onSelect?: (d: DropPublic) => void;
  position?: Position | null;
  exact?: { lat: number; lng: number };
  center?: { lat: number; lng: number };
  onPick?: (lat: number, lng: number) => void;
  picked?: { lat: number; lng: number };
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={15}
      className="leaflet-map"
      scrollWheelZoom={false}
      aria-label="OpenStreetMap of Enugu"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Focus center={center} />
      <Picker onPick={onPick} />
      {drops
        .filter((d) => d.approx && !d.claimed)
        .map((d) => (
          <Circle
            key={d.dropId}
            center={[d.approx!.lat, d.approx!.lng]}
            radius={d.approx!.radiusM}
            pathOptions={{
              color: "#1760dd",
              fillColor: "#1760dd",
              fillOpacity: 0.12,
              weight: 2,
              dashArray: "5 6",
            }}
            eventHandlers={{ click: () => onSelect?.(d) }}
          >
            <Tooltip>{money(d.amount)} USDC · approximate area</Tooltip>
          </Circle>
        ))}
      {position && (
        <CircleMarker
          center={[position.lat, position.lng]}
          radius={7}
          pathOptions={{
            fillColor: "#142b43",
            color: "white",
            weight: 3,
            fillOpacity: 1,
          }}
        >
          <Tooltip>Your position</Tooltip>
        </CircleMarker>
      )}
      {exact && (
        <CircleMarker
          center={[exact.lat, exact.lng]}
          radius={10}
          pathOptions={{
            fillColor: "#1760dd",
            color: "white",
            weight: 4,
            fillOpacity: 1,
          }}
        >
          <Tooltip permanent>Exact drop spot</Tooltip>
        </CircleMarker>
      )}
      {picked && (
        <CircleMarker
          center={[picked.lat, picked.lng]}
          radius={8}
          pathOptions={{
            fillColor: "#1760dd",
            fillOpacity: 1,
            color: "white",
            weight: 3,
          }}
        >
          <Tooltip>Chosen public location</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
