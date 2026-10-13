"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Footprints, Flag, LocateFixed, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { DropMap } from "@/components/map-loader";
import { Coin, ErrorMessage, KindLabel, ReportDialog } from "@/components/ui";
import { getNearby, isReported, reportLocation } from "@/lib/api";
import { usePosition } from "@/lib/hooks";
import { ENUGU, money } from "@/lib/format";
import type { DropPublic } from "@/lib/types";

export default function MapPage() {
  const [drops, setDrops] = useState<DropPublic[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [report, setReport] = useState(false);
  const gps = usePosition();
  useEffect(() => {
    let live = true;
    getNearby(gps.position ?? undefined)
      .then((d) => {
        if (!live) return;
        setDrops(d.filter((item) => !isReported(item.dropId) && !item.claimed));
        setError("");
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [gps.position]);

  const total = useMemo(() => drops.reduce((s, d) => s + BigInt(d.amount), 0n).toString(), [drops]);
  const selected = drops.find((d) => d.dropId === selectedId) ?? null;
  const walkMin = (m?: number) => (m === undefined ? null : Math.max(1, Math.round(m / 80)));

  return (
    <div className="map-screen">
      <DropMap
        drops={drops}
        selectedId={selectedId ?? undefined}
        onSelect={(d) => setSelectedId(d.dropId)}
        position={gps.position}
        center={selected?.approx ?? gps.position ?? ENUGU}
        zoom={15}
        offsetY={selected ? 170 : 0}
        route={selected?.approx && gps.position ? { from: gps.position, to: selected.approx } : undefined}
      />

      <div className="map-top">
        <div className="map-campaign">
          <Coin size="sm" />
          <div>
            <strong>{loading ? "Looking around you…" : `${drops.length} drops hidden nearby`}</strong>
            <span>{money(total)} USDC waiting in public places</span>
          </div>
        </div>
        <button className="icon-button" onClick={gps.enable} aria-label="Use my location">
          <LocateFixed size={19} />
        </button>
      </div>

      {(error || gps.error) && (
        <div className="map-sheet" style={{ bottom: "auto", top: 80 }}>
          <ErrorMessage message={error || gps.error} />
        </div>
      )}

      {selected ? (
        <section className="map-sheet" key={selected.dropId} aria-labelledby="drop-title">
          <div className="map-sheet-head">
            <Coin size="md" float />
            <div>
              <h2 id="drop-title">{money(selected.amount)} USDC drop</h2>
              <p>
                {selected.title}
                {selected.distanceM !== undefined && ` · ${selected.distanceM} m · ${walkMin(selected.distanceM)} min walk`}
              </p>
            </div>
            <KindLabel kind={selected.kind} />
          </div>
          <ul className="facts">
            <li><Sparkles size={17} /> Hidden by {selected.creatorName}</li>
            <li><MapPin size={17} /> The exact spot shows up 30 m away</li>
            <li><ShieldCheck size={17} /> Only ever in public places, in daylight</li>
          </ul>
          <Link className="button primary" href={`/hunt/${selected.dropId}?campaignId=${selected.campaignId}`}>
            <Footprints size={19} /> Start the hunt
          </Link>
          <button className="text-button" style={{ justifySelf: "center", color: "var(--ink-3)" }} onClick={() => setReport(true)}>
            <Flag size={14} /> Report this location
          </button>
        </section>
      ) : (
        !loading && (
          <section className="map-sheet">
            <p className="map-empty">
              {drops.length ? "Tap a coin to see what's hidden there." : "A quiet corner, for now. Hide a little joy for someone else."}
            </p>
            {!drops.length && (
              <Link href="/create" className="button secondary">
                Hide a drop <ArrowRight size={18} />
              </Link>
            )}
          </section>
        )
      )}

      {report && selected && (
        <ReportDialog
          onClose={() => setReport(false)}
          onConfirm={async () => {
            try {
              await reportLocation(selected.dropId);
              setDrops((ds) => ds.filter((d) => d.dropId !== selected.dropId));
              setSelectedId(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "The report failed. Please try again.");
            } finally {
              setReport(false);
            }
          }}
        />
      )}
    </div>
  );
}
