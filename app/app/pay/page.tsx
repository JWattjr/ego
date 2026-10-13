"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Lock, Mail, Plus, Trash2, Trophy } from "lucide-react";
import { Amount, ErrorMessage, PageTitle } from "@/components/ui";
import { confirmCampaign, createCampaign, submitDeposit, USE_MOCKS } from "@/lib/api";
import { units } from "@/lib/format";
import type { CreateCampaignInput } from "@/lib/types";

type Winner = { email: string; amount: string };
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const inDays = (d: number) => {
  const t = new Date(Date.now() + d * 86400000);
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function PayWinnersPage() {
  const [title, setTitle] = useState(""),
    [organiser, setOrganiser] = useState(""),
    [deadline, setDeadline] = useState(inDays(14)),
    [winners, setWinners] = useState<Winner[]>([{ email: "", amount: "" }]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState<{ count: number; total: string } | null>(null);

  const total = useMemo(() => {
    try {
      return winners.reduce((s, w) => s + (w.amount ? BigInt(units(w.amount)) : 0n), 0n).toString();
    } catch {
      return "0";
    }
  }, [winners]);
  const set = (i: number, patch: Partial<Winner>) => setWinners((ws) => ws.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  const lock = async () => {
    setError("");
    try {
      if (!title.trim() || !organiser.trim()) throw new Error("Name the prize pool and the organiser.");
      if (winners.some((w) => !isEmail(w.email))) throw new Error("Every winner needs a valid email.");
      const endsAt = Math.floor(new Date(`${deadline}T23:59:00`).getTime() / 1000);
      if (endsAt <= Date.now() / 1000) throw new Error("Pick a claim deadline in the future.");
      const input: CreateCampaignInput = {
        title: title.trim(),
        creatorName: organiser.trim(),
        endsAt,
        onePerWallet: false,
        drops: winners.map((w) => ({ kind: "prize", amount: units(w.amount.trim()), title: `Winner · ${title.trim()}`, email: w.email.trim() })),
      };
      setBusy(true);
      const deposit = await createCampaign(input);
      const txHash = await submitDeposit(deposit, input);
      await confirmCampaign(deposit.campaignId, txHash);
      setDone({ count: winners.length, total: deposit.total });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Locking the prizes failed. Nothing was charged.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="page">
        <section className="card pay-done rise">
          <span className="pay-done-icon"><Check size={28} /></span>
          <h1>Prizes locked on Arc</h1>
          <Amount base={done.total} />
          <p>
            {done.count} {done.count === 1 ? "winner has" : "winners have"} been emailed. They claim with that email; no wallet or crypto needed.
            Anything unclaimed by the deadline comes back to you automatically.
          </p>
          {USE_MOCKS && <p className="help-text">Demo mode: no email was sent. Sign in on Prizes with a winner's email to try the claim.</p>}
          <Link href="/prizes" className="button primary">See it as a winner <ArrowRight size={18} /></Link>
          <button className="button secondary" onClick={() => { setDone(null); setWinners([{ email: "", amount: "" }]); setTitle(""); }}>Pay more winners</button>
        </section>
      </div>
    );

  return (
    <div className="page form-page">
      <PageTitle title="Pay winners" description="Lock prize money on Arc once. Each winner claims with their email: no wallet or crypto needed. Unclaimed money comes back to you." />

      <section className="card form-stack">
        <label>
          Prize pool
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hackathon finals · Bug bounty #12" />
        </label>
        <div className="form-columns">
          <label>
            Organiser
            <input value={organiser} onChange={(e) => setOrganiser(e.target.value)} placeholder="Your team or event" />
          </label>
          <label>
            Claim by
            <input type="date" value={deadline} min={inDays(1)} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Winners</h2>
          <span>{winners.length} {winners.length === 1 ? "person" : "people"}</span>
        </div>
        <div className="list-card winners">
          {winners.map((w, i) => (
            <div key={i} className="winner-row">
              <span className="row-icon"><Trophy size={17} /></span>
              <input aria-label={`Winner ${i + 1} email`} type="email" inputMode="email" placeholder="winner@email.com" value={w.email} onChange={(e) => set(i, { email: e.target.value })} />
              <input aria-label={`Winner ${i + 1} amount in USDC`} className="winner-amount" inputMode="decimal" placeholder="USDC" value={w.amount} onChange={(e) => set(i, { amount: e.target.value.replace(/[^\d.]/g, "") })} />
              {winners.length > 1 && (
                <button className="icon-button" aria-label={`Remove winner ${i + 1}`} onClick={() => setWinners((ws) => ws.filter((_, j) => j !== i))}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <button className="list-row" onClick={() => setWinners((ws) => [...ws, { email: "", amount: "" }])}>
            <span className="row-icon"><Plus size={18} /></span>
            <span className="row-main"><strong>Add a winner</strong></span>
          </button>
        </div>
      </section>

      <section className="card pay-summary">
        <div>
          <span className="small-label">Total to lock</span>
          <Amount base={total} />
        </div>
        <ul className="facts">
          <li><Lock size={16} /> Held by the Ego contract on Arc, not by us</li>
          <li><Mail size={16} /> Winners get an email and claim with it</li>
          <li><ArrowRight size={16} /> Unclaimed after the deadline returns to you</li>
        </ul>
      </section>

      {error && <ErrorMessage message={error} />}
      <button className="button primary" disabled={busy || total === "0"} onClick={lock}>
        <Lock size={18} /> {busy ? "Locking on Arc…" : "Lock prizes on Arc"}
      </button>
    </div>
  );
}
