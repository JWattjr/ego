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

const COIN_SIZES = { small: "sm", normal: "md", large: "lg" } as const;
type CoinSize = keyof typeof COIN_SIZES | "xs" | "sm" | "md" | "lg" | "xl";
export function Coin({
  size = "normal",
  spin = false,
  float = false,
  className = "",
  style,
}: {
  size?: CoinSize;
  spin?: boolean;
  float?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const s = size in COIN_SIZES ? COIN_SIZES[size as keyof typeof COIN_SIZES] : size;
  return (
    <div
      className={`coin coin-${s} ${spin ? "spin" : ""} ${float ? "float" : ""} ${className}`}
      style={style}
      aria-hidden="true"
    >
      <span className="coin-dollar">$</span>
    </div>
  );
}
// Big money number with a lighter decimal part, like a banking app.
export function Amount({
  base,
  currency = "USDC",
  className = "",
  hidden = false,
  prefix = "",
}: {
  base: string;
  currency?: string;
  className?: string;
  hidden?: boolean;
  prefix?: string;
}) {
  const n = BigInt(base),
    whole = (n / 1000000n).toLocaleString("en-US"),
    dec = ((n % 1000000n) / 10000n).toString().padStart(2, "0");
  return (
    <span className={`amount ${className}`}>
      {prefix}
      {hidden ? "••••" : whole}
      {!hidden && <span className="dec">.{dec}</span>}
      {currency && <span className="cur">{currency}</span>}
    </span>
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
        <span className="small-label">{item.kind === "prize" ? "prize" : `${item.kind} drop`} · on Arc</span>
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
  variant = "bar",
}: {
  onClaim: () => void;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
  variant?: "bar" | "ring";
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
  const events = {
    disabled: disabled || busy,
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      begin();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onBlur: stop,
    onPointerLeave: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!e.repeat) begin();
      }
      if (e.key === "Escape") stop();
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") stop();
    },
    "aria-describedby": "hold-instructions",
  };
  const text = busy ? "Confirming on Arc…" : progress > 0 ? "Keep holding…" : label;
  if (variant === "ring") {
    const C = 2 * Math.PI * 43;
    return (
      <div className="hold-ring-wrap">
        <button
          className={`hold-ring ${progress > 0 ? "holding" : ""} ${busy ? "busy" : ""}`}
          aria-label={text}
          {...events}
        >
          <svg viewBox="0 0 92 92" aria-hidden="true">
            <circle className="track" cx="46" cy="46" r="43" fill="none" strokeWidth="4" />
            <circle
              className="bar"
              cx="46"
              cy="46"
              r="43"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - (busy ? 1 : progress))}
            />
          </svg>
          <span className="hold-ring-core">
            <Coin size="sm" />
          </span>
        </button>
        <span className="hold-ring-label" aria-hidden="true">{text}</span>
        <span id="hold-instructions" className="sr-only">
          Hold for 1.2 seconds. Keyboard: hold Space or Enter.
        </span>
      </div>
    );
  }
  return (
    <div className="hold-wrap">
      <button className="button primary hold-button" {...events}>
        <span className="hold-progress" style={{ width: `${progress * 100}%` }} />
        <span>
          {text}
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
