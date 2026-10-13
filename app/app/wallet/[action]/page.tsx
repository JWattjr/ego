"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { ArrowUpRight, Check, Copy, ExternalLink } from "lucide-react";
import { Coin, ErrorMessage, Loading, PageTitle } from "@/components/ui";
import { getWallet, sendMoney, USE_MOCKS } from "@/lib/api";
import { money, units } from "@/lib/format";
import type { WalletView } from "@/lib/types";
export default function WalletAction({
  params,
}: {
  params: Promise<{ action: string }>;
}) {
  const { action } = use(params),
    [wallet, setWallet] = useState<WalletView | null>(null),
    [address, setAddress] = useState(""),
    [amount, setAmount] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [receipt, setReceipt] = useState<{
      txHash: string;
      explorerUrl: string;
    } | null>(null);
  useEffect(() => {
    getWallet()
      .then(setWallet)
      .catch((e) => setError(e.message));
  }, []);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setReceipt(await sendMoney(address.trim(), units(amount)));
      setWallet(await getWallet());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "We couldn't send this amount.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!["send", "receive"].includes(action))
    return (
      <div className="page">
        <ErrorMessage message="Choose send or receive from your wallet." />
      </div>
    );
  return (
    <div className="page form-page">
      <PageTitle
        back="/"
        title={
          action === "send"
            ? "Pass on a little joy."
            : "Good things, coming your way."
        }
        description={
          action === "send"
            ? "Send USDC directly to a wallet on Arc."
            : "Share your address to receive USDC on Arc."
        }
      />
      {!wallet && !error && <Loading />}
      {error && <ErrorMessage message={error} />}{" "}
      {receipt ? (
        <section className="send-success">
          <Coin size="large" />
          <h2>{money(units(amount))} USDC sent.</h2>
          <p>
            <Check size={18} />
            {USE_MOCKS ? "Demo transfer complete" : "Transfer submitted"}
          </p>
          <a
            className="explorer-link"
            href={receipt.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Arc Explorer <ExternalLink size={16} />
          </a>
          {USE_MOCKS && (
            <p className="demo-note">
              Simulated transaction; no real funds moved.
            </p>
          )}
          <Link href="/" className="button primary">
            Back to wallet
          </Link>
        </section>
      ) : action === "send" ? (
        <form onSubmit={send} className="form-stack">
          <label>
            Recipient wallet
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x… Arc wallet address"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          <label>
            Amount in USDC
            <div className="amount-input">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                required
              />
              <span>USDC</span>
            </div>
          </label>
          <p className="help-text">
            Available: {wallet ? money(wallet.balance) : "—"} USDC. Check the
            recipient address carefully.
          </p>
          <button
            className="button primary"
            disabled={busy || !wallet?.address}
          >
            {busy ? "Sending…" : USE_MOCKS ? "Send demo USDC" : "Send USDC"}
            <ArrowUpRight size={20} />
          </button>
          {USE_MOCKS && (
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setAddress("0x1111111111111111111111111111111111111111")
              }
            >
              Use a demo recipient
            </button>
          )}
        </form>
      ) : wallet?.address ? (
        <section className="receive-panel">
          <div className="qr-paper">
            <QRCode value={wallet.address} size={220} fgColor="#142b43" />
          </div>
          <h2>Your Arc address</h2>
          <p className="receive-address">{wallet.address}</p>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(wallet.address);
                setCopied(true);
              } catch {
                setError(
                  "Clipboard unavailable. Select and copy the address above.",
                );
              }
            }}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}{" "}
            {copied ? "Address copied" : "Copy address"}
          </button>
          <p className="help-text">
            Receive USDC on Arc only. Sending on the wrong network can lose
            funds.
          </p>
          {USE_MOCKS && (
            <p className="demo-note">
              This is a fake wallet address for testing. Do not send real funds
              to it.
            </p>
          )}
        </section>
      ) : (
        <ErrorMessage message="Wallet connection is not wired yet. No receive address is available." />
      )}
    </div>
  );
}
