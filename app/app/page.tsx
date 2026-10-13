"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  Layers,
  Percent,
  Vault,
  ArrowUpRight,
  ChevronRight,
  Compass,
  Gift,
  Trophy,
  Eye,
  EyeOff,
  Plus,
  Puzzle,
  QrCode,
  Ticket,
} from "lucide-react";
import { connectWallet, getNearby, getWallet, USE_MOCKS } from "@/lib/api";
import { MyCampaigns } from "@/components/my-campaigns";
import { GROW } from "@/lib/grow";
import type { DropPublic, WalletView } from "@/lib/types";
import { money, shortAddress } from "@/lib/format";
import { Amount, Coin, CollectibleCard, ErrorMessage, Loading, Safety } from "@/components/ui";
import { Coin3D } from "@/components/coin3d-loader";

const ways = [
  { href: "/prizes", icon: Gift, title: "Prizes waiting for you", sub: "Won a hackathon or bounty? Claim it with your email" },
  { href: "/enter/code", icon: Ticket, title: "Enter a code", sub: "From a giveaway, a post or a flyer" },
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
        <div className="balance-text">
          <span className="balance-label">
            {USE_MOCKS ? "Demo balance" : "Total balance"}
            <button onClick={() => setHidden((h) => !h)} aria-label={hidden ? "Show balance" : "Hide balance"}>
              {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
          {wallet ? <Amount base={wallet.balance} hidden={hidden} /> : <span className="amount">—</span>}
          {wallet?.address ? (
            <span className="balance-address">{shortAddress(wallet.address)} · Arc</span>
          ) : (
            <button
              className="button primary connect-button"
              onClick={() => connectWallet().then(load).catch((e) => setError(e instanceof Error ? e.message : "Couldn't connect your wallet."))}
            >
              Connect wallet
            </button>
          )}
        </div>
        <Coin3D size={132} />
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
        <Link href="/swap" className="action main">
          <span className="action-icon"><ArrowLeftRight size={22} /></span>
          Swap
        </Link>
        <Link href="/hide" className="action">
          <span className="action-icon"><Plus size={22} /></span>
          Hide
        </Link>
      </div>

      <section className="section rise rise-3">
        <Link href="/grow/vaults" className="section-title section-link">
          <h2>Investments</h2>
          <span>
            {USE_MOCKS ? `$${(GROW.reduce((s, g) => s + Number(g.demoBalance), 0) / 1e6).toFixed(2)}` : "$0.00"} <ChevronRight size={15} />
          </span>
        </Link>
        <div className="list-card">
          {GROW.map((g) => {
            const Icon = g.key === "lending" ? Percent : g.key === "pools" ? Layers : Vault;
            return (
              <Link key={g.key} href={`/grow/${g.key}`} className="list-row">
                <span className="row-icon"><Icon size={18} /></span>
                <span className="row-main">
                  <strong>{g.title}</strong>
                  <span>{g.short}</span>
                </span>
                <span className="row-end">{USE_MOCKS ? `$${(Number(g.demoBalance) / 1e6).toFixed(2)}` : <small>Soon</small>}</span>
              </Link>
            );
          })}
        </div>
      </section>

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

      <section className="section rise rise-3">
        <div className="section-title">
          <h2>For organisers</h2>
        </div>
        <div className="list-card">
          <Link href="/pay" className="list-row">
            <span className="row-icon"><Trophy size={19} /></span>
            <span className="row-main">
              <strong>Pay winners</strong>
              <span>Lock hackathon prizes and bounties on Arc; winners claim by email</span>
            </span>
            <span className="row-end"><ChevronRight size={18} /></span>
          </Link>
          <Link href="/hide" className="list-row">
            <span className="row-icon"><Plus size={19} /></span>
            <span className="row-main">
              <strong>Hide money</strong>
              <span>A Money Drop: scatter USDC across public places for people to find</span>
            </span>
            <span className="row-end"><ChevronRight size={18} /></span>
          </Link>
          <Link href="/create" className="list-row">
            <span className="row-icon"><Ticket size={19} /></span>
            <span className="row-main">
              <strong>Codes, event QR codes and puzzles</strong>
              <span>Giveaways people claim with a code, a scan or an answer</span>
            </span>
            <span className="row-end"><ChevronRight size={18} /></span>
          </Link>
        </div>
      </section>

      <MyCampaigns />

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
