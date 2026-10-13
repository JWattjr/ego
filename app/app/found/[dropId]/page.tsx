"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { getFound, USE_MOCKS } from "@/lib/api";
import type { FoundView } from "@/lib/types";
import { money } from "@/lib/format";
import { Coin, CollectibleCard, ErrorMessage, Loading } from "@/components/ui";
export default function FoundPage({
  params,
}: {
  params: Promise<{ dropId: string }>;
}) {
  const { dropId } = use(params),
    [view, setView] = useState<FoundView | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    getFound(dropId)
      .then(setView)
      .finally(() => setLoading(false));
  }, [dropId]);
  if (loading)
    return (
      <div className="page">
        <Loading text="Unwrapping your find…" />
      </div>
    );
  if (!view)
    return (
      <div className="page">
        <ErrorMessage message="There is no confirmed claim here yet. Find and claim a drop first." />
        <Link href="/map" className="button primary">
          Explore nearby drops
        </Link>
      </div>
    );
  return (
    <div className="page found-page">
      <div className="found-coin">
        <Coin size="large" spin />
        <span className="found-check">
          <Check size={22} />
        </span>
      </div>
      <h1>
        You found
        <br />
        <span>{money(view.drop.amount)} USDC.</span>
      </h1>
      <p className="found-from">A little joy from {view.drop.creatorName}.</p>
      <div className="receipt-pill">
        <Check size={16} />
        Confirmed in {(view.confirmedMs / 1000).toFixed(1)} s
        {USE_MOCKS ? " · demo receipt" : ""}
      </div>
      <p className="found-remaining">
        {view.campaign.dropsLeft}{" "}
        {view.campaign.dropsLeft === 1 ? "drop is" : "drops are"} still hidden
        in this campaign.
      </p>
      <div className="found-collectible">
        <CollectibleCard item={view.collectible} large />
      </div>
      <p className="help-text">
        A keepsake of your find, now in your collection.
      </p>
      <Link href="/" className="button primary">
        Back to your wallet <ArrowRight size={19} />
      </Link>
      <Link href="/map" className="button secondary">
        Find another little joy
      </Link>
      <a
        href={view.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="explorer-link"
      >
        View on Arc Explorer <ExternalLink size={15} />
      </a>
      {USE_MOCKS && (
        <p className="demo-note">
          The amount and confirmation are simulated. This demo transaction hash
          will not appear on the live explorer.
        </p>
      )}
    </div>
  );
}
