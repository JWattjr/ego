"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, LocateFixed, MapPin, X } from "lucide-react";
import { DropMap } from "@/components/map-loader";
import {
  Coin,
  ErrorMessage,
  KindLabel,
  Loading,
  PageTitle,
  ReportDialog,
  Safety,
} from "@/components/ui";
import { getNearby, isReported, reportLocation } from "@/lib/api";
import { usePosition } from "@/lib/hooks";
import { ENUGU, money } from "@/lib/format";
import type { DropPublic } from "@/lib/types";
export default function MapPage() {
  const [drops, setDrops] = useState<DropPublic[]>([]),
    [selected, setSelected] = useState<DropPublic | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [report, setReport] = useState(false);
  const gps = usePosition();
  useEffect(() => {
    let live = true;
    setLoading(true);
    getNearby(gps.position ?? undefined)
      .then((d) => {
        if (live) {
          setDrops(d.filter((item) => !isReported(item.dropId)));
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [gps.position]);
  return (
    <div className="page map-page">
      <PageTitle
        title="Good things nearby"
        description="A little walk. A little discovery."
      />
      <div className="map-toolbar">
        <span>
          <MapPin size={16} />
          Enugu · public places
        </span>
        <button className="text-button" onClick={gps.enable}>
          <LocateFixed size={17} />
          Use my location
        </button>
      </div>
      {(error || gps.error) && <ErrorMessage message={error || gps.error} />}
      <div className="map-stage">
        <DropMap
          drops={drops}
          onSelect={setSelected}
          position={gps.position}
          center={gps.position ?? ENUGU}
        />
        <div className="map-legend">
          <span className="legend-circle" />
          Approximate areas, not exact spots
        </div>
      </div>
      {loading && <Loading text="Looking for nearby drops…" />}
      <section className="section">
        <div className="section-title">
          <h2>
            {drops.length
              ? `${drops.length} reasons to step outside`
              : "A quiet corner, for now"}
          </h2>
        </div>
        {!loading && !drops.length && (
          <p>
            No drops in this area yet. Check back soon, or create a little joy
            for someone else.
          </p>
        )}
        <div className="drop-list">
          {drops.map((d) => (
            <button
              className="drop-row"
              key={d.dropId}
              onClick={() => setSelected(d)}
            >
              <Coin size="small" />
              <div>
                <strong>{d.title}</strong>
                <span>
                  From {d.creatorName}
                  {d.distanceM !== undefined ? ` · ${d.distanceM} m away` : ""}
                </span>
              </div>
              <span className="drop-amount">
                {money(d.amount)}
                <small>USDC</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <Safety compact />
      {selected && (
        <div className="sheet-backdrop" onClick={() => setSelected(null)}>
          <section
            className="drop-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drop-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <button
              className="icon-button dialog-close"
              aria-label="Close drop details"
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
            <KindLabel kind={selected.kind} />
            <h2 id="drop-title">{selected.title}</h2>
            <div className="sheet-amount">
              <Coin size="small" />
              <strong>{money(selected.amount)} USDC</strong>
            </div>
            <p>From {selected.creatorName}</p>
            <p className="clue">{selected.hint}</p>
            <Safety compact onReport={() => setReport(true)} />
            <Link
              className="button primary"
              href={`/hunt/${selected.dropId}?campaignId=${selected.campaignId}`}
            >
              Start the hunt <ArrowRight size={20} />
            </Link>
          </section>
        </div>
      )}
      {report && selected && (
        <ReportDialog
          onClose={() => setReport(false)}
          onConfirm={() => {
            reportLocation(selected.dropId);
            setDrops((ds) => ds.filter((d) => d.dropId !== selected.dropId));
            setSelected(null);
            setReport(false);
          }}
        />
      )}
    </div>
  );
}
