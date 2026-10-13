"use client";
// Dev-only: renders still poses of the 3D coin and saves them to public/coin/ for small coins.
import { useEffect, useState } from "react";

const POSES: Record<string, [number, number]> = { front: [0.12, -0.32], tilt: [0.18, -0.62] };

// Crop a rendered coin to a square around its visible pixels, with a little transparent padding,
// so the image can be shown at 100% without clipping the rim.
async function cropToCoin(dataUrl: string, padding = 0.04, out = 512) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
  const side = Math.max(maxX - minX, maxY - minY) * (1 + padding * 2);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const o = document.createElement("canvas");
  o.width = o.height = out;
  o.getContext("2d")!.drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, out, out);
  return o.toDataURL("image/png");
}

export default function CoinStills() {
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    (async () => {
      await document.fonts.load("700 470px Manrope"); // the $ is drawn with the brand font
      const { renderCoinStill } = await import("@/components/coin3d");
      for (const [name, pose] of Object.entries(POSES)) {
        const data = await cropToCoin(renderCoinStill(pose, 768));
        const r = await fetch("/api/dev/coin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, data }) });
        setLog((l) => [...l, `${name}: ${r.status}`]);
      }
    })();
  }, []);
  return <pre data-log style={{ padding: 16 }}>{log.join("\n") || "rendering…"}</pre>;
}
