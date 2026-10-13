"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, LocateFixed, Minus, Plus, ScanFace, ShieldCheck, X } from "lucide-react";
import { DropMap } from "@/components/map-loader";
import { Coin, ErrorMessage } from "@/components/ui";
import { confirmCampaign, createCampaign, submitDeposit, USE_MOCKS } from "@/lib/api";
import { usePosition } from "@/lib/hooks";
import { ENUGU } from "@/lib/format";
import type { CreateCampaignInput } from "@/lib/types";

type Tier = { amount: number; count: number };
type Area = { lat: number; lng: number; radiusM: number; name: string };
const MAX_AREAS = 3;
const AREA_RADIUS_M = 250;

// Drops are scattered uniformly inside each area. Seeded by the area, so the preview doesn't jump around.
function scatter(area: Area, n: number, seed: number) {
  let x = Math.abs(Math.sin(area.lat * 1e4 + area.lng * 1e3 + seed)) * 1e6;
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => {
    const r = area.radiusM * Math.sqrt(rand()), t = rand() * 2 * Math.PI;
    return {
      lat: area.lat + (r * Math.cos(t)) / 111320,
      lng: area.lng + (r * Math.sin(t)) / (111320 * Math.cos((area.lat * Math.PI) / 180)),
    };
  });
}
// Split n drops across areas as evenly as possible.
const split = (n: number, k: number) => Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));

function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setShown(value);
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / 450, 1), eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value]);
  return shown;
}

async function placeName(lat: number, lng: number) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lng}`, { headers: { "Accept-Language": "en" } });
    const d = await r.json();
    return d.name || d.address?.suburb || d.address?.neighbourhood || d.address?.road || "";
  } catch {
    return "";
  }
}
const today = () => {
  const t = new Date();
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function HideMoneyPage() {
  const [tiers, setTiers] = useState<Tier[]>([{ amount: 1, count: 10 }, { amount: 2, count: 5 }, { amount: 5, count: 2 }]),
    [areas, setAreas] = useState<Area[]>([]),
    [day, setDay] = useState(today),
    [from, setFrom] = useState("10:00"),
    [to, setTo] = useState("18:00"),
    [onePerPerson, setOnePerPerson] = useState(true),
    [title, setTitle] = useState(""),
    [hiddenBy, setHiddenBy] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState<{ drops: number; total: number } | null>(null);
  const gps = usePosition();

  const drops = tiers.reduce((s, t) => s + t.count, 0);
  const total = tiers.reduce((s, t) => s + t.amount * t.count, 0);
  const shownTotal = useCountUp(total);
  const perArea = split(drops, Math.max(areas.length, 1));
  const dots = useMemo(() => areas.flatMap((a, i) => scatter(a, perArea[i], i).map((p) => ({ ...p, area: i }))), [areas, perArea.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const addArea = async (lat: number, lng: number) => {
    if (areas.length >= MAX_AREAS) return setError(`Up to ${MAX_AREAS} areas. Remove one to add another.`);
    setError("");
    const index = areas.length;
    setAreas((as) => [...as, { lat, lng, radiusM: AREA_RADIUS_M, name: "" }]);
    const name = await placeName(lat, lng);
    setAreas((as) => as.map((a, i) => (i === index && a.lat === lat ? { ...a, name } : a)));
  };
  const step = (i: number, d: number) => setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, count: Math.max(0, Math.min(200, t.count + d)) } : t)));

  const hide = async () => {
    setError("");
    try {
      if (!areas.length) throw new Error("Tap the map to choose at least one public area.");
      if (!drops) throw new Error("Add at least one drop.");
      if (drops > 200) throw new Error("Up to 200 drops per Money Drop.");
      if (!title.trim() || !hiddenBy.trim()) throw new Error("Name your Money Drop and say who it's from.");
      const startsAt = Math.floor(new Date(`${day}T${from}`).getTime() / 1000);
      const endsAt = Math.floor(new Date(`${day}T${to}`).getTime() / 1000);
      if (endsAt <= startsAt) throw new Error("The end time must be after the start time.");
      if (endsAt <= Date.now() / 1000) throw new Error("Pick a time window that hasn't ended yet.");
      // Shuffle amounts across the scattered spots so big drops aren't clustered in one area.
      const amounts = tiers.flatMap((t) => Array(t.count).fill(t.amount) as number[]).sort(() => Math.random() - 0.5);
      const input: CreateCampaignInput = {
        title: title.trim(),
        creatorName: hiddenBy.trim(),
        startsAt,
        endsAt,
        onePerWallet: onePerPerson,
        drops: dots.map((p, i) => ({
          kind: "map",
          amount: String(amounts[i] * 1_000_000),
          title: areas[p.area].name || title.trim(),
          lat: p.lat,
          lng: p.lng,
        })),
      };
      setBusy(true);
      const deposit = await createCampaign(input);
      const txHash = await submitDeposit(deposit, input);
      await confirmCampaign(deposit.campaignId, txHash);
      setDone({ drops, total });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiding failed. Nothing was charged.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="page">
        <section className="card hide-done">
          <div className="hide-done-coins" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <Coin key={i} size="sm" style={{ "--x": `${Math.cos(i * 0.7) * 120}px`, "--y": `${Math.sin(i * 0.7) * 70 - 40}px`, "--r": `${i * 40}deg`, animationDelay: `${i * 40}ms` } as React.CSSProperties} />
            ))}
            <Coin size="lg" float />
          </div>
          <h1>${done.total.toLocaleString()} is hidden</h1>
          <p>
            {done.drops} Money Drops go live on {new Date(`${day}T${from}`).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.
            Anything not found by {to} comes back to you.
          </p>
          <Link href="/map" className="button primary">See them on the map <ArrowRight size={18} /></Link>
          <button className="button secondary" onClick={() => { setDone(null); setAreas([]); }}>Hide more money</button>
        </section>
      </div>
    );

  return (
    <div className="page hide-page">
      <header className="hide-head">
        <Link href="/" className="icon-button" aria-label="Close"><X size={19} /></Link>
        <strong>Hide money</strong>
        <span style={{ width: 42 }} />
      </header>

      <section className="hide-amount" aria-live="polite">
        <span className="amount">${shownTotal.toLocaleString()}</span>
        <span>USDC, hidden in {drops.toLocaleString()} {drops === 1 ? "drop" : "drops"}</span>
      </section>

      <section className="sheet-card tiers">
        {tiers.map((t, i) => (
          <div key={t.amount} className="tier-row">
            <Coin size="sm" style={{ "--s": `${t.amount >= 5 ? 34 : t.amount >= 2 ? 28 : 22}px` } as React.CSSProperties} />
            <span className="tier-label">{t.count} {t.count === 1 ? "drop" : "drops"} of ${t.amount}</span>
            <span className="stepper">
              <button aria-label={`Fewer $${t.amount} drops`} onClick={() => step(i, -1)}><Minus size={15} /></button>
              <button aria-label={`More $${t.amount} drops`} onClick={() => step(i, +1)}><Plus size={15} /></button>
            </span>
            <span className="tier-total">${(t.amount * t.count).toLocaleString()}</span>
          </div>
        ))}
      </section>

      <section className="sheet-card areas">
        <div className="areas-map">
          <DropMap center={gps.position ?? ENUGU} zoom={14} onPick={addArea} areas={areas} dots={dots} position={gps.position} />
          <button className="icon-button areas-locate" onClick={gps.enable} aria-label="Centre on my location"><LocateFixed size={17} /></button>
        </div>
        <div className="areas-list">
          {!areas.length ? (
            <p className="help-text">Tap the map to choose up to 3 public areas. Drops are scattered inside each circle.</p>
          ) : (
            areas.map((a, i) => (
              <div key={`${a.lat}-${a.lng}`} className="area-row">
                <strong>{a.name || `Area ${i + 1}`}</strong>
                <span>{perArea[i]} drops</span>
                <button className="text-button" aria-label={`Remove ${a.name || `area ${i + 1}`}`} onClick={() => setAreas((as) => as.filter((_, j) => j !== i))}><X size={14} /></button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="sheet-card rows">
        <label className="row-line when-line">
          <span>When</span>
          <span className="when">
            <input type="date" value={day} min={today()} onChange={(e) => setDay(e.target.value)} />
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Starts" />
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Ends" />
          </span>
        </label>
        <label className="row-line">
          <span>Each person</span>
          <select value={onePerPerson ? "one" : "many"} onChange={(e) => setOnePerPerson(e.target.value === "one")}>
            <option value="one">One drop</option>
            <option value="many">As many as they find</option>
          </select>
        </label>
        <div className="row-line">
          <span>Not found by {to}</span>
          <strong>Back to you</strong>
        </div>
        <label className="row-line">
          <span>Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Saturday Money Drop" />
        </label>
        <label className="row-line">
          <span>Hidden by</span>
          <input value={hiddenBy} onChange={(e) => setHiddenBy(e.target.value)} placeholder="Your name or brand" />
        </label>
      </section>

      <p className="fine-print"><ShieldCheck size={14} /> Drops only go in public places, in daylight. Choose parks, plazas and campuses, never roads, rail lines or private property.</p>
      {error && <ErrorMessage message={error} />}
      {USE_MOCKS && <p className="demo-note">Demo mode: your demo balance pays, and no real money moves.</p>}
      <button className="button primary hide-cta" disabled={busy || !drops} onClick={hide}>
        <ScanFace size={19} /> {busy ? "Hiding on Arc…" : `Hide $${total.toLocaleString()}`}
      </button>
    </div>
  );
}
