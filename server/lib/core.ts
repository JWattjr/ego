// Pure logic: geography, code hashing, claim checks. No I/O, so it is unit-tested directly.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type DropKind = "map" | "code" | "qr" | "puzzle" | "prize";

export type DropRecord = {
  campaignId: `0x${string}`;
  dropId: `0x${string}`;
  kind: DropKind;
  amount: string; // USDC base units
  title: string;
  hint?: string;
  lat?: number;
  lng?: number;
  secretHash?: string; // sha256 of the normalised code or puzzle answer
  recipientHash?: string; // prize drops: sha256 of the winner's normalised email
  claimed: boolean;
  reported?: boolean;
};

export const CLAIM_RADIUS_M = 30;
export const MAX_GPS_ACCURACY_M = 50;
export const FUZZ_RADIUS_M = 150;

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Deterministic per drop, so the circle doesn't jump around between requests,
// and always contains the true spot (offset < radius).
export function fuzzedCentre(drop: DropRecord): { lat: number; lng: number; radiusM: number } {
  const h = createHash("sha256").update(drop.dropId).digest();
  const angle = (h.readUInt16BE(0) / 65535) * 2 * Math.PI;
  const dist = (h.readUInt16BE(2) / 65535) * FUZZ_RADIUS_M * 0.8;
  const dLat = (dist * Math.cos(angle)) / 111320;
  const dLng = (dist * Math.sin(angle)) / (111320 * Math.cos((drop.lat! * Math.PI) / 180));
  return { lat: drop.lat! + dLat, lng: drop.lng! + dLng, radiusM: FUZZ_RADIUS_M };
}

export function normaliseSecret(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function hashSecret(s: string): string {
  return createHash("sha256").update(normaliseSecret(s)).digest("hex");
}

export type ClaimProof = { lat?: number; lng?: number; accuracyM?: number; code?: string; answer?: string };

export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}
export function emailHash(email: string) {
  return createHash("sha256").update(normaliseEmail(email)).digest("hex");
}
export function isEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Stateless email session: "<emailHash>.<expiry>.<hmac>". Proves the holder verified that email.
export function signSession(hash: string, secret: string, ttlS = 7 * 24 * 3600, now = Date.now()) {
  const body = `${hash}.${Math.floor(now / 1000) + ttlS}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("hex")}`;
}
export function verifySession(token: unknown, secret: string, now = Date.now()): string | null {
  if (typeof token !== "string") return null;
  const [hash, exp, mac] = token.split(".");
  if (!hash || !exp || !mac || !/^[0-9a-f]{64}$/.test(hash)) return null;
  const want = createHmac("sha256", secret).update(`${hash}.${exp}`).digest();
  const got = Buffer.from(mac, "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  return Number(exp) > now / 1000 ? hash : null;
}

// Returns null when the proof is good, otherwise an error code from INTERFACE.md.
// For prize drops, pass the email hash from a verified session (never from the request body).
export function checkProof(drop: DropRecord, proof: ClaimProof, verifiedEmailHash?: string | null): null | "too_far" | "wrong_code" | "bad_proof" | "not_your_prize" {
  if (drop.kind === "prize") {
    if (!verifiedEmailHash) return "bad_proof";
    return verifiedEmailHash === drop.recipientHash ? null : "not_your_prize";
  }
  if (drop.kind === "map") {
    const { lat, lng, accuracyM } = proof;
    if (typeof lat !== "number" || typeof lng !== "number" || typeof accuracyM !== "number") return "bad_proof";
    if (accuracyM > MAX_GPS_ACCURACY_M) return "too_far";
    return distanceM(lat, lng, drop.lat!, drop.lng!) <= CLAIM_RADIUS_M ? null : "too_far";
  }
  const given = drop.kind === "puzzle" ? proof.answer : proof.code;
  if (typeof given !== "string" || !given.trim()) return "bad_proof";
  return hashSecret(given) === drop.secretHash ? null : "wrong_code";
}

// Public view of a drop: exact spot only within the claim radius, never the secret.
export function toPublic(drop: DropRecord, creatorName: string, endsAt: number, from?: { lat: number; lng: number }) {
  const out: Record<string, unknown> = {
    campaignId: drop.campaignId, dropId: drop.dropId, kind: drop.kind, amount: drop.amount,
    title: drop.title, hint: drop.hint, creatorName, endsAt, claimed: drop.claimed,
  };
  if (drop.kind === "map") {
    out.approx = fuzzedCentre(drop);
    if (from) {
      const d = distanceM(from.lat, from.lng, drop.lat!, drop.lng!);
      // ponytail: 10 m buckets slow remote trilateration but don't stop it; GPS spoofing is the real ceiling (see README).
      out.distanceM = Math.round(d / 10) * 10;
      if (d <= CLAIM_RADIUS_M) out.exact = { lat: drop.lat, lng: drop.lng };
    }
  }
  return out;
}
