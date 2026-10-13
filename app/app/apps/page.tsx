"use client";
import Link from "next/link";
import { ArrowLeftRight, Gift, Map, Puzzle, QrCode, Sparkles, Ticket, Users } from "lucide-react";

const apps = [
  { href: "/map", icon: Map, title: "Money Drops", sub: "Hunt USDC hidden nearby", tone: "blue", big: true },
  { href: "/prizes", icon: Gift, title: "Prizes & bounties", sub: "Claim what you won", tone: "gold", big: true },
  { href: "/enter/code", icon: Ticket, title: "Enter a code", sub: "Giveaways and posts", tone: "violet" },
  { href: "/enter/qr", icon: QrCode, title: "Event QR", sub: "Scan at the venue", tone: "green" },
  { href: "/enter/puzzle", icon: Puzzle, title: "Puzzles", sub: "Crack it, keep it", tone: "orange" },
  { href: "/swap", icon: ArrowLeftRight, title: "Swap", sub: "USDC ⇄ EURC", tone: "blue" },
  { href: "", icon: Sparkles, title: "Missions", sub: "Quests at events", tone: "pink", soon: true },
  { href: "", icon: Users, title: "Invite friends", sub: "Perks for real use", tone: "teal", soon: true },
];

export default function AppsPage() {
  return (
    <div className="page">
      <header className="page-heading">
        <h1>Apps</h1>
        <p>Fun ways to get paid, all on Arc.</p>
      </header>
      <div className="app-grid">
        {apps.map(({ href, icon: Icon, title, sub, tone, big, soon }) =>
          soon ? (
            <div key={title} className={`app-tile tone-${tone} soon`} aria-disabled="true">
              <span className="app-icon"><Icon size={22} /></span>
              <strong>{title}</strong>
              <span>{sub}</span>
              <em>Soon</em>
            </div>
          ) : (
            <Link key={title} href={href} className={`app-tile tone-${tone} ${big ? "big" : ""}`}>
              <span className="app-icon"><Icon size={22} /></span>
              <strong>{title}</strong>
              <span>{sub}</span>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
