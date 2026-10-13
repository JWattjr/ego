// Ego's map look: OpenFreeMap's free vector "Positron" style (no API key), recoloured to match the
// concept: cool grey land, white streets, soft green parks, blue water, quiet labels.
import type { StyleSpecification } from "maplibre-gl";

const BASE = "https://tiles.openfreemap.org/styles/positron";
const PAINT: Record<string, Record<string, string>> = {
  background: { "background-color": "#eef1f5" },
  park: { "fill-color": "#cfe9c6" },
  landcover_wood: { "fill-color": "#d5ecca" },
  water: { "fill-color": "#b9d6f5" },
  waterway: { "line-color": "#b9d6f5" },
  landuse_residential: { "fill-color": "#eceff3" },
  building: { "fill-color": "#e4e8ee", "fill-outline-color": "#dbe0e7" },
  highway_path: { "line-color": "#ffffff" },
  highway_minor: { "line-color": "#ffffff" },
  highway_major_casing: { "line-color": "#dde2ea" },
  highway_major_inner: { "line-color": "#ffffff" },
  highway_motorway_casing: { "line-color": "#d6dce6" },
  highway_motorway_inner: { "line-color": "#ffffff" },
  railway: { "line-color": "#c9ced8" },
  railway_transit: { "line-color": "#c9ced8" },
  "highway-name-minor": { "text-color": "#8a93a5" },
  "highway-name-major": { "text-color": "#6f7a8e" },
  label_other: { "text-color": "#7a8497" },
  label_village: { "text-color": "#4c5870" },
  label_town: { "text-color": "#3d4860" },
  label_city: { "text-color": "#2a3448" },
  water_name_point_label: { "text-color": "#5b84bf" },
  water_name_line_label: { "text-color": "#5b84bf" },
};

let cached: Promise<StyleSpecification> | null = null;
export function egoMapStyle(): Promise<StyleSpecification> {
  return (cached ??= fetch(BASE)
    .then((r) => r.json() as Promise<StyleSpecification>)
    .then((style) => {
      for (const layer of style.layers) {
        const p = PAINT[layer.id];
        if (p && "paint" in layer) layer.paint = { ...(layer.paint as object), ...p } as never;
      }
      return style;
    })
    .catch((e) => {
      cached = null; // allow a retry next time
      throw e;
    }));
}
