"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, ViewTransition } from "react";
import { ArrowUpDown, Coins, Compass, PiggyBank, Plus } from "lucide-react";
import { USE_MOCKS } from "@/lib/api";
import { CreateSheet } from "./create-sheet";
import { Onboarding } from "./onboarding";

const tabs = [
  { href: "/", label: "Home", icon: Coins, match: (p: string) => p === "/" || p.startsWith("/wallet") || p.startsWith("/swap") },
  { href: "/earn", label: "Earn", icon: PiggyBank, match: (p: string) => p.startsWith("/earn") || p.startsWith("/grow") },
  null, // centre: Create
  { href: "/apps", label: "Apps", icon: Compass, match: (p: string) => ["/apps", "/map", "/prizes", "/enter"].some((x) => p.startsWith(x)) },
  { href: "/activity", label: "Activity", icon: ArrowUpDown, match: (p: string) => p.startsWith("/activity") },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [creating, setCreating] = useState(false);
  // Map, hunt and found screens draw their own full-bleed chrome.
  const bleed = path.startsWith("/map") || path.startsWith("/hunt") || path.startsWith("/found");
  const showTabs = !path.startsWith("/hunt") && !path.startsWith("/found");
  const creatingNow = ["/hide", "/pay", "/create"].some((x) => path.startsWith(x));
  return (
    <div className="app-stage">
      <div className="phone">
        <div className={`phone-scroll ${bleed ? "bleed" : ""}`}>
          {!bleed && (
            <header className="topbar" style={{ viewTransitionName: "ego-topbar" }}>
              <Link href="/" className="brand" aria-label="Ego home">
                ego<span className="brand-dot" />
              </Link>
              <span className="spacer" />
              <span className={`pill ${USE_MOCKS ? "demo" : "live"}`}>{USE_MOCKS ? "Demo" : "Arc mainnet"}</span>
            </header>
          )}
          <main>
            {/* Route transitions: tabs cross-fade, back slides right, everything else rises in. */}
            <ViewTransition
              key={path}
              enter={{ "nav-tab": "nav-tab", "nav-back": "nav-back", default: "nav-rise" }}
              exit={{ "nav-tab": "nav-tab", "nav-back": "nav-back", default: "nav-rise" }}
              default="none"
            >
              <div>{children}</div>
            </ViewTransition>
          </main>
        </div>
        {showTabs && (
          <nav className="tabbar" aria-label="Main navigation" style={{ viewTransitionName: "ego-tabbar" }}>
            {tabs.map((t) => {
              if (!t)
                return (
                  <button key="create" className={`tab-create ${creatingNow ? "active" : ""}`} onClick={() => setCreating(true)} aria-label="Create" aria-haspopup="dialog">
                    <span className="tab-create-btn"><Plus size={24} strokeWidth={2.6} /></span>
                  </button>
                );
              const active = t.match(path);
              const Icon = t.icon;
              return (
                <Link key={t.href} href={t.href} transitionTypes={["nav-tab"]} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                  <Icon size={22} strokeWidth={2.1} />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
        {creating && <CreateSheet onClose={() => setCreating(false)} />}
        {path === "/" && <Onboarding />}
      </div>
    </div>
  );
}
