"use client";
import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Flag, LocateFixed, Navigation, X } from "lucide-react";
import { DropMap } from "@/components/map-loader";
import { Coin, ErrorMessage, HoldButton, Loading, ReportDialog } from "@/components/ui";
import { Coin3D } from "@/components/coin3d-loader";
import { DEMO_CAMPAIGN, getDrop, reportLocation, simulateStep, simulationStart, USE_MOCKS } from "@/lib/api";
import { bearing, money } from "@/lib/format";
import { useClaim, usePosition } from "@/lib/hooks";
import type { DropPublic, Position } from "@/lib/types";

type OrientationWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

// Where to look, in plain words: relative to the phone when we have a heading, otherwise a compass direction.
function directionWords(angle: number, relative: boolean) {
  const a = ((angle % 360) + 360) % 360;
  if (!relative) return `Head ${COMPASS[Math.round(a / 45) % 8]}`;
  if (a < 20 || a > 340) return "Straight ahead";
  if (a <= 160) return a < 60 ? "A little to your right" : "Turn to your right";
  if (a >= 200) return a > 300 ? "A little to your left" : "Turn to your left";
  return "It's behind you";
}

// A few soft light orbs for the claim scene, placed once.
const BOKEH = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 53) % 70}%`,
  size: 8 + ((i * 7) % 22),
  delay: `${-(i * 0.7)}s`,
}));

function ClaimScene({
  drop,
  claim,
  onClose,
}: {
  drop: DropPublic;
  claim: ReturnType<typeof useClaim>;
  onClose: () => void;
}) {
  return (
    <div className="scene" role="dialog" aria-modal="true" aria-label={`Claim ${money(drop.amount)} USDC`}>
      {BOKEH.map((b, i) => (
        <span key={i} className="bokeh" style={{ left: b.left, top: b.top, width: b.size, height: b.size, animationDelay: b.delay }} />
      ))}
      <span className="beam" />
      <div className="scene-top">
        <button className="icon-button" onClick={onClose} aria-label="Back to the compass">
          <X size={20} />
        </button>
        <span className="here-pill">You&apos;re here</span>
        <span style={{ width: 42 }} />
      </div>
      <div className="scene-center">
        <Coin3D size={260} entrance="drop" />
        <div className="ground-ring" />
      </div>
      <div className="scene-bottom">
        <h2>{money(drop.amount)} USDC drop</h2>
        <p>
          Hidden by {drop.creatorName} · {drop.title}
        </p>
        <HoldButton variant="ring" onClaim={claim.claim} busy={claim.busy} label="Hold to claim" />
        {claim.phase && <p role="status">{claim.phase}</p>}
        {claim.error && <p className="scene-error" role="alert">{claim.error}</p>}
      </div>
    </div>
  );
}

function Hunt({ dropId }: { dropId: string }) {
  const params = useSearchParams(),
    router = useRouter(),
    campaignId = params.get("campaignId") ?? (USE_MOCKS ? DEMO_CAMPAIGN : "");
  const [drop, setDrop] = useState<DropPublic | null>(null),
    [error, setError] = useState(""),
    [heading, setHeading] = useState<number | null>(null),
    [compassNote, setCompassNote] = useState(""),
    [compassOn, setCompassOn] = useState(false),
    [simulated, setSimulated] = useState<Position | null>(null),
    [report, setReport] = useState(false),
    [sceneClosed, setSceneClosed] = useState(false),
    [trend, setTrend] = useState<"warmer" | "colder" | "steady" | null>(null);
  const gps = usePosition(),
    position = simulated ?? gps.position,
    previous = useRef<number | null>(null);

  // Start tracking straight away: the hunt is the one place location is the whole point.
  const { enable } = gps;
  useEffect(() => {
    if (!USE_MOCKS) enable();
  }, [enable]);

  useEffect(() => {
    let live = true;
    if (!campaignId) {
      setError("Open the full drop link from its creator.");
      return;
    }
    getDrop(campaignId, dropId, position ?? undefined)
      .then((d) => {
        if (!live) return;
        setDrop(d);
        setError("");
        if (d.distanceM !== undefined) {
          if (previous.current !== null) {
            const diff = d.distanceM - previous.current;
            setTrend(diff < -2 ? "warmer" : diff > 2 ? "colder" : "steady");
          }
          previous.current = d.distanceM;
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [campaignId, dropId, position]);

  useEffect(() => {
    if (!compassOn) return;
    const update = (event: DeviceOrientationEvent) => {
      const ios = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      if (ios !== undefined) setHeading(ios);
      else if (event.absolute && event.alpha !== null) setHeading((360 - event.alpha) % 360);
      else return setCompassNote("No compass on this device. Use the map.");
      setCompassNote("");
    };
    window.addEventListener("deviceorientationabsolute", update);
    window.addEventListener("deviceorientation", update);
    return () => {
      window.removeEventListener("deviceorientationabsolute", update);
      window.removeEventListener("deviceorientation", update);
    };
  }, [compassOn]);

  const enableCompass = async () => {
    if (typeof DeviceOrientationEvent === "undefined") return setCompassNote("No compass on this device. Use the map.");
    try {
      const ask = (DeviceOrientationEvent as OrientationWithPermission).requestPermission;
      if (ask && (await ask.call(DeviceOrientationEvent)) !== "granted") return setCompassNote("Compass permission is off. The map still works.");
      setCompassOn(true);
    } catch {
      setCompassNote("Compass unavailable. The map still works.");
    }
  };

  const near = drop?.distanceM !== undefined && drop.distanceM <= 30 && !!drop.exact;
  const accurate = !!position && position.accuracyM <= 30;
  const proof = useMemo(() => (position ? { ...position } : null), [position]);
  const claim = useClaim(drop, proof);
  const target = drop?.exact ?? drop?.approx;
  const absBearing = position && target ? bearing(position, target) : null;
  const angle = absBearing === null ? 0 : heading !== null ? absBearing - heading : absBearing;
  const showScene = !!drop && near && accurate && !drop.claimed && !sceneClosed;

  const trendText = near
    ? "You're right there"
    : trend === "warmer"
      ? "Getting warmer"
      : trend === "colder"
        ? "Getting colder"
        : position
          ? "Keep walking"
          : "Waiting for your location";

  return (
    <div>
      <header className="hunt-head">
        <button className="icon-button" onClick={() => router.push("/map")} aria-label="Back to the map">
          <X size={20} />
        </button>
        <div>
          <strong>{drop ? `Hunting ${money(drop.amount)} USDC` : "Finding your drop…"}</strong>
          <span>{drop ? `${drop.title} · from ${drop.creatorName}` : ""}</span>
        </div>
        <button className="icon-button" onClick={() => setReport(true)} aria-label="Report this location" disabled={!drop}>
          <Flag size={17} />
        </button>
      </header>

      {error && <div className="page"><ErrorMessage message={error} /></div>}
      {!drop && !error && <div className="page"><Loading /></div>}

      {drop && (
        <div className="page" style={{ paddingTop: 0 }}>
          <div className="dial-wrap">
            <div className="dial">
              <span className="dial-ticks" />
              <span className="dial-ticks major" />
              <span className="dial-north" />
              {absBearing !== null && (
                <div className="dial-orbit" style={{ transform: `rotate(${angle}deg)` }}>
                  <span className="coin-marker" style={{ transform: `translate(-50%, 0) rotate(${-angle}deg)` }}>
                    <Coin size="sm" />
                  </span>
                </div>
              )}
              <div className="dial-face" role="status" aria-live="polite">
                <span className="amount">
                  {drop.distanceM ?? "—"}
                  <span className="cur">m</span>
                </span>
                <span className={`dial-trend ${trend === "colder" ? "cold" : ""}`}>{trendText}</span>
                <span className="dial-sub">
                  {absBearing === null ? "Turn on location to start" : near ? "Look around you" : directionWords(angle, heading !== null)}
                </span>
              </div>
            </div>
          </div>

          {near && accurate && !drop.claimed && sceneClosed && (
            <button className="button primary" onClick={() => setSceneClosed(false)}>
              <Coin size="xs" /> Open the claim
            </button>
          )}
          {near && !accurate && <p className="help-text" style={{ textAlign: "center" }}>Almost. Waiting for a sharper GPS fix (±{Math.round(position?.accuracyM ?? 0)} m).</p>}
          {drop.claimed && <ErrorMessage message="Someone already found this one. There are more on the map." />}

          <div className="hunt-map">
            <DropMap drops={[drop]} selectedId={drop.dropId} position={position} exact={near ? drop.exact : undefined} center={drop.approx} zoom={16} />
          </div>

          <div className="hunt-tools">
            <button className="button secondary" onClick={gps.enable}>
              <LocateFixed size={17} /> {gps.enabled ? "Tracking" : "Location"}
            </button>
            <button className="button secondary" onClick={enableCompass}>
              <Navigation size={17} /> {compassOn ? "Compass on" : "Compass"}
            </button>
          </div>
          {(gps.error || compassNote) && !simulated && <p className="help-text">{gps.error || compassNote}</p>}

          {drop.hint && (
            <section className="clue-block">
              <h2>Clue</h2>
              <p>{drop.hint}</p>
            </section>
          )}

          {process.env.NODE_ENV === "development" && USE_MOCKS && (
            <section className="dev-controls" aria-label="Desk testing">
              <strong>Desk testing · simulated GPS</strong>
              <div>
                <button className="text-button" onClick={() => { gps.disable(); previous.current = null; setSimulated(simulationStart(drop)); }}>
                  Start walk
                </button>
                <button className="text-button" disabled={!simulated} onClick={() => simulated && setSimulated(simulateStep(drop, simulated))}>
                  <ArrowUp size={15} /> 50 m closer
                </button>
                <button className="text-button" disabled={!simulated} onClick={() => { previous.current = null; setSimulated(null); }}>
                  Real GPS
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {showScene && drop && <ClaimScene drop={drop} claim={claim} onClose={() => setSceneClosed(true)} />}

      {report && drop && (
        <ReportDialog
          onClose={() => setReport(false)}
          onConfirm={async () => {
            try {
              await reportLocation(drop.dropId);
              router.push("/map");
            } catch (e) {
              setReport(false);
              setError(e instanceof Error ? e.message : "The report failed. Please try again.");
            }
          }}
        />
      )}
    </div>
  );
}

export default function HuntPage({ params }: { params: Promise<{ dropId: string }> }) {
  const { dropId } = use(params);
  return (
    <Suspense fallback={<Loading />}>
      <Hunt dropId={dropId} />
    </Suspense>
  );
}
