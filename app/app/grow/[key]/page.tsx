"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Info, ShieldAlert } from "lucide-react";
import { Amount, PageTitle } from "@/components/ui";
import { growByKey } from "@/lib/grow";
import { USE_MOCKS } from "@/lib/api";

export default function GrowPage({ params }: { params: Promise<{ key: string }> }) {
  const g = growByKey(use(params).key);
  if (!g) notFound();
  return (
    <div className="page">
      <PageTitle back="/" title={g.title} description={g.short} />
      <section className="card grow-hero">
        <span className="small-label">Your position</span>
        <Amount base={USE_MOCKS ? g.demoBalance : "0"} />
        <div className="grow-stats">
          <div><span>Rate</span><strong>{USE_MOCKS ? g.demoRate : "Live soon"}</strong></div>
          <div><span>Runs on</span><strong>{g.venue}</strong></div>
        </div>
        <div className="grow-actions">
          <button className="button primary" disabled={!USE_MOCKS}><ArrowDownToLine size={18} /> Deposit</button>
          <button className="button secondary" disabled={!USE_MOCKS}><ArrowUpFromLine size={18} /> Withdraw</button>
        </div>
        {!USE_MOCKS && <p className="help-text">Coming soon on Arc. Deposits open once this integration is live.</p>}
      </section>
      <section className="card grow-info">
        <h2><Info size={17} /> How it works</h2>
        <p>{g.how}</p>
      </section>
      <section className="card grow-info grow-risk">
        <h2><ShieldAlert size={17} /> Risks</h2>
        <p>{g.risk}</p>
      </section>
    </div>
  );
}
