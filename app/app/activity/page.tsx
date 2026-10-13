"use client";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Gift, MapPinned, Trophy } from "lucide-react";
import { MyCampaigns } from "@/components/my-campaigns";
import { getWallet, USE_MOCKS } from "@/lib/api";
import type { Collectible } from "@/lib/types";

type Item = { id: string; icon: typeof Gift; title: string; sub: string; amount?: string; dir: "in" | "out" };
const ago = (s: number) => {
  const d = Math.max(1, Math.round((Date.now() / 1000 - s) / 60));
  return d < 60 ? `${d} min ago` : d < 1440 ? `${Math.round(d / 60)} h ago` : `${Math.round(d / 1440)} d ago`;
};
// Demo history so the timeline reads like a real wallet in demo mode.
const DEMO: Item[] = [
  { id: "d1", icon: Gift, title: "Prize · Best map UX", sub: "From Arc Builders · 2 h ago", amount: "+25.00", dir: "in" },
  { id: "d2", icon: MapPinned, title: "Money Drop found", sub: "Polo Park · Ada from Enugu · yesterday", amount: "+1.00", dir: "in" },
  { id: "d3", icon: ArrowUpRight, title: "Sent", sub: "To 0x91c4…7d20 · 2 d ago", amount: "−5.00", dir: "out" },
  { id: "d4", icon: Trophy, title: "Prize pool locked", sub: "Friday bounty · 3 d ago", amount: "−10.00", dir: "out" },
  { id: "d5", icon: ArrowDownLeft, title: "Received", sub: "From 0x2bA0…19fe · 4 d ago", amount: "+20.00", dir: "in" },
];

export default function ActivityPage() {
  const [found, setFound] = useState<Collectible[]>([]);
  useEffect(() => {
    getWallet().then((w) => setFound(w.collectibles)).catch(() => setFound([]));
  }, []);
  const items: Item[] = [
    ...found.map((c) => ({
      id: c.id,
      icon: c.kind === "prize" ? Gift : MapPinned,
      title: c.kind === "prize" ? `Prize · ${c.title}` : `Found · ${c.title}`,
      sub: `From ${c.creatorName} · ${ago(c.earnedAt)}`,
      dir: "in" as const,
    })),
    ...(USE_MOCKS ? DEMO : []),
  ];
  return (
    <div className="page">
      <header className="page-heading">
        <h1>Activity</h1>
        <p>Everything that moved through your wallet.</p>
      </header>
      <MyCampaigns />
      <section className="section">
        <div className="section-title"><h2>History</h2></div>
        {items.length ? (
          <div className="list-card">
            {items.map(({ id, icon: Icon, title, sub, amount, dir }) => (
              <div key={id} className="list-row">
                <span className={`row-icon ${dir === "in" ? "in" : "out"}`}><Icon size={18} /></span>
                <span className="row-main">
                  <strong>{title}</strong>
                  <span>{sub}</span>
                </span>
                {amount && <span className={`row-end amount-${dir}`}>{amount}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-collection">
            <h3>Nothing yet</h3>
            <p>Your claims, prizes, sends and drops will show up here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
