"use client";
import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowUp,
  Compass,
  LocateFixed,
  Navigation,
  ThermometerSun,
} from "lucide-react";
import { DropMap } from "@/components/map-loader";
import {
  ErrorMessage,
  HoldButton,
  Loading,
  PageTitle,
  ReportDialog,
  Safety,
} from "@/components/ui";
import {
  DEMO_CAMPAIGN,
  getDrop,
  reportLocation,
  simulateStep,
  simulationStart,
  USE_MOCKS,
} from "@/lib/api";
import { bearing, money } from "@/lib/format";
import { useClaim, usePosition } from "@/lib/hooks";
import type { DropPublic, Position } from "@/lib/types";
type OrientationWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};
function Hunt({ dropId }: { dropId: string }) {
  const params = useSearchParams(),
    router = useRouter(),
    campaignId = params.get("campaignId") ?? (USE_MOCKS ? DEMO_CAMPAIGN : "");
  const [drop, setDrop] = useState<DropPublic | null>(null),
    [error, setError] = useState(""),
    [heading, setHeading] = useState<number | null>(null),
    [orientationMessage, setOrientationMessage] = useState(""),
    [orientationOn, setOrientationOn] = useState(false),
    [simulated, setSimulated] = useState<Position | null>(null),
    [report, setReport] = useState(false),
    [trend, setTrend] = useState("Follow the clue and take your time.");
  const gps = usePosition(),
    position = simulated ?? gps.position,
    previous = useRef<number | null>(null);
  useEffect(() => {
    let live = true;
    if (!campaignId) {
      setError("Open the complete drop link from its creator.");
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
            setTrend(
              diff < -2
                ? "Warmer. You're heading closer."
                : diff > 2
                  ? "Colder. Try a different direction."
                  : "Steady. Look around the public path.",
            );
          }
          previous.current = d.distanceM;
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [campaignId, dropId, position]);
  useEffect(() => {
    if (!orientationOn) return;
    const update = (event: DeviceOrientationEvent) => {
      const compass = (
        event as DeviceOrientationEvent & { webkitCompassHeading?: number }
      ).webkitCompassHeading;
      if (compass !== undefined) {
        setHeading(compass);
        setOrientationMessage("");
      } else if (event.absolute && event.alpha !== null) {
        setHeading((360 - event.alpha) % 360);
        setOrientationMessage("");
      } else
        setOrientationMessage(
          "No absolute compass heading available. Follow the map and clue instead.",
        );
    };
    window.addEventListener("deviceorientationabsolute", update);
    window.addEventListener("deviceorientation", update);
    return () => {
      window.removeEventListener("deviceorientationabsolute", update);
      window.removeEventListener("deviceorientation", update);
    };
  }, [orientationOn]);
  const enableCompass = async () => {
    if (typeof DeviceOrientationEvent === "undefined") {
      setOrientationMessage(
        "This device has no compass. Follow the map and clue.",
      );
      return;
    }
    try {
      const permission = (DeviceOrientationEvent as OrientationWithPermission)
        .requestPermission;
      if (
        permission &&
        (await permission.call(DeviceOrientationEvent)) !== "granted"
      ) {
        setOrientationMessage(
          "Compass permission is off. The map still works.",
        );
        return;
      }
      setOrientationOn(true);
      setOrientationMessage("Waiting for an absolute compass heading…");
    } catch {
      setOrientationMessage("Compass unavailable. The map still works.");
    }
  };
  const near =
    drop?.distanceM !== undefined && drop.distanceM <= 30 && !!drop.exact;
  const accurate = !!position && position.accuracyM <= 30;
  const proof = useMemo(() => (position ? { ...position } : null), [position]);
  const claim = useClaim(drop, proof);
  const direction =
    position && drop && heading !== null
      ? bearing(position, drop.exact ?? drop.approx!) - heading
      : 0;
  return (
    <div className="page hunt-page">
      <PageTitle
        back="/map"
        title={near ? "You're right here." : "Follow a little joy."}
        description={
          drop
            ? `${money(drop.amount)} USDC · from ${drop.creatorName}`
            : "Finding your drop…"
        }
      />
      {error && <ErrorMessage message={error} />}{" "}
      {!drop && !error && <Loading />}
      {drop && (
        <>
          <section className="hunt-radar">
            <div className="radar-ring outer" />
            <div className="radar-ring middle" />
            <div className="radar-ring inner" />
            {heading !== null ? (
              <Navigation
                className="direction-arrow"
                style={{ transform: `rotate(${direction - 45}deg)` }}
                size={42}
                fill="currentColor"
              />
            ) : (
              <Compass size={42} className="compass-fallback" />
            )}
            <div className="distance-reading">
              <strong>
                {drop.distanceM !== undefined ? drop.distanceM : "—"}
              </strong>
              <span>metres to your find</span>
            </div>
          </section>
          <div className="hunt-status" role="status">
            <ThermometerSun size={20} />
            {near ? "Within 30 m. The exact spot is now on your map." : trend}
          </div>
          <p className="direction-note">
            {heading !== null
              ? near
                ? "Arrow points to the exact spot."
                : "Arrow points to the approximate area; follow the clue."
              : "Enable your compass for an approximate direction arrow."}
          </p>
          <div className="hunt-controls">
            <button className="button secondary" onClick={gps.enable}>
              <LocateFixed size={18} />
              {gps.enabled ? "Location tracking on" : "Enable location"}
            </button>
            <button className="button secondary" onClick={enableCompass}>
              <Navigation size={18} />
              Compass
            </button>
          </div>
          {gps.error && !simulated && <ErrorMessage message={gps.error} />}{" "}
          {orientationMessage && (
            <p className="help-text" role="status">
              {orientationMessage}
            </p>
          )}
          {position && (
            <p className="help-text">
              {simulated ? "Simulated location" : "GPS accuracy"}: ±
              {Math.round(position.accuracyM)} m
              {!accurate ? " · Wait for a better fix before claiming." : ""}
            </p>
          )}
          <div className="hunt-mini-map">
            <DropMap
              drops={[drop]}
              position={position}
              exact={near ? drop.exact : undefined}
              center={drop.approx}
            />
          </div>
          <section className="clue-block">
            <h2>Your clue</h2>
            <p>
              {drop.hint ??
                "Stay on the public walkway and look around the highlighted area."}
            </p>
          </section>
          {process.env.NODE_ENV === "development" && USE_MOCKS && (
            <section
              className="dev-controls"
              aria-label="Development walking simulator"
            >
              <strong>Desk testing · mock GPS only</strong>
              <div>
                <button
                  className="text-button"
                  onClick={() => {
                    gps.disable();
                    previous.current = null;
                    setSimulated(simulationStart(drop));
                  }}
                >
                  Start simulated walk
                </button>
                <button
                  className="text-button"
                  disabled={!simulated}
                  onClick={() =>
                    simulated && setSimulated(simulateStep(drop, simulated))
                  }
                >
                  <ArrowUp size={16} />
                  Walk 50 m closer
                </button>
                <button
                  className="text-button"
                  disabled={!simulated}
                  onClick={() => {
                    previous.current = null;
                    setSimulated(null);
                  }}
                >
                  Use real GPS
                </button>
              </div>
            </section>
          )}
          <Safety onReport={() => setReport(true)} />
          {drop.claimed ? (
            <ErrorMessage message="This drop has already been found. Explore the map for another." />
          ) : (
            <HoldButton
              onClaim={claim.claim}
              disabled={!near || !accurate}
              busy={claim.busy}
              label={
                near
                  ? `Hold to claim ${money(drop.amount)} USDC`
                  : "Get within 30 m to claim"
              }
            />
          )}{" "}
          {claim.phase && (
            <p className="help-text" role="status">
              {claim.phase}
            </p>
          )}
          {claim.error && <ErrorMessage message={claim.error} />}
        </>
      )}
      {report && drop && (
        <ReportDialog
          onClose={() => setReport(false)}
          onConfirm={async () => {
            try {
              await reportLocation(drop.dropId);
              router.push("/map");
            } catch (e) {
              setReport(false);
              setError(
                e instanceof Error
                  ? e.message
                  : "The report failed. Please try again.",
              );
            }
          }}
        />
      )}
    </div>
  );
}
export default function HuntPage({
  params,
}: {
  params: Promise<{ dropId: string }>;
}) {
  const { dropId } = use(params);
  return (
    <Suspense fallback={<Loading />}>
      <Hunt dropId={dropId} />
    </Suspense>
  );
}
