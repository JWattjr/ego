"use client";
import { useMemo, useState } from "react";
import QRCode from "react-qr-code";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  MapPin,
  Puzzle,
  QrCode,
  Share2,
  Ticket,
} from "lucide-react";
import { DropMap } from "@/components/map-loader";
import { Coin, ErrorMessage, PageTitle, Safety } from "@/components/ui";
import {
  confirmCampaign,
  createCampaign,
  getCampaign,
  submitDeposit,
  USE_MOCKS,
} from "@/lib/api";
import { ENUGU, money, splitAmount, units } from "@/lib/format";
import type {
  CampaignDetail,
  CreateCampaignInput,
  Deposit,
  DropKind,
} from "@/lib/types";
const kinds = [
  { kind: "map" as const, label: "On the map", icon: MapPin },
  { kind: "code" as const, label: "With a code", icon: Ticket },
  { kind: "qr" as const, label: "At an event", icon: QrCode },
  { kind: "puzzle" as const, label: "A little puzzle", icon: Puzzle },
];
function defaultEnd() {
  const d = new Date(Date.now() + 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export default function CreatePage() {
  const [step, setStep] = useState(1),
    [title, setTitle] = useState(""),
    [creatorName, setCreatorName] = useState(""),
    [amount, setAmount] = useState("3"),
    [count, setCount] = useState(3),
    [kind, setKind] = useState<DropKind>("map"),
    [endsAt, setEndsAt] = useState(defaultEnd),
    [onePerWallet, setOnePerWallet] = useState(true),
    [hint, setHint] = useState(""),
    [answer, setAnswer] = useState(""),
    [points, setPoints] = useState<
      Record<number, { lat: number; lng: number }>
    >({}),
    [selectedPoint, setSelectedPoint] = useState(0),
    [codes, setCodes] = useState<string[]>([]),
    [safe, setSafe] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [created, setCreated] = useState<CampaignDetail | null>(null),
    [copied, setCopied] = useState<string | null>(null),
    [deposit, setDeposit] = useState<Deposit | null>(null),
    [submittedTx, setSubmittedTx] = useState<string | null>(null);
  const parts = useMemo(() => {
    try {
      return splitAmount(units(amount), count);
    } catch {
      return [];
    }
  }, [amount, count]);
  const validate = () => {
    if (!title.trim() || !creatorName.trim())
      throw new Error("Add a campaign title and your display name.");
    if (count < 1 || count > 20 || !Number.isInteger(count))
      throw new Error("Choose 1–20 drops.");
    if (
      !parts.length ||
      parts.some((a) => BigInt(a) < 1000000n || BigInt(a) > 5000000n)
    )
      throw new Error(
        "Each drop must be 1–5 USDC. Adjust the total or number of drops.",
      );
    if (
      !Number.isFinite(new Date(endsAt).getTime()) ||
      new Date(endsAt).getTime() <= Date.now()
    )
      throw new Error("Choose an end time in the future.");
  };
  const next = () => {
    setError("");
    try {
      validate();
      setCodes(
        Array.from(
          { length: count },
          () => `EGO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        ),
      );
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const fund = async () => {
    if (busy) return;
    setError("");
    try {
      validate();
      if (!safe)
        throw new Error("Confirm the safety rules before creating your drops.");
      if (
        kind === "map" &&
        Array.from({ length: count }, (_, i) => !points[i]).some(Boolean)
      )
        throw new Error("Place every drop on the map in a public location.");
      if (kind === "puzzle" && (!hint.trim() || !answer.trim()))
        throw new Error("Add a riddle and its answer.");
      setBusy(true);
      const input: CreateCampaignInput = {
        title: title.trim(),
        creatorName: creatorName.trim(),
        endsAt: Math.floor(new Date(endsAt).getTime() / 1000),
        onePerWallet,
        drops: parts.map((a, i) => ({
          kind,
          amount: a,
          title: `${title.trim()} · drop ${i + 1}`,
          ...(hint.trim() ? { hint: hint.trim() } : {}),
          ...(kind === "map"
            ? { lat: points[i].lat, lng: points[i].lng }
            : kind === "puzzle"
              ? { answer: answer.trim() }
              : { code: codes[i] }),
        })),
      };
      const d = deposit ?? (await createCampaign(input));
      setDeposit(d);
      const txHash = submittedTx ?? (await submitDeposit(d, input));
      setSubmittedTx(txHash);
      await confirmCampaign(d.campaignId, txHash);
      setCreated(await getCampaign(d.campaignId));
      setStep(3);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "We couldn't create these drops.",
      );
    } finally {
      setBusy(false);
    }
  };
  const shareLink = (index: number) => {
    if (!created) return "";
    const d = created.drops[index];
    const path = kind === "map" ? `/hunt/${d.dropId}` : `/enter/${kind}`;
    const params = new URLSearchParams({
      campaignId: d.campaignId,
      ...(kind !== "map" ? { dropId: d.dropId } : {}),
      ...(kind === "qr" ? { code: codes[index] } : {}),
    });
    return `${typeof window !== "undefined" ? window.location.origin : ""}${path}?${params}`;
  };
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setError(
        "Clipboard unavailable. Select the link or code and copy it manually.",
      );
    }
  };
  return (
    <div className="page create-page">
      <PageTitle
        title={
          step === 3 ? "A little joy, out in the world." : "Leave a little joy."
        }
        description={
          step === 3
            ? "Your drops are ready to be discovered."
            : "Someone's ordinary day could use a small surprise."
        }
      />
      <div className="step-indicator" aria-label={`Step ${step} of 3`}>
        <span className={step >= 1 ? "current" : ""}>Details</span>
        <span className={step >= 2 ? "current" : ""}>Place & fund</span>
        <span className={step >= 3 ? "current" : ""}>Share</span>
      </div>
      {error && <ErrorMessage message={error} />}{" "}
      {step === 1 && (
        <div className="form-stack">
          <label>
            What's this little adventure called?
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A good day in Enugu"
              maxLength={80}
            />
          </label>
          <label>
            Your display name
            <input
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="Ada from Enugu"
              maxLength={50}
            />
          </label>
          <div className="form-columns">
            <label>
              Total USDC
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Number of drops
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
              />
            </label>
          </div>
          <p className="split-preview">
            {parts.length
              ? `${count} drops · ${money(parts[0])}${parts.at(-1) !== parts[0] ? `–${money(parts.at(-1)!)}` : ""} USDC each`
              : "Enter a valid amount to split."}
          </p>
          <fieldset>
            <legend>How will people find them?</legend>
            <div className="kind-picker">
              {kinds.map(({ kind: k, label, icon: Icon }) => (
                <button
                  type="button"
                  key={k}
                  aria-pressed={kind === k}
                  className={kind === k ? "selected" : ""}
                  onClick={() => setKind(k)}
                >
                  <Icon size={22} />
                  <span>{label}</span>
                  {kind === k && <Check size={16} />}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            When does it end?{" "}
            <span className="help-text">Your device's local time</span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={onePerWallet}
              onChange={(e) => setOnePerWallet(e.target.checked)}
            />
            One drop per wallet in this campaign
          </label>
          <button className="button primary" onClick={next}>
            Place your drops <ArrowRight size={19} />
          </button>
          <Safety compact />
        </div>
      )}
      {step === 2 && (
        <div className="form-stack">
          {kind === "map" ? (
            <>
              <h2>A public place. A good place.</h2>
              <p>
                Choose each drop, then tap the map to place it on a public
                footpath or open public space.
              </p>
              <p className="help-text">
                Keyboard: focus the map and use arrow keys to move, then choose
                “Place drop at map centre”.
              </p>
              <div className="point-picker">
                {Array.from({ length: count }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPoint(i)}
                    className={selectedPoint === i ? "selected" : ""}
                  >
                    Drop {i + 1}
                    {points[i] && <Check size={14} />}
                  </button>
                ))}
              </div>
              <div className="create-map">
                <DropMap
                  center={ENUGU}
                  picked={points[selectedPoint]}
                  onPick={(lat, lng) =>
                    setPoints((p) => ({ ...p, [selectedPoint]: { lat, lng } }))
                  }
                />
              </div>
              <p className="help-text">
                {points[selectedPoint]
                  ? `Drop ${selectedPoint + 1} placed at ${points[selectedPoint].lat.toFixed(5)}, ${points[selectedPoint].lng.toFixed(5)}.`
                  : `Tap to place drop ${selectedPoint + 1}.`}
              </p>
              <label>
                A clue for your hunters
                <textarea
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="By the blue bench on the public walkway"
                  maxLength={240}
                />
              </label>
            </>
          ) : kind === "puzzle" ? (
            <>
              <label>
                Your riddle
                <textarea
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="I am always coming, but never arrive…"
                />
              </label>
              <label>
                The answer
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Only used to check the claim"
                />
              </label>
              <p className="help-text">
                The checking server stores the answer. It is not included in
                public drop data.
              </p>
            </>
          ) : (
            <>
              <h2>
                {kind === "qr"
                  ? "A QR for every little moment."
                  : "A code for every little surprise."}
              </h2>
              <p>
                {kind === "qr"
                  ? "Event QR codes will be ready to share after the deposit is confirmed."
                  : "Share each code with the person you want to surprise."}
              </p>
              <div className="generated-codes">
                {codes.map((code, i) => (
                  <div key={code}>
                    <span>Drop {i + 1}</span>
                    <strong>{code}</strong>
                  </div>
                ))}
              </div>
              <label>
                A little note{" "}
                <textarea
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="Thanks for being part of our community."
                />
              </label>
            </>
          )}
          <Safety />
          <label className="check-label">
            <input
              type="checkbox"
              checked={safe}
              onChange={(e) => setSafe(e.target.checked)}
            />
            I will keep drops small, in public places, and invite people to hunt
            only in daylight.
          </label>
          <div className="deposit-summary">
            <Coin size="small" />
            <div>
              <strong>{amount} USDC total</strong>
              <p>
                {count} {kind} drops · unclaimed funds refundable to the creator
                after expiry
              </p>
            </div>
          </div>
          <button className="button primary" disabled={busy} onClick={fund}>
            {busy
              ? "Confirming the deposit…"
              : `Fund ${amount} ${USE_MOCKS ? "demo " : ""}USDC`}
            <ArrowRight size={19} />
          </button>
          {USE_MOCKS && (
            <p className="demo-note">
              The deposit is simulated and deducted from your demo balance.
            </p>
          )}
          <button
            className="text-button"
            disabled={busy || !!deposit}
            onClick={() => setStep(1)}
          >
            <ArrowLeft size={17} />
            Edit details
          </button>
        </div>
      )}
      {step === 3 && created && (
        <>
          <div className="created-summary">
            <Coin size="large" />
            <h2>{created.title}</h2>
            <p>
              {money(created.total)} USDC · {created.dropsLeft} drops ready
            </p>
            <span className="receipt-pill">
              <Check size={16} />
              {USE_MOCKS ? "Demo deposit confirmed" : "Deposit confirmed"}
            </span>
          </div>
          <div className="share-drops">
            {created.drops.map((d, i) => (
              <article key={d.dropId}>
                <div className="section-title">
                  <h3>Drop {i + 1}</h3>
                  <span>{money(d.amount)} USDC</span>
                </div>
                {kind === "qr" && (
                  <div className="qr-paper">
                    <QRCode value={shareLink(i)} size={180} />
                  </div>
                )}
                {(kind === "code" || kind === "qr") && (
                  <p className="share-code">{codes[i]}</p>
                )}
                <p className="share-url">{shareLink(i)}</p>
                <button
                  className="button secondary"
                  onClick={() => copy(shareLink(i), d.dropId)}
                >
                  {copied === d.dropId ? (
                    <Check size={17} />
                  ) : (
                    <Copy size={17} />
                  )}{" "}
                  {copied === d.dropId ? "Link copied" : "Copy drop link"}
                </button>
                {kind === "code" && (
                  <button
                    className="text-button"
                    onClick={() => copy(codes[i], `code-${i}`)}
                  >
                    {copied === `code-${i}` ? "Code copied" : "Copy code"}
                  </button>
                )}
              </article>
            ))}
          </div>
          <button
            className="button primary"
            onClick={async () => {
              const first = shareLink(0);
              try {
                if (navigator.share)
                  await navigator.share({
                    title: created.title,
                    text: "Find a little joy with Ego.",
                    url: first,
                  });
                else await copy(first, "share");
              } catch {
                /* user cancelled share */
              }
            }}
          >
            <Share2 size={18} />
            Share this little adventure
          </button>
          <Link className="button secondary" href="/map">
            Explore the map
          </Link>
        </>
      )}
    </div>
  );
}
