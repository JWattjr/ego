"use client";
// Dev-only: renders still poses of the 3D coin and saves them to public/coin/ for small coins.
import { useEffect, useState } from "react";

const POSES: Record<string, [number, number]> = { front: [0.12, -0.32], tilt: [0.18, -0.62] };

export default function CoinStills() {
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    (async () => {
      await document.fonts.load("700 470px Manrope"); // the $ is drawn with the brand font
      const { renderCoinStill } = await import("@/components/coin3d");
      for (const [name, pose] of Object.entries(POSES)) {
        const data = renderCoinStill(pose, 512);
        const r = await fetch("/api/dev/coin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, data }) });
        setLog((l) => [...l, `${name}: ${r.status}`]);
      }
    })();
  }, []);
  return <pre data-log style={{ padding: 16 }}>{log.join("\n") || "rendering…"}</pre>;
}
