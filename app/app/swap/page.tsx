"use client";
import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { ErrorMessage, PageTitle } from "@/components/ui";
import { USE_MOCKS } from "@/lib/api";

// UI first: a demo USDC <-> EURC rate until the Uniswap-on-Arc integration is switched on.
type Token = "USDC" | "EURC";
const EUR_PER_USD = 0.86;

export default function SwapPage() {
  const [from, setFrom] = useState<Token>("USDC"),
    [amount, setAmount] = useState(""),
    [done, setDone] = useState("");
  const to: Token = from === "USDC" ? "EURC" : "USDC";
  const rate = from === "USDC" ? EUR_PER_USD : 1 / EUR_PER_USD;
  const out = amount ? (Number(amount) * rate * 0.997).toFixed(2) : ""; // 0.3% pool fee

  return (
    <div className="page">
      <PageTitle back="/" title="Swap" description="Move between dollars and euros on Arc in about a second." />
      <section className="swap-box">
        <label className="swap-leg">
          <span>You pay</span>
          <div>
            <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setDone(""); }} aria-label={`Amount of ${from}`} />
            <span className={`token token-${from}`}>{from}</span>
          </div>
        </label>
        <button className="swap-flip" aria-label="Swap direction" onClick={() => { setFrom(to); setDone(""); }}>
          <ArrowDownUp size={18} />
        </button>
        <div className="swap-leg">
          <span>You get</span>
          <div>
            <output aria-label={`Amount of ${to}`}>{out || "0"}</output>
            <span className={`token token-${to}`}>{to}</span>
          </div>
        </div>
      </section>
      <dl className="found-facts swap-facts">
        <div><dt>Rate</dt><dd>1 {from} ≈ {rate.toFixed(4)} {to}</dd></div>
        <div><dt>Fee</dt><dd>0.3% pool fee · gas paid in USDC</dd></div>
        <div><dt>Route</dt><dd>Uniswap on Arc</dd></div>
      </dl>
      {!USE_MOCKS && <ErrorMessage message="Swaps are coming soon on Arc. The rate shown is an estimate." />}
      {done && <p className="in-wallet" style={{ justifySelf: "center" }}>{done}</p>}
      <button className="button primary" disabled={!USE_MOCKS || !Number(amount)} onClick={() => setDone(`Demo: swapped ${amount} ${from} for ${out} ${to}`)}>
        Swap {from} for {to}
      </button>
    </div>
  );
}
