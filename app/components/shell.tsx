"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Map, Plus, Wallet } from "lucide-react";
import { USE_MOCKS } from "@/lib/api";

const tabs = [
  { href: "/", label: "Wallet", icon: Wallet, match: (p: string) => p === "/" || p.startsWith("/wallet") },
  { href: "/map", label: "Explore", icon: Map, match: (p: string) => p.startsWith("/map") },
  { href: "/enter/code", label: "Find", icon: Compass, match: (p: string) => p.startsWith("/enter") },
  { href: "/create", label: "Drop", icon: Plus, match: (p: string) => p.startsWith("/create") },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // Map, hunt and found screens draw their own full-bleed chrome.
  const bleed = path.startsWith("/map") || path.startsWith("/hunt") || path.startsWith("/found");
  const showTabs = !path.startsWith("/hunt") && !path.startsWith("/found");
  return (
    <div className="app-stage">
      <div className="phone">
        <div className={`phone-scroll ${bleed ? "bleed" : ""}`}>
          {!bleed && (
            <header className="topbar">
              <Link href="/" className="brand" aria-label="Ego home">
                ego<span className="brand-dot" />
              </Link>
              <span className="spacer" />
              <span className={`pill ${USE_MOCKS ? "demo" : "live"}`}>
                {USE_MOCKS ? "Demo" : "Arc mainnet"}
              </span>
            </header>
          )}
          <main>{children}</main>
        </div>
        {showTabs && (
          <nav className="tabbar" aria-label="Main navigation">
            {tabs.map(({ href, label, icon: Icon, match }) => {
              const active = match(path);
              return (
                <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
