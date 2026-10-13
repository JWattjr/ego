"use client";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "react-qr-code";
import { Puzzle, QrCode, Ticket } from "lucide-react";
import { QrScanner } from "@/components/qr-scanner";
import {
  Coin,
  ErrorMessage,
  HoldButton,
  Loading,
  PageTitle,
  Safety,
} from "@/components/ui";
import {
  DEMO_CODES,
  DEMO_ENTRY_CAMPAIGN,
  demoEntryId,
  getDrop,
  USE_MOCKS,
} from "@/lib/api";
import { useClaim } from "@/lib/hooks";
import { money } from "@/lib/format";
import type { ClaimProof, DropKind, DropPublic } from "@/lib/types";
function Entry({ kind }: { kind: DropKind }) {
  const params = useSearchParams(),
    [campaignId, setCampaignId] = useState(
      params.get("campaignId") ?? (USE_MOCKS ? DEMO_ENTRY_CAMPAIGN : ""),
    ),
    [dropId, setDropId] = useState(
      params.get("dropId") ?? (USE_MOCKS ? demoEntryId(kind) : ""),
    ),
    [drop, setDrop] = useState<DropPublic | null>(null),
    [value, setValue] = useState(params.get("code") ?? ""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [sample, setSample] = useState(false);
  useEffect(() => {
    let live = true;
    setDrop(null);
    setError("");
    if (!campaignId || !dropId) return;
    setLoading(true);
    getDrop(campaignId, dropId)
      .then((d) => {
        if (live) {
          if (d.kind !== kind)
            throw new Error(
              "This drop uses a different entry method. Open its original link.",
            );
          setDrop(d);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [campaignId, dropId, kind]);
  const proof = useMemo<ClaimProof | null>(
    () =>
      value.trim()
        ? kind === "puzzle"
          ? { answer: value.trim() }
          : { code: value.trim() }
        : null,
    [kind, value],
  );
  const claim = useClaim(drop, proof);
  const scanned = (text: string) => {
    try {
      const url = new URL(text);
      if (
        url.searchParams.has("campaignId") &&
        url.searchParams.has("dropId")
      ) {
        setCampaignId(url.searchParams.get("campaignId")!);
        setDropId(url.searchParams.get("dropId")!);
        setValue(url.searchParams.get("code") ?? "");
        return;
      }
    } catch {
      /* plain QR code */
    }
    setValue(text.trim());
  };
  const info =
    kind === "code"
      ? {
          title: "A code. A little joy.",
          description: "Good things are meant to be shared.",
          label: "Your drop code",
          placeholder: "Enter the code you were given",
        }
      : kind === "qr"
        ? {
            title: "You had to be there.",
            description: "Scan your event's QR and claim your moment.",
            label: "Or paste the QR code or link",
            placeholder: "Paste the code from your event QR",
          }
        : {
            title: "A little food for thought.",
            description: "One good answer. One little discovery.",
            label: "Your answer",
            placeholder: "What do you think it is?",
          };
  return (
    <div className="page entry-page">
      <PageTitle title={info.title} description={info.description} />
      <nav className="entry-tabs" aria-label="Find a drop">
        <Link
          href="/enter/code"
          aria-current={kind === "code" ? "page" : undefined}
        >
          <Ticket size={18} />
          Code
        </Link>
        <Link
          href="/enter/qr"
          aria-current={kind === "qr" ? "page" : undefined}
        >
          <QrCode size={18} />
          QR
        </Link>
        <Link
          href="/enter/puzzle"
          aria-current={kind === "puzzle" ? "page" : undefined}
        >
          <Puzzle size={18} />
          Puzzle
        </Link>
      </nav>
      {kind === "qr" && <QrScanner onRead={scanned} />}{" "}
      {!campaignId || !dropId ? (
        <section className="form-stack">
          <p>
            Use the complete link shared by the drop creator, or enter its IDs.
          </p>
          <label>
            Campaign ID
            <input
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              placeholder="0x… campaign ID"
            />
          </label>
          <label>
            Drop ID
            <input
              value={dropId}
              onChange={(e) => setDropId(e.target.value)}
              placeholder="0x… drop ID"
            />
          </label>
        </section>
      ) : null}
      {loading && <Loading text="Opening your drop…" />}
      {error && <ErrorMessage message={error} />}{" "}
      {drop && (
        <>
          <section className="entry-drop">
            <Coin />
            <div>
              <h2>{drop.title}</h2>
              <p>
                {money(drop.amount)} USDC · from {drop.creatorName}
              </p>
            </div>
          </section>
          {drop.hint && (
            <div
              className={`clue-block ${kind === "puzzle" ? "puzzle-clue" : ""}`}
            >
              <h2>
                {kind === "puzzle" ? "Here's your riddle" : "A little note"}
              </h2>
              <p>{drop.hint}</p>
            </div>
          )}
          <label className="entry-input">
            {info.label}
            <input
              value={value}
              onChange={(e) =>
                kind === "qr"
                  ? scanned(e.target.value)
                  : setValue(e.target.value)
              }
              placeholder={info.placeholder}
              autoComplete="off"
              autoCapitalize={kind === "puzzle" ? "sentences" : "characters"}
            />
          </label>
          {drop.claimed ? (
            <ErrorMessage message="This drop has already been collected. Try a different drop link." />
          ) : (
            <HoldButton
              onClaim={claim.claim}
              disabled={!proof}
              busy={claim.busy}
              label={`Hold to claim ${money(drop.amount)} USDC`}
            />
          )}{" "}
          {claim.phase && (
            <p className="help-text" role="status">
              {claim.phase}
            </p>
          )}
          {claim.error && <ErrorMessage message={claim.error} />}
        </>
      )}
      {USE_MOCKS && (
        <details className="demo-help">
          <summary>Try a demo {kind === "puzzle" ? "answer" : "code"}</summary>
          <p>
            Demo only:{" "}
            <strong>{DEMO_CODES[kind as "code" | "qr" | "puzzle"]}</strong>
          </p>
          {kind === "qr" && (
            <>
              <button
                className="text-button"
                onClick={() => setSample(!sample)}
              >
                {sample ? "Hide" : "Show"} sample event QR
              </button>
              {sample && (
                <div className="qr-paper">
                  <QRCode value={DEMO_CODES.qr} size={180} />
                </div>
              )}
            </>
          )}
        </details>
      )}
      <Safety compact />
    </div>
  );
}
export default function EntryPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = use(params);
  if (!["code", "qr", "puzzle"].includes(kind))
    return (
      <div className="page">
        <ErrorMessage message="Choose code, QR or puzzle to open a drop." />
        <Link href="/enter/code">Enter a code</Link>
      </div>
    );
  return (
    <Suspense fallback={<Loading />}>
      <Entry key={kind} kind={kind as DropKind} />
    </Suspense>
  );
}
