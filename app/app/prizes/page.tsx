"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Gift, LogOut, Mail, Wallet } from "lucide-react";
import { Amount, ErrorMessage, FocusDialog, HoldButton, Loading } from "@/components/ui";
import { Coin3D } from "@/components/coin3d-loader";
import {
  claimPrize,
  DEMO_EMAIL_CODE,
  getEmailSession,
  getPrizes,
  getWallet,
  signOutEmail,
  startEmailSignIn,
  USE_MOCKS,
  verifyEmailCode,
} from "@/lib/api";
import { shortAddress } from "@/lib/format";
import type { EmailSession, Prize } from "@/lib/types";

const dateOf = (s: number) => new Date(s * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function SignIn({ onSignedIn }: { onSignedIn: (s: EmailSession) => void }) {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="card form-stack prize-signin"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          if (!sent) {
            await startEmailSignIn(email);
            setSent(true);
          } else onSignedIn(await verifyEmailCode(email, code));
        });
      }}
    >
      <label>
        Email the organiser used
        <input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} disabled={sent} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      {sent && (
        <label>
          6-digit code we emailed you
          <input className="code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus />
          {USE_MOCKS && <span className="help-text">Demo mode: the code is {DEMO_EMAIL_CODE}.</span>}
        </label>
      )}
      {error && <ErrorMessage message={error} />}
      <button className="button primary" disabled={busy}>
        {sent ? (busy ? "Checking…" : "Verify and show my prizes") : busy ? "Sending…" : "Email me a code"}
        <ArrowRight size={18} />
      </button>
      {sent && (
        <button type="button" className="text-button" style={{ justifySelf: "center" }} onClick={() => { setSent(false); setCode(""); }}>
          Use a different email
        </button>
      )}
    </form>
  );
}

function ClaimSheet({ prize, onClose }: { prize: Prize; onClose: () => void }) {
  const router = useRouter();
  const [address, setAddress] = useState(""),
    [own, setOwn] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    getWallet().then((w) => {
      setOwn(w.address);
      setAddress((a) => a || w.address);
    });
  }, []);
  const claim = async () => {
    setBusy(true);
    setError("");
    try {
      const dropId = await claimPrize(prize, address.trim());
      router.push(`/found/${dropId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The claim failed. Try again.");
      setBusy(false);
    }
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <FocusDialog className="drop-sheet" labelledBy="claim-title" onClose={onClose}>
        <div className="sheet-handle" />
        <h2 id="claim-title">Claim {Number(prize.amount) / 1e6} USDC</h2>
        <p className="help-text">From {prize.creatorName} · {prize.campaignTitle}</p>
        <label>
          Send it to
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x… wallet address" spellCheck={false} autoCapitalize="off" />
        </label>
        {own && address.toLowerCase() === own.toLowerCase() ? (
          <span className="in-wallet" style={{ justifySelf: "start" }}><Wallet size={14} /> Your Ego wallet · {shortAddress(own)}</span>
        ) : (
          <p className="help-text">Any Arc or EVM wallet address works. Email wallets are coming next.</p>
        )}
        <p className="help-text">No crypto needed: Ego pays the network fee.</p>
        {error && <ErrorMessage message={error} />}
        <HoldButton onClaim={claim} busy={busy} disabled={!/^0x[0-9a-fA-F]{40}$/.test(address.trim())} label={`Hold to claim ${Number(prize.amount) / 1e6} USDC`} />
      </FocusDialog>
    </div>
  );
}

export default function PrizesPage() {
  const [session, setSession] = useState<EmailSession | null>(null),
    [ready, setReady] = useState(false),
    [prizes, setPrizes] = useState<Prize[] | null>(null),
    [error, setError] = useState(""),
    [claiming, setClaiming] = useState<Prize | null>(null);
  const load = useCallback(() => {
    setError("");
    getPrizes().then(setPrizes).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setSession(getEmailSession());
    setReady(true);
  }, []);
  useEffect(() => {
    if (session) load();
  }, [session, load]);
  const waiting = prizes?.filter((p) => !p.claimed) ?? [];
  const total = waiting.reduce((s, p) => s + BigInt(p.amount), 0n).toString();

  return (
    <div className="page">
      <header className="prize-hero rise">
        <Coin3D size={150} />
        <div>
          <span className="small-label">Prizes & bounties</span>
          <h1>Money waiting for you</h1>
          <p>Won a hackathon or a bounty? The prize is already locked on Arc. Claim it with your email; no wallet or crypto needed.</p>
        </div>
      </header>

      {!ready ? null : !session ? (
        <SignIn onSignedIn={setSession} />
      ) : (
        <>
          <div className="prize-account">
            <span className="pill"><Mail size={14} /> {session.email}</span>
            <button className="text-button" onClick={() => { signOutEmail(); setSession(null); setPrizes(null); }}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
          {error && <ErrorMessage message={error} onRetry={load} />}
          {!prizes && !error && <Loading text="Looking for your prizes…" />}
          {prizes && (
            <>
              {waiting.length > 0 && (
                <section className="prize-total rise rise-1">
                  <span>Waiting for you</span>
                  <Amount base={total} />
                </section>
              )}
              <div className="prize-list">
                {prizes.map((p, i) => (
                  <article key={p.dropId} className={`prize-card rise rise-${Math.min(i + 1, 4)} ${p.claimed ? "claimed" : ""}`}>
                    <div className="prize-card-top">
                      <span className="row-icon"><Gift size={18} /></span>
                      <div className="row-main">
                        <strong>{p.campaignTitle}</strong>
                        <span>From {p.creatorName} · claim by {dateOf(p.endsAt)}</span>
                      </div>
                    </div>
                    <div className="prize-card-bottom">
                      <Amount base={p.amount} />
                      {p.claimed ? (
                        <span className="in-wallet"><Check size={14} /> Claimed</span>
                      ) : (
                        <button className="button primary prize-claim" onClick={() => setClaiming(p)}>Claim</button>
                      )}
                    </div>
                  </article>
                ))}
                {!prizes.length && (
                  <div className="empty-collection">
                    <h3>Nothing waiting yet</h3>
                    <p>When an organiser locks a prize for {session.email}, it shows up here, and we email you.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
      {claiming && <ClaimSheet prize={claiming} onClose={() => setClaiming(null)} />}
    </div>
  );
}
