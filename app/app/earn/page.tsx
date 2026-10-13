"use client";
import { Info } from "lucide-react";
import { Investments } from "@/components/investments";
import { GROW } from "@/lib/grow";
import { USE_MOCKS } from "@/lib/api";

export default function EarnPage() {
  const total = USE_MOCKS ? GROW.reduce((s, g) => s + Number(g.demoBalance), 0) / 1e6 : 0;
  const earned = USE_MOCKS ? GROW.reduce((s, g) => s + Number(g.demoEarned), 0) / 1e6 : 0;
  return (
    <div className="page">
      <header className="page-heading">
        <span className="small-label">Earn</span>
        <h1 className="amount earn-total">
          ${Math.floor(total).toLocaleString()}
          <span className="dec">.{total.toFixed(2).split(".")[1]}</span>
        </h1>
        <p><span className="deck-earned">+${earned.toFixed(2)} earned</span> · {USE_MOCKS ? "demo positions" : "coming soon on Arc"}</p>
      </header>
      <Investments />
      <section className="card grow-info">
        <h2><Info size={17} /> How Earn works</h2>
        <p>
          Put idle USDC to work on Arc. Vaults are the hands-off choice; lending and pools are for people who want to pick.
          Earnings vary and aren&apos;t guaranteed. Each card explains its risks before you deposit.
        </p>
      </section>
    </div>
  );
}
