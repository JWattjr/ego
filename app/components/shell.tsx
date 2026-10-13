"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Map, MapPin, Plus, Wallet } from "lucide-react";
import { USE_MOCKS } from "@/lib/api";
import { Coin } from "./ui";
const links = [
  { href: "/", label: "Wallet", icon: Wallet },
  { href: "/map", label: "Explore", icon: Map },
  { href: "/enter/code", label: "Find", icon: Compass },
  { href: "/create", label: "Drop", icon: Plus },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="app-frame">
      <aside className="desktop-rail">
        <Link href="/" className="brand">
          ego
          <span className="brand-dot" />
        </Link>
        <p>
          Good things are
          <br />
          closer than you think.
        </p>
        <div className="rail-art">
          <Coin size="large" />
          <span className="rail-line" />
        </div>
        <div className="rail-city">
          <MapPin size={18} />
          <div>
            <strong>Enugu, Nigeria</strong>
            <span>Our first city. Your next find.</span>
          </div>
        </div>
        <p className="rail-note">
          Small discoveries.
          <br />
          Real connections.
        </p>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <Link href="/" className="brand" aria-label="Ego home">
            ego
            <span className="brand-dot" />
          </Link>
          <span className="city-label">
            <MapPin size={15} />
            Enugu
          </span>
          <span className={`network-pill ${USE_MOCKS ? "demo" : ""}`}>
            {USE_MOCKS ? "Demo · fake USDC" : "Arc"}
          </span>
        </header>
        <main>{children}</main>
        <nav className="bottom-nav" aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? path === "/" || path.startsWith("/wallet")
                : href === "/map"
                  ? path.startsWith("/map") || path.startsWith("/hunt")
                  : href === "/enter/code"
                    ? path.startsWith("/enter") || path.startsWith("/found")
                    : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
