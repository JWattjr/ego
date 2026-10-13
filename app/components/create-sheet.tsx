"use client";
import Link from "next/link";
import { ChevronRight, MapPinned, Ticket, Trophy } from "lucide-react";
import { FocusDialog } from "./ui";

const options = [
  { href: "/hide", icon: MapPinned, title: "Hide money", sub: "A Money Drop: scatter USDC across public places for people to find" },
  { href: "/pay", icon: Trophy, title: "Pay winners", sub: "Lock hackathon prizes and bounties on Arc; winners claim by email" },
  { href: "/create", icon: Ticket, title: "Codes, event QR codes and puzzles", sub: "Giveaways people claim with a code, a scan or an answer" },
];

export function CreateSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <FocusDialog className="drop-sheet create-sheet" labelledBy="create-title" onClose={onClose}>
        <div className="sheet-handle" />
        <h2 id="create-title">Create</h2>
        <p className="help-text">Lock USDC on Arc once. People claim it the fun way, and anything unclaimed comes back to you.</p>
        <div className="list-card">
          {options.map(({ href, icon: Icon, title, sub }) => (
            <Link key={href} href={href} className="list-row" onClick={onClose}>
              <span className="row-icon"><Icon size={19} /></span>
              <span className="row-main">
                <strong>{title}</strong>
                <span>{sub}</span>
              </span>
              <span className="row-end"><ChevronRight size={18} /></span>
            </Link>
          ))}
        </div>
      </FocusDialog>
    </div>
  );
}
