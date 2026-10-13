"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Compass,
  MapPin,
  Puzzle,
  QrCode,
  Ticket,
} from "lucide-react";
import { getNearby, getWallet, USE_MOCKS } from "@/lib/api";
import type { DropPublic, WalletView } from "@/lib/types";
import { money, shortAddress } from "@/lib/format";
import {
  Coin,
  CollectibleCard,
  ErrorMessage,
  Loading,
  Safety,
} from "@/components/ui";
export default function WalletHome() {
  const [wallet, setWallet] = useState<WalletView | null>(null),
    [drops, setDrops] = useState<DropPublic[]>([]),
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
  return (
    <div className="page wallet-page">
      <header className="greeting">
        <h1>
          A little joy.
          <br />
          In your pocket.
        </h1>
        <p>Send it. Find it. Pass it on.</p>
      </header>
      {error && <ErrorMessage message={error} onRetry={load} />}
      <section className="wallet-balance" aria-label="Your wallet">
        <div>
          <p>{USE_MOCKS ? "Your demo balance" : "Your balance"}</p>
          <div className="balance-number">
            {wallet ? money(wallet.balance) : "—"}
            <span>USDC</span>
          </div>
          <span className="wallet-address">
            {wallet?.address
              ? shortAddress(wallet.address)
              : "Connect your wallet to get started"}
          </span>
        </div>
        <Coin size="large" />
      </section>
      <div className="wallet-actions">
        <Link className="button primary" href="/wallet/send">
          <ArrowUpRight size={21} />
          Send
        </Link>
        <Link className="button secondary" href="/wallet/receive">
          <ArrowDownLeft size={21} />
          Receive
        </Link>
      </div>
      <Link href="/map" className="nearby-banner">
        <div className="nearby-symbol">
          <MapPin size={26} />
          <span />
        </div>
        <div>
          <strong>
            {drops.length
              ? `${drops.length} little discoveries nearby`
              : "See what's nearby"}
          </strong>
          <p>Enugu is hiding something good.</p>
        </div>
        <ChevronRight size={22} />
      </Link>
      <section className="section">
        <div className="section-title">
          <h2>Find your next good thing</h2>
        </div>
        <div className="entry-shortcuts">
          <Link href="/enter/code">
            <Ticket size={25} />
            <span>Enter a code</span>
            <ArrowUpRight size={17} />
          </Link>
          <Link href="/enter/qr">
            <QrCode size={25} />
            <span>Scan an event QR</span>
            <ArrowUpRight size={17} />
          </Link>
          <Link href="/enter/puzzle">
            <Puzzle size={25} />
            <span>Solve a puzzle</span>
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="section">
        <div className="section-title">
          <h2>Your little collection</h2>
          <span>{wallet?.collectibles.length ?? 0} found</span>
        </div>
        {!wallet && !error ? (
          <Loading />
        ) : wallet?.collectibles.length ? (
          <div className="collectibles-grid">
            {wallet.collectibles.map((item) => (
              <CollectibleCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="empty-collection">
            <div className="empty-art">
              <Coin size="small" />
              <span className="empty-circle" />
            </div>
            <h3>Your first find is waiting.</h3>
            <p>
              Every claimed drop comes with a collectible. A tiny keepsake of a
              good moment.
            </p>
            <Link href="/map" className="text-button">
              Take a look around <Compass size={17} />
            </Link>
          </div>
        )}
      </section>
      <Safety compact />
      {USE_MOCKS && (
        <p className="demo-note">
          This is a prototype. Balances, drops and receipts are simulated; no
          real funds move.
        </p>
      )}
    </div>
  );
}
