"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  Gift,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import { connectWallet, getNearby, getWallet, USE_MOCKS } from "@/lib/api";
import { GROW } from "@/lib/grow";
import { Investments } from "@/components/investments";
import type { DropPublic, WalletView } from "@/lib/types";
import { money, shortAddress } from "@/lib/format";
import { Amount, Coin, CollectibleCard, ErrorMessage, Loading, Safety } from "@/components/ui";
import { Coin3D } from "@/components/coin3d-loader";

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
          {wallet ? <Amount base={wallet.balance} hidden={hidden} currency="" prefix="$" /> : <span className="amount">—</span>}
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

      <Link href="/prizes" className="prize-teaser rise rise-2">
        <span className="row-icon"><Gift size={19} /></span>
        <span className="row-main">
          <strong>Prizes waiting for you</strong>
          <span>Won a hackathon or a bounty? Claim it with your email</span>
        </span>
        <ChevronRight size={18} />
      </Link>

      <section className="section rise rise-3">
        <Link href="/earn" className="section-title section-link">
          <h2>Investments</h2>
          <span>
            {USE_MOCKS ? `$${(GROW.reduce((s, g) => s + Number(g.demoBalance), 0) / 1e6).toFixed(2)}` : "$0.00"} <ChevronRight size={15} />
          </span>
        </Link>
        <Investments />
      </section>

      <section className="section rise rise-4">
        <div className="section-title">
          <h2>Coins</h2>
          <span>{wallet ? `$${(Number(wallet.balance) / 1e6 + (USE_MOCKS ? 5 : 0)).toFixed(2)}` : ""}</span>
        </div>
        <div className="list-card">
          <div className="list-row coin-row">
            <img src="/tokens/usdc.svg" alt="" width={36} height={36} />
            <span className="row-main">
              <strong>USDC</strong>
              <span>US dollar · Circle</span>
            </span>
            <span className="row-end coin-value">
              {wallet ? `$${(Number(wallet.balance) / 1e6).toFixed(2)}` : "—"}
              <small>{wallet ? `${(Number(wallet.balance) / 1e6).toFixed(2)} USDC` : ""}</small>
            </span>
          </div>
          <div className="list-row coin-row">
            <img src="/tokens/eurc.svg" alt="" width={36} height={36} />
            <span className="row-main">
              <strong>EURC</strong>
              <span>Euro · Circle</span>
            </span>
            <span className="row-end coin-value">
              {USE_MOCKS ? "$5.00" : "$0.00"}
              <small>{USE_MOCKS ? "4.30 EURC" : "0 EURC"}</small>
            </span>
          </div>
        </div>
      </section>

      {wallet?.collectibles.length ? (
        <section className="section">
          <div className="section-title">
            <h2>Your collection</h2>
            <span>{wallet.collectibles.length} found</span>
          </div>
          <div className="collectibles-scroll">
            {wallet.collectibles.map((item) => (
              <CollectibleCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {!wallet && !error && <Loading />}
      <Safety compact />
      {USE_MOCKS && <p className="demo-note">Prototype data. No real funds move in demo mode.</p>}
    </div>
  );
}
