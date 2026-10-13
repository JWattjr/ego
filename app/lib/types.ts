// Mirrors section 2 of ../INTERFACE.md. Keep wire types exact.
export type DropKind = "map" | "code" | "qr" | "puzzle";
export type DropPublic = {
  campaignId: string;
  dropId: string;
  kind: DropKind;
  amount: string;
  title: string;
  hint?: string;
  creatorName: string;
  endsAt: number;
  claimed: boolean;
  approx?: { lat: number; lng: number; radiusM: number };
  distanceM?: number;
  exact?: { lat: number; lng: number };
};
export type Campaign = {
  campaignId: string;
  title: string;
  creatorName: string;
  creator: string;
  total: string;
  remaining: string;
  endsAt: number;
  onePerWallet: boolean;
  drops: number;
  dropsLeft: number;
  createTx?: string;
};
export type Position = { lat: number; lng: number; accuracyM: number };
export type ClaimProof = Position | { code: string } | { answer: string };
export type CreateDrop = {
  kind: DropKind;
  amount: string;
  title: string;
  hint?: string;
  lat?: number;
  lng?: number;
  code?: string;
  answer?: string;
};
export type CreateCampaignInput = {
  title: string;
  creatorName: string;
  endsAt: number;
  onePerWallet: boolean;
  drops: CreateDrop[];
};
// GET campaign uses `drops` as an array; Campaign uses it as a count.
// INTERFACE.md's literal intersection is impossible in JSON/TypeScript.
// Preserve both wire shapes, using the returned array length for display counts.
export type CampaignDetail = Omit<Campaign, "drops"> & { drops: DropPublic[] };
export type Authorization = { amount: string; deadline: number; sig: string };
export type Deposit = {
  campaignId: string;
  total: string;
  deposit: { to: string; amount: string };
};
export type Receipt = { confirmedMs: number; explorerUrl: string };
// App-only view models: these are not additional checking-server endpoints.
export type Collectible = {
  id: string;
  title: string;
  creatorName: string;
  kind: DropKind;
  earnedAt: number;
};
export type WalletView = {
  address: string;
  balance: string;
  collectibles: Collectible[];
};
export type FoundView = Receipt & {
  drop: DropPublic;
  campaign: Campaign;
  collectible: Collectible;
};
