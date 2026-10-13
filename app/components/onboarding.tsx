"use client";
// First-launch onboarding: three swipeable screens over one live 3D coin. Shown once per device.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Coin3D } from "./coin3d-loader";

const KEY = "ego.onboarded";
const SLIDES = [
  { kicker: "Welcome to Ego", title: "Money, made fun", body: "A USDC wallet on Arc. Send, receive and grow your dollars, settled in about a second." },
  { kicker: "Money Drops", title: "Find money in the real world", body: "People hide USDC in parks, plazas and campuses. Follow the compass, get within 30 m, hold to claim." },
  { kicker: "Prizes & bounties", title: "Get paid for what you win", body: "Won a hackathon or a bounty? The prize is already locked on Arc. Claim it with your email. No crypto needed." },
];

export function Onboarding() {
  const [show, setShow] = useState(false),
    [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem(KEY));
    } catch {
      /* storage blocked: don't nag */
    }
  }, []);
  const done = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* fine */
    }
    setShow(false);
  };
  const go = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });
  if (!show) return null;
  const last = index === SLIDES.length - 1;
  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Welcome to Ego">
      <button className="onboarding-skip" onClick={done}>Skip</button>
      <div className="onboarding-coin">
        <Coin3D size={230} entrance="drop" />
      </div>
      <div
        className="onboarding-track"
        ref={track}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {SLIDES.map((s, i) => (
          <section key={s.title} className="onboarding-slide" aria-hidden={i !== index}>
            <span className="small-label">{s.kicker}</span>
            <h1>{s.title}</h1>
            <p>{s.body}</p>
          </section>
        ))}
      </div>
      <div className="onboarding-dots" role="tablist" aria-label="Onboarding steps">
        {SLIDES.map((s, i) => (
          <button key={s.title} role="tab" aria-selected={i === index} aria-label={`Step ${i + 1}`} className={i === index ? "on" : ""} onClick={() => go(i)} />
        ))}
      </div>
      <div className="onboarding-actions">
        {last ? (
          <>
            <Link href="/prizes" className="button primary" onClick={done}>Continue with email <ArrowRight size={18} /></Link>
            <button className="button ghost" onClick={done}>Look around first</button>
          </>
        ) : (
          <button className="button primary" onClick={() => go(index + 1)}>Next <ArrowRight size={18} /></button>
        )}
      </div>
    </div>
  );
}
