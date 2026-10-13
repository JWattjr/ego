"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  Plus,
  Puzzle,
  QrCode,
  Ticket,
} from "lucide-react";
import { getNearby, getWallet, USE_MOCKS } from "@/lib/api";
import type { DropPublic, WalletView } from "@/lib/types";
import { money, shortAddress } from "@/lib/format";
import { Amount, Coin, CollectibleCard, ErrorMessage, Loading, Safety } from "@/components/ui";

const ways = [
  { href: "/enter/code", icon: Ticket, title: "Claim a bounty", sub: "Won something? Your prize is locked on Arc. Enter the code" },
  { href: "/enter/qr", icon: QrCode, title: "Scan an event QR", sub: "Early birds catch the most" },
  { href: "/enter/puzzle", icon: Puzzle, title: "Solve a puzzle", sub: "Crack the riddle, keep the coin" },
];

export default function WalletHome() {
  const [wallet, setWallet] = useState<WalletView | null>(null),
    [drops, setDrops] = useState<DropPublic[]>([]),
    [hidden, setHidden] = useState(false),
    [error, setError] = useState("");
  const load = () => {
    setError("");
    Promise.all([getWallet(), getNearby()])
      .then(([w, d]) => {
        setWallet(w);
        setDrops(d);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);
  const nearest = [...drops].filter((d) => !d.claimed).sort((a, b) => (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9))[0];

  return (
    <div className="page">
      {nearest ? (
        <Link href={`/hunt/${nearest.dropId}?campaignId=${nearest.campaignId}`} className="drop-banner">
          <Coin size="sm" float />
          <div>
            <strong>
              A {money(nearest.amount)} USDC drop is {nearest.distanceM !== undefined ? `${nearest.distanceM} m away` : "nearby"}
            </strong>
            <span>
              {nearest.title} · {nearest.creatorName}
            </span>
          </div>
          <ChevronRight size={20} />
        </Link>
      ) : (
        <Link href="/map" className="drop-banner">
          <Coin size="sm" float />
          <div>
            <strong>Money is hiding near you</strong>
            <span>Open the map to look around</span>
          </div>
          <ChevronRight size={20} />
        </Link>
      )}

      {error && <ErrorMessage message={error} onRetry={load} />}

      <section className="balance rise rise-1" aria-label="Your wallet">
        <span className="balance-label">
          {USE_MOCKS ? "Demo balance" : "Total balance"}
          <button onClick={() => setHidden((h) => !h)} aria-label={hidden ? "Show balance" : "Hide balance"}>
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
        {wallet ? <Amount base={wallet.balance} hidden={hidden} /> : <span className="amount">—</span>}
        <span className="balance-address">{wallet?.address ? shortAddress(wallet.address) : "No wallet connected yet"}</span>
      </section>

      <div className="actions rise rise-2">
        <Link href="/wallet/send" className="action">
          <span className="action-icon"><ArrowUpRight size={22} /></span>
          Send
        </Link>
        <Link href="/wallet/receive" className="action">
          <span className="action-icon"><ArrowDownLeft size={22} /></span>
          Receive
        </Link>
        <Link href="/map" className="action main">
          <span className="action-icon"><Compass size={22} /></span>
          Hunt
        </Link>
        <Link href="/create" className="action">
          <span className="action-icon"><Plus size={22} /></span>
          Drop
        </Link>
      </div>

      <section className="section rise rise-3">
        <div className="section-title">
          <h2>Ways to find money</h2>
        </div>
        <div className="list-card">
          {ways.map(({ href, icon: Icon, title, sub }) => (
            <Link key={href} href={href} className="list-row">
              <span className="row-icon"><Icon size={19} /></span>
              <span className="row-main">
                <strong>{title}</strong>
                <span>{sub}</span>
              </span>
              <span className="row-end"><ChevronRight size={18} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section rise rise-4">
        <div className="section-title">
          <h2>Your collection</h2>
          <span>{wallet?.collectibles.length ?? 0} found</span>
        </div>
        {!wallet && !error ? (
          <Loading />
        ) : wallet?.collectibles.length ? (
          <div className="collectibles-scroll">
            {wallet.collectibles.map((item) => (
              <CollectibleCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="empty-collection">
            <Coin size="md" float />
            <h3>Your first find is waiting</h3>
            <p>Every drop you claim comes with a collectible card, minted on Arc.</p>
            <Link href="/map" className="text-button">
              Take a look around <ChevronRight size={16} />
            </Link>
          </div>
        )}
      </section>

      <Safety compact />
      {USE_MOCKS && <p className="demo-note">Prototype data. No real funds move in demo mode.</p>}
    </div>
  );
}
