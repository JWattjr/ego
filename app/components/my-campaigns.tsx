"use client";
// Campaigns this device funded (Money Drops and prize pools), with live status from the contract
// and a "get it back" button once the claim window has closed.
import { useEffect, useState } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { money } from "@/lib/format";
import { myCampaigns, myCampaignStatus, refundMine, USE_MOCKS, type MyCampaign } from "@/lib/api";

type Status = { left: string; endsAt: number; refunded: boolean } | null;

function Row({ c }: { c: MyCampaign }) {
  const [status, setStatus] = useState<Status>(null),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState<{ text: string; url?: string } | null>(null);
  useEffect(() => {
    myCampaignStatus(c.campaignId).then(setStatus).catch(() => setStatus(null));
  }, [c.campaignId]);
  const ended = (status?.endsAt ?? c.endsAt) <= Date.now() / 1000;
  const canRefund = ended && status && !status.refunded && BigInt(status.left) > 0n;
  return (
    <div className="list-row mine-row">
      <span className="row-main">
        <strong>{c.title}</strong>
        <span>
          {c.kind === "prize" ? "Prize pool" : "Money Drop"} · {money(c.total)} USDC ·{" "}
          {status?.refunded ? "returned to you" : ended ? `${money(status?.left ?? "0")} USDC unclaimed` : `ends ${new Date(c.endsAt * 1000).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
        </span>
        {msg && (
          <span className="mine-msg">
            {msg.text}{" "}
            {msg.url && <a href={msg.url} target="_blank" rel="noopener noreferrer">View <ExternalLink size={11} /></a>}
          </span>
        )}
      </span>
      {canRefund && (
        <button
          className="button primary mine-refund"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await refundMine(c.campaignId);
              setMsg({ text: "Back in your wallet.", url: r.explorerUrl });
              setStatus((s) => (s ? { ...s, refunded: true } : s));
            } catch (e) {
              setMsg({ text: e instanceof Error ? e.message : "The refund failed." });
            } finally {
              setBusy(false);
            }
          }}
        >
          <RotateCcw size={15} /> {busy ? "Returning…" : `Get ${money(status!.left)} back`}
        </button>
      )}
    </div>
  );
}

export function MyCampaigns() {
  const [list, setList] = useState<MyCampaign[]>([]);
  useEffect(() => setList(USE_MOCKS ? [] : myCampaigns()), []);
  if (!list.length) return null;
  return (
    <section className="section">
      <div className="section-title">
        <h2>Your drops & prizes</h2>
        <span>{list.length}</span>
      </div>
      <div className="list-card">
        {list.map((c) => (
          <Row key={c.campaignId} c={c} />
        ))}
      </div>
    </section>
  );
}
