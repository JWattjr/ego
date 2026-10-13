"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Flag,
  MapPin,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import type { Collectible, DropKind } from "@/lib/types";
import { useDialogFocus } from "./dialog-focus";

export function FocusDialog({
  children,
  className,
  labelledBy,
  onClose,
}: {
  children: React.ReactNode;
  className: string;
  labelledBy: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, onClose);
  return (
    <section
      ref={ref}
      className={className}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </section>
  );
}

export function Coin({
  size = "normal",
  spin = false,
}: {
  size?: "small" | "normal" | "large";
  spin?: boolean;
}) {
  return (
    <div
      className={`coin coin-${size} ${spin ? "coin-turn" : ""}`}
      aria-hidden="true"
    >
      <span className="coin-orbit" />
      <span className="coin-dollar">$</span>
      <span className="coin-notch one" />
      <span className="coin-notch two" />
    </div>
  );
}
export function PageTitle({
  title,
  description,
  back,
}: {
  title: string;
  description?: string;
  back?: string;
}) {
  return (
    <header className="page-heading">
      {back && (
        <Link
          href={back}
          className="icon-button back-button"
          aria-label="Go back"
        >
          <ArrowLeft size={22} />
        </Link>
      )}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}
export function Loading({
  text = "Finding the good stuff…",
}: {
  text?: string;
}) {
  return (
    <div className="loading" role="status">
      <span className="loading-dot" />
      {text}
    </div>
  );
}
export function ErrorMessage({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-message" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="text-button" onClick={onRetry}>
          Try again <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
export function Safety({
  compact = false,
  onReport,
}: {
  compact?: boolean;
  onReport?: () => void;
}) {
  return (
    <section
      className={`safety ${compact ? "safety-compact" : ""}`}
      aria-label="Hunt safely"
    >
      <div className="safety-title">
        <ShieldCheck size={18} />
        <strong>A little adventure. A safe one.</strong>
      </div>
      <div className="safety-rules">
        <span>
          <CircleDollarSign size={16} />
          1–5 USDC per drop
        </span>
        <span>
          <Sun size={16} />
          Daytime only
        </span>
        <span>
          <MapPin size={16} />
          Public places only
        </span>
      </div>
      {!compact && (
        <p>
          Stay on public paths. Never enter a road, private property or an
          unsafe place to find a drop. Exact locations unlock only within 30 m.
        </p>
      )}
      {onReport && (
        <button className="text-button" onClick={onReport}>
          <Flag size={16} />
          Report this location
        </button>
      )}
    </section>
  );
}
export function CollectibleCard({
  item,
  large = false,
}: {
  item: Collectible;
  large?: boolean;
}) {
  return (
    <article className={`collectible ${large ? "collectible-large" : ""}`}>
      <div className={`collectible-art art-${item.kind}`}>
        <span className="art-orbit orbit-one" />
        <span className="art-orbit orbit-two" />
        <Coin size={large ? "large" : "normal"} />
        <span className="art-dot dot-one" />
        <span className="art-dot dot-two" />
      </div>
      <div className="collectible-copy">
        <span className="small-label">Enugu edition · {item.kind} drop</span>
        <h3>{item.title}</h3>
        <p>From {item.creatorName}</p>
        <span className="collectible-stamp">
          <Check size={14} />
          Collected on Arc
        </span>
      </div>
    </article>
  );
}
export function KindLabel({ kind }: { kind: DropKind }) {
  return (
    <span className="kind-label">
      {kind === "map"
        ? "Nearby drop"
        : kind === "qr"
          ? "Event QR"
          : kind === "code"
            ? "Code drop"
            : "Puzzle drop"}
    </span>
  );
}
export function HoldButton({
  onClaim,
  disabled = false,
  busy = false,
  label = "Hold to claim",
}: {
  onClaim: () => void;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
}) {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);
  const start = useRef(0);
  const holding = useRef(false);
  const done = useRef(false);
  const stop = useCallback(() => {
    holding.current = false;
    cancelAnimationFrame(frame.current);
    setProgress(0);
  }, []);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      stop();
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [stop]);
  useEffect(() => {
    if (!busy) done.current = false;
  }, [busy]);
  useEffect(() => {
    if (disabled || busy) stop();
  }, [disabled, busy, stop]);
  const begin = () => {
    if (disabled || busy || holding.current || done.current) return;
    holding.current = true;
    start.current = performance.now();
    const tick = () => {
      if (!holding.current) return;
      const p = Math.min((performance.now() - start.current) / 1200, 1);
      setProgress(p);
      if (p === 1) {
        holding.current = false;
        done.current = true;
        onClaim();
        setProgress(0);
      } else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  return (
    <div className="hold-wrap">
      <button
        className="button primary hold-button"
        disabled={disabled || busy}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          begin();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onBlur={stop}
        onPointerLeave={stop}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!e.repeat) begin();
          }
          if (e.key === "Escape") stop();
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") stop();
        }}
        aria-describedby="hold-instructions"
      >
        <span
          className="hold-progress"
          style={{ width: `${progress * 100}%` }}
        />
        <span>
          {busy
            ? "Confirming your find…"
            : progress > 0
              ? "Keep holding…"
              : label}
          <CircleDollarSign size={21} />
        </span>
      </button>
      <p id="hold-instructions" className="help-text">
        Hold for 1.2 seconds. Keyboard: hold Space or Enter.
      </p>
    </div>
  );
}
export function ReportDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-backdrop">
      <FocusDialog
        className="dialog"
        labelledBy="report-title"
        onClose={onClose}
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close report"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <Flag size={30} />
        <h2 id="report-title">Something feels unsafe?</h2>
        <p>
          Hide this drop from your map. Your safety matters more than any find.
        </p>
        <p className="help-text">
          In demo mode, this hides the location on this device. Live reports go
          to the checking server.
        </p>
        <button className="button primary" autoFocus onClick={onConfirm}>
          Report & hide this drop
        </button>
        <button className="button secondary" onClick={onClose}>
          Keep this drop
        </button>
      </FocusDialog>
    </div>
  );
}
