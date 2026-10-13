"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { CoinEntrance } from "./coin3d";
import { Coin } from "./ui";

// three.js loads only on screens that show the 3D coin; the CSS coin stands in while it loads
// and stays on devices without WebGL.
const Coin3DCanvas = dynamic(() => import("./coin3d"), { ssr: false, loading: () => null });

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Coin3D({ size = 220, entrance = "none" }: { size?: number; entrance?: CoinEntrance }) {
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);
  if (!gl)
    return (
      <div className="coin3d" style={{ width: size, height: size, display: "grid", placeItems: "center" }}>
        <Coin size="xl" spin float style={{ "--s": `${Math.round(size * 0.62)}px` } as React.CSSProperties} />
      </div>
    );
  return <Coin3DCanvas size={size} entrance={entrance} />;
}
