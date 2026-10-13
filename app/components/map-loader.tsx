"use client";
import dynamic from "next/dynamic";
export const DropMap = dynamic(() => import("./drop-map"), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder" role="status">
      Opening the map…
    </div>
  ),
});
