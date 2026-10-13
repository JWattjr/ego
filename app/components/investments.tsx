"use client";
// Investments as a stacked card deck (like a wallet app): cards overlap, one is open with its
// balance. Tapping a card opens it; tapping the open card goes to its detail screen.
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Layers, Percent, Vault } from "lucide-react";
import { Amount } from "./ui";
import { GROW, type GrowKey } from "@/lib/grow";
import { USE_MOCKS } from "@/lib/api";

const ICONS = { lending: Percent, pools: Layers, vaults: Vault };

export function Investments() {
  const [open, setOpen] = useState<GrowKey>("vaults");
  return (
    <div className="deck" role="list">
      {GROW.map((g, i) => {
        const Icon = ICONS[g.key];
        const isOpen = open === g.key;
        const balance = USE_MOCKS ? g.demoBalance : "0";
        return (
          <article key={g.key} role="listitem" className={`deck-card ${isOpen ? "open" : ""}`} style={{ zIndex: i + 1 }}>
            <button className="deck-head" onClick={() => setOpen(g.key)} aria-expanded={isOpen} aria-controls={`deck-${g.key}`}>
              <span className="deck-icon">
                <Icon size={15} />
                {g.key === "pools" && USE_MOCKS && <span className="deck-dot" aria-label="New earnings" />}
              </span>
              <span className="deck-title">{g.title}</span>
              {!isOpen && <span className="deck-amount">{USE_MOCKS ? `$${(Number(balance) / 1e6).toFixed(2)}` : "Soon"}</span>}
            </button>
            <div className="deck-body" id={`deck-${g.key}`} inert={!isOpen}>
              <div>
                <Amount base={balance} currency="" prefix="$" />
                <div className="deck-meta">
                  <span className="deck-rate">{USE_MOCKS ? g.demoRate : "Coming soon on Arc"}</span>
                  <span>{g.venue}</span>
                </div>
                <Link href={`/grow/${g.key}`} className="deck-open">
                  {g.short} <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
