"use client";
// A real 3D USDC-style coin, built in code (no model file): lathe-turned body with a raised,
// bevelled rim and recessed faces, an embossed $ + arcs mark, and a ridged edge.
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type CoinEntrance = "none" | "drop";

const BLUE = "#2a60d2";
const R = 1, H = 0.085, FACE_R = 0.8, FACE_Y = 0.045;

// Coin profile from back face to front face (x = radius, y = height), turned around the Y axis.
const PROFILE = [
  [FACE_R, -FACE_Y], [0.82, -0.072], [0.85, -H], [0.95, -H], [0.99, -0.072], [R, -0.05],
  [R, 0.05], [0.99, 0.072], [0.95, H], [0.85, H], [0.82, 0.072], [FACE_R, FACE_Y],
].map(([x, y]) => new THREE.Vector2(x, y));

// The face artwork, drawn once: colour map (blue face, white mark) and bump map (mark raised, soft edges).
function faceTextures() {
  const size = 1024, c = size / 2;
  const draw = (ctx: CanvasRenderingContext2D, ink: string) => {
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineCap = "round";
    ctx.lineWidth = 64;
    for (const start of [-0.32, 0.68]) { // two arcs with gaps top and bottom, like the CSS coin
      ctx.beginPath();
      ctx.arc(c, c, 330, (start + 0.12) * Math.PI, (start + 0.52) * Math.PI);
      ctx.stroke();
    }
    ctx.font = "800 470px Manrope, 'DM Sans', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", c, c + 24);
  };
  const colour = document.createElement("canvas");
  colour.width = colour.height = size;
  const a = colour.getContext("2d")!;
  const g = a.createRadialGradient(c * 0.7, c * 0.6, 40, c, c, c);
  g.addColorStop(0, "#4580ec");
  g.addColorStop(1, "#1f55c4");
  a.fillStyle = g;
  a.fillRect(0, 0, size, size);
  draw(a, "#f5f8ff");

  const bump = document.createElement("canvas");
  bump.width = bump.height = size;
  const b = bump.getContext("2d")!;
  b.fillStyle = "#000";
  b.fillRect(0, 0, size, size);
  b.filter = "blur(7px)"; // soft bevel on the raised mark
  draw(b, "#fff");

  const map = new THREE.CanvasTexture(colour);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return { map, bump: new THREE.CanvasTexture(bump) };
}

// Fine vertical ridges for the coin edge.
function ridgeTexture() {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 4;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 1024, 4);
  ctx.fillStyle = "#fff";
  for (let x = 0; x < 1024; x += 6.4) ctx.fillRect(x, 0, 3.2, 4); // 160 ridges
  return new THREE.CanvasTexture(cv);
}

function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return (
    <>
      <directionalLight position={[2.5, 3, 4]} intensity={1.6} />
      <directionalLight position={[-3, -1, 2]} intensity={0.35} color="#bcd4ff" />
    </>
  );
}

function CoinMesh({ entrance, motion }: { entrance: CoinEntrance; motion: boolean }) {
  const spin = useRef<THREE.Group>(null);
  const drag = useRef({ active: false, lastX: 0, velocity: 0 });
  const enter = useRef({ y: entrance === "drop" ? 3 : 0, vy: 0, boost: entrance === "drop" ? 14 : 0 });

  const { body, face, edge, faceMat } = useMemo(() => {
    const { map, bump } = faceTextures();
    const ridges = ridgeTexture();
    const metal = { roughness: 0.34, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 1.1 };
    return {
      body: new THREE.MeshPhysicalMaterial({ color: BLUE, ...metal }),
      edge: new THREE.MeshPhysicalMaterial({ color: "#2558c6", bumpMap: ridges, bumpScale: 1.5, ...metal }),
      faceMat: new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 4, ...metal }),
      face: new THREE.CircleGeometry(FACE_R + 0.002, 96),
    };
  }, []);

  useFrame((state, dt) => {
    const g = spin.current;
    if (!g) return;
    dt = Math.min(dt, 1 / 30);
    const t = state.clock.elapsedTime;
    const d = drag.current, e = enter.current;
    if (!d.active) {
      // Drift back to a calm idle spin after a flick; extra spin on entrance.
      const idle = motion ? 0.9 : 0;
      d.velocity += (idle + e.boost - d.velocity) * Math.min(1, dt * 2.2);
      e.boost *= Math.pow(0.12, dt);
    }
    g.rotation.y += d.velocity * dt;
    // Spring the entrance drop, then a gentle bob.
    e.vy += (-e.y * 90 - e.vy * 11) * dt;
    e.y += e.vy * dt;
    g.position.y = e.y + (motion ? Math.sin(t * 1.6) * 0.06 : 0);
    g.rotation.z = motion ? Math.sin(t * 0.9) * 0.06 : 0;
  });

  return (
    <group
      ref={spin}
      onPointerDown={(ev) => {
        ev.stopPropagation();
        (ev.target as Element | null)?.setPointerCapture?.(ev.pointerId);
        drag.current = { active: true, lastX: ev.clientX, velocity: 0 };
      }}
      onPointerMove={(ev) => {
        const d = drag.current;
        if (!d.active) return;
        const dx = ev.clientX - d.lastX;
        d.lastX = ev.clientX;
        spin.current!.rotation.y += dx * 0.015;
        d.velocity = dx * 0.9; // flick: keep the momentum on release
      }}
      onPointerUp={() => (drag.current.active = false)}
      onPointerCancel={() => (drag.current.active = false)}
    >
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh material={body}>
          <latheGeometry args={[PROFILE, 160]} />
        </mesh>
        <mesh material={edge}>
          <cylinderGeometry args={[R + 0.002, R + 0.002, 0.1, 160, 1, true]} />
        </mesh>
        <mesh geometry={face} material={faceMat} position={[0, FACE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={face} material={faceMat} position={[0, -FACE_Y, 0]} rotation={[Math.PI / 2, 0, Math.PI]} />
      </group>
    </group>
  );
}

export default function Coin3D({
  size = 220,
  entrance = "none",
  className = "",
}: {
  size?: number;
  entrance?: CoinEntrance;
  className?: string;
}) {
  const motion = useMemo(() => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  return (
    <div className={`coin3d ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4.4], fov: 32 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
        style={{ touchAction: "pan-y" }}
      >
        <Studio />
        <CoinMesh entrance={motion ? entrance : "none"} motion={motion} />
      </Canvas>
    </div>
  );
}
