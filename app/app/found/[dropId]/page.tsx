"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Check, ExternalLink, Share2, Zap } from "lucide-react";
import { getFound, USE_MOCKS } from "@/lib/api";
import type { FoundView } from "@/lib/types";
import { money } from "@/lib/format";
import { Coin, CollectibleCard, ErrorMessage, Loading } from "@/components/ui";
import { Coin3D } from "@/components/coin3d-loader";

// One celebratory burst of coins: shown once per find, so a little delight is earned.
const BURST = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return { x: `${Math.cos(a) * 150}px`, y: `${Math.sin(a) * 150 - 40}px`, r: `${(i % 2 ? 1 : -1) * 120}deg`, d: `${i * 25}ms` };
});

export default function FoundPage({ params }: { params: Promise<{ dropId: string }> }) {
  const { dropId } = use(params),
    [view, setView] = useState<FoundView | null>(null),
    [loading, setLoading] = useState(true),
    [shared, setShared] = useState(false);
  useEffect(() => {
    getFound(dropId).then(setView).finally(() => setLoading(false));
  }, [dropId]);

  if (loading) return <div className="page"><Loading text="Unwrapping your find…" /></div>;
  if (!view)
    return (
      <div className="page">
        <ErrorMessage message="No confirmed claim here yet. Find and claim a drop first." />
        <Link href="/map" className="button primary">Explore nearby drops</Link>
      </div>
    );

  const amount = money(view.drop.amount);
  const prize = view.drop.kind === "prize";
  const share = async () => {
    const text = prize
      ? `I just claimed my ${amount} USDC prize from ${view.drop.creatorName} on Ego. Paid on Arc in ${(view.confirmedMs / 1000).toFixed(1)} s.`
      : `I just found ${amount} USDC hidden in ${view.drop.title} on Ego. Confirmed on Arc in ${(view.confirmedMs / 1000).toFixed(1)} s.`;
    try {
      if (navigator.share) await navigator.share({ text, url: view.explorerUrl });
      else {
        await navigator.clipboard.writeText(`${text} ${view.explorerUrl}`);
        setShared(true);
      }
    } catch {
      /* the person closed the share sheet */
    }
  };

  return (
    <div className="scene found-scene">
      <span className="beam" />
      <div className="scene-top">
        <span />
        <span className="here-pill">{prize ? "Prize claimed" : "Found"}</span>
        <span />
      </div>
      <div className="scene-center">
        <div className="scene-coin" style={{ position: "relative" }}>
          <Coin3D size={210} />
          <div className="burst" aria-hidden="true">
            {BURST.map((b, i) => (
              <Coin key={i} size="sm" style={{ "--x": b.x, "--y": b.y, "--r": b.r, animationDelay: b.d } as React.CSSProperties} />
            ))}
          </div>
        </div>
      </div>

      <section className="found-sheet" aria-labelledby="found-title">
        <span className="found-badge"><Coin size="md" /></span>
        <div className="found-title">
          <h1 id="found-title">You {prize ? "won" : "found"} {amount} USDC</h1>
          <p>{amount} USDC from {view.drop.creatorName}</p>
          <span className="in-wallet"><Check size={14} /> In your wallet</span>
        </div>
        <dl className="found-facts">
          <div>
            <dt>{prize ? "Prize" : "Found in"}</dt>
            <dd>{prize ? view.campaign.title : view.drop.title}</dd>
          </div>
          <div>
            <dt>Confirmed in</dt>
            <dd><Zap size={14} color="var(--blue)" /> {(view.confirmedMs / 1000).toFixed(1)} seconds{USE_MOCKS ? " (demo)" : ""}</dd>
          </div>
          {!prize && (
            <div>
              <dt>Still hidden</dt>
              <dd>{view.campaign.dropsLeft} {view.campaign.dropsLeft === 1 ? "drop" : "drops"}</dd>
            </div>
          )}
        </dl>
        <CollectibleCard item={view.collectible} />
        <div className="found-actions">
          <button className="button secondary" onClick={share}>
            <Share2 size={18} /> {shared ? "Copied" : "Share"}
          </button>
          <Link href={prize ? "/prizes" : "/map"} className="button primary">{prize ? "My prizes" : "Keep hunting"}</Link>
        </div>
        <a href={view.explorerUrl} target="_blank" rel="noopener noreferrer" className="explorer-link">
          View on Arc Explorer <ExternalLink size={13} />
        </a>
      </section>
    </div>
  );
}
