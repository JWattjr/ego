import type {
  Authorization,
  Campaign,
  CampaignDetail,
  ClaimProof,
  Collectible,
  CreateCampaignInput,
  Deposit,
  DropKind,
  DropPublic,
  EmailSession,
  Prize,
  FoundView,
  Position,
  Receipt,
  WalletView,
} from "./types";
import { distance, ENUGU } from "./format";

// The single switch for checking-server requests. No screen calls fetch.
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";
const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);
export const DEMO_WALLET = "0x6e3F01BeA20fa811A568398d0388d9187404e0c1";
export const DEMO_CAMPAIGN = `0x${"1".repeat(64)}`;
export const DEMO_ENTRY_CAMPAIGN = `0x${"2".repeat(64)}`;
export const DEMO_CODES = {
  code: "EGOENUGU",
  qr: "POLO2026",
  puzzle: "tomorrow",
};
const id = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const now = () => Math.floor(Date.now() / 1000);
const tx = () => `0x${crypto.randomUUID().replace(/-/g, "").padEnd(64, "0")}`;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function request<T>(path: string, body?: unknown, session?: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    // No cookies: sessions travel in the Authorization header, so the API can allow any origin.
    credentials: "omit",
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error ?? "request_failed",
      data.message ?? "The request failed. Please try again.",
    );
  return data as T;
}

type MockCampaign = {
  campaign: Campaign;
  drops: DropPublic[];
  active: boolean;
  privateProofs: Record<
    string,
    { lat?: number; lng?: number; code?: string; answer?: string; email?: string }
  >;
};
type MockState = {
  campaigns: MockCampaign[];
  wallet: WalletView;
  found: Record<string, FoundView>;
  reported: string[];
};
const STORAGE_KEY = "ego.demo.v1";
let cached: MockState | null = null;
const authorizations = new Map<
  string,
  { to: string; amount: string; deadline: number }
>();
const submissions = new Map<
  string,
  {
    dropId: string;
    to: string;
    amount: string;
    campaignId: string;
    txHash: string;
    startedAt: number;
  }
>();
function seed(): MockState {
  const endsAt = now() + 86400 * 3;
  const mapDrops: DropPublic[] = [
    {
      campaignId: DEMO_CAMPAIGN,
      dropId: id(101),
      kind: "map",
      amount: "1000000",
      title: "A little joy at Polo Park",
      hint: "Find the blue bench near the public walkway. Stay outside fenced areas.",
      creatorName: "Ada from Enugu",
      endsAt,
      claimed: false,
      approx: { lat: 6.4584, lng: 7.5464, radiusM: 150 },
    },
    {
      campaignId: DEMO_CAMPAIGN,
      dropId: id(102),
      kind: "map",
      amount: "2000000",
      title: "The Independence Avenue walk",
      hint: "Look along the public footpath, never on the road.",
      creatorName: "Ada from Enugu",
      endsAt,
      claimed: false,
      approx: { lat: 6.4489, lng: 7.5304, radiusM: 150 },
    },
    {
      campaignId: DEMO_CAMPAIGN,
      dropId: id(103),
      kind: "map",
      amount: "3000000",
      title: "New Haven, new discoveries",
      hint: "A sunny public meeting spot. Do not enter private buildings.",
      creatorName: "Ada from Enugu",
      endsAt,
      claimed: false,
      approx: { lat: 6.4701, lng: 7.5541, radiusM: 150 },
    },
  ];
  const entryDrops: DropPublic[] = [
    {
      campaignId: DEMO_ENTRY_CAMPAIGN,
      dropId: id(201),
      kind: "code",
      amount: "2000000",
      title: "A word worth sharing",
      hint: "A small thank-you from the Enugu community.",
      creatorName: "The Ego community",
      endsAt,
      claimed: false,
    },
    {
      campaignId: DEMO_ENTRY_CAMPAIGN,
      dropId: id(202),
      kind: "qr",
      amount: "1000000",
      title: "Meet us at the makers event",
      hint: "Scan the event QR shared by your host.",
      creatorName: "The Ego community",
      endsAt,
      claimed: false,
    },
    {
      campaignId: DEMO_ENTRY_CAMPAIGN,
      dropId: id(203),
      kind: "puzzle",
      amount: "3000000",
      title: "A little food for thought",
      hint: "I am always coming, but I never arrive. What am I?",
      creatorName: "The Ego community",
      endsAt,
      claimed: false,
    },
  ];
  return {
    campaigns: [
      {
        campaign: {
          campaignId: DEMO_CAMPAIGN,
          title: "Enugu, little by little",
          creatorName: "Ada from Enugu",
          creator: DEMO_WALLET,
          total: "6000000",
          remaining: "6000000",
          endsAt,
          onePerWallet: false,
          drops: 3,
          dropsLeft: 3,
        },
        drops: mapDrops,
        active: true,
        privateProofs: {
          [id(101)]: { lat: 6.459, lng: 7.5469 },
          [id(102)]: { lat: 6.4493, lng: 7.531 },
          [id(103)]: { lat: 6.4705, lng: 7.5546 },
        },
      },
      {
        campaign: {
          campaignId: DEMO_ENTRY_CAMPAIGN,
          title: "Good things find their way",
          creatorName: "The Ego community",
          creator: DEMO_WALLET,
          total: "6000000",
          remaining: "6000000",
          endsAt,
          onePerWallet: false,
          drops: 3,
          dropsLeft: 3,
        },
        drops: entryDrops,
        active: true,
        privateProofs: {
          [id(201)]: { code: DEMO_CODES.code },
          [id(202)]: { code: DEMO_CODES.qr },
          [id(203)]: { answer: DEMO_CODES.puzzle },
        },
      },
    ],
    wallet: { address: DEMO_WALLET, balance: "12500000", collectibles: [] },
    found: {},
    reported: [],
  };
}
function state() {
  if (cached) return cached;
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) cached = JSON.parse(saved) as MockState;
    } catch {
      /* storage is optional */
    }
  }
  return (cached ??= seed());
}
function save() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state()));
    } catch {
      /* private browsing */
    }
  }
}
const wait = () => new Promise<void>((r) => setTimeout(r, 240));
function campaignById(campaignId: string) {
  const found = state().campaigns.find(
    (c) => c.campaign.campaignId === campaignId,
  );
  if (!found)
    throw new ApiError(
      "not_found",
      "This drop link could not be found. Check the link with its creator.",
    );
  return found;
}
function publicDrop(
  c: MockCampaign,
  drop: DropPublic,
  position?: Position,
): DropPublic {
  const output: DropPublic = {
    ...drop,
    ...(drop.approx ? { approx: { ...drop.approx } } : {}),
  };
  delete output.exact;
  delete output.distanceM;
  const secret = c.privateProofs[drop.dropId];
  if (
    drop.kind === "map" &&
    position &&
    secret?.lat !== undefined &&
    secret?.lng !== undefined
  ) {
    output.distanceM = Math.round(
      distance(position, { lat: secret.lat, lng: secret.lng }),
    );
    if (distance(position, { lat: secret.lat, lng: secret.lng }) <= 30)
      output.exact = { lat: secret.lat, lng: secret.lng };
  }
  return output;
}
export async function getNearby(position?: Position): Promise<DropPublic[]> {
  if (!USE_MOCKS)
    return request(
      `/api/drops/nearby?lat=${position?.lat ?? ENUGU.lat}&lng=${position?.lng ?? ENUGU.lng}`,
    );
  await wait();
  return state()
    .campaigns.filter((c) => c.active && c.campaign.endsAt > now())
    .flatMap((c) =>
      c.drops
        .filter(
          (d) =>
            d.kind === "map" &&
            !d.claimed &&
            !state().reported.includes(d.dropId),
        )
        .map((d) => publicDrop(c, d, position)),
    )
    .filter((d) => !position || distance(position, d.approx!) < 5000);
}
export async function getCampaign(campaignId: string): Promise<CampaignDetail> {
  if (!USE_MOCKS)
    return request(`/api/campaigns/${encodeURIComponent(campaignId)}`);
  await wait();
  const c = campaignById(campaignId);
  return {
    ...c.campaign,
    drops: c.drops
      .filter((d) => !state().reported.includes(d.dropId))
      .map((d) => publicDrop(c, d)),
  };
}
export async function getDrop(
  campaignId: string,
  dropId: string,
  position?: Position,
): Promise<DropPublic> {
  if (USE_MOCKS) {
    await wait();
    const c = campaignById(campaignId);
    const d = c.drops.find((d) => d.dropId === dropId);
    if (!d) throw new ApiError("not_found", "We couldn't find this drop.");
    return publicDrop(c, d, position);
  }
  if (position) {
    const nearby = await getNearby(position);
    const found = nearby.find(
      (d) => d.dropId === dropId && d.campaignId === campaignId,
    );
    if (found) return found;
  }
  const c = await getCampaign(campaignId);
  const found = c.drops.find((d) => d.dropId === dropId);
  if (!found) throw new ApiError("not_found", "We couldn't find this drop.");
  return found;
}
export async function authorizeClaim(input: {
  campaignId: string;
  dropId: string;
  to: string;
  proof: ClaimProof;
}): Promise<Authorization> {
  if (!USE_MOCKS) return request("/api/claims", input);
  await wait();
  const c = campaignById(input.campaignId),
    d = c.drops.find((d) => d.dropId === input.dropId);
  if (!d || !c.active)
    throw new ApiError("not_found", "This drop is not active.");
  if (c.campaign.endsAt <= now())
    throw new ApiError(
      "campaign_ended",
      "This drop has ended. Find another nearby.",
    );
  if (d.claimed || state().reported.includes(d.dropId))
    throw new ApiError("already_claimed", "This drop is no longer available.");
  if (
    c.campaign.onePerWallet &&
    Object.values(state().found).some(
      (f) => f.campaign.campaignId === input.campaignId,
    )
  )
    throw new ApiError(
      "already_claimed",
      "You have already collected a drop from this campaign.",
    );
  if (!/^0x[\da-fA-F]{40}$/.test(input.to))
    throw new ApiError("invalid_wallet", "Connect a valid wallet to claim.");
  const secret = c.privateProofs[d.dropId];
  if (d.kind === "map") {
    if (
      !("lat" in input.proof) ||
      !Number.isFinite(input.proof.lat) ||
      !Number.isFinite(input.proof.lng) ||
      !Number.isFinite(input.proof.accuracyM) ||
      input.proof.accuracyM > 30 ||
      input.proof.accuracyM < 0 ||
      distance(input.proof, { lat: secret.lat!, lng: secret.lng! }) > 30
    )
      throw new ApiError(
        "too_far",
        "Get within 30 m and wait for an accurate location fix before claiming.",
      );
  } else if (d.kind === "puzzle") {
    if (
      !("answer" in input.proof) ||
      input.proof.answer.trim().toLowerCase() !==
        secret.answer?.trim().toLowerCase()
    )
      throw new ApiError(
        "wrong_code",
        "Not quite. Read the clue and try another answer.",
      );
  } else if (
    !("code" in input.proof) ||
    input.proof.code.trim().toUpperCase() !== secret.code?.toUpperCase()
  )
    throw new ApiError(
      "wrong_code",
      "That code doesn't match. Check it with the person who shared it.",
    );
  const deadline = now() + 300,
    sig = `0x${"d".repeat(130)}`;
  authorizations.set(input.dropId, {
    to: input.to,
    amount: d.amount,
    deadline,
  });
  return { amount: d.amount, deadline, sig };
}
export async function submitClaim(input: {
  campaignId: string;
  dropId: string;
  to: string;
  authorization: Authorization;
}): Promise<string> {
  const startedAt = Date.now();
  // TODO(wallet): submit EgoDrops.claim(campaignId, dropId, amount, to, deadline, sig)
  // using the Circle user-controlled wallet on ARC with sponsored gas; return its hash.
  if (!USE_MOCKS)
    throw new ApiError(
      "wallet_not_connected",
      "Wallet integration is coming next. No transaction has been sent.",
    );
  await wait();
  const auth = authorizations.get(input.dropId);
  if (
    !auth ||
    auth.to !== input.to ||
    auth.amount !== input.authorization.amount ||
    auth.deadline <= now()
  )
    throw new ApiError("expired", "Your claim expired. Hold to claim again.");
  const existing = submissions.get(input.dropId);
  if (existing) return existing.txHash;
  const txHash = tx();
  submissions.set(input.dropId, {
    ...input,
    amount: auth.amount,
    txHash,
    startedAt,
  });
  return txHash;
}
export async function confirmClaim(
  dropId: string,
  txHash: string,
): Promise<Receipt> {
  if (!USE_MOCKS)
    return request(`/api/claims/${encodeURIComponent(dropId)}/submitted`, {
      txHash,
    });
  await wait();
  const existing = state().found[dropId];
  if (existing)
    return {
      explorerUrl: existing.explorerUrl,
    };
  const submitted = submissions.get(dropId);
  if (!submitted || submitted.txHash !== txHash)
    throw new ApiError(
      "not_submitted",
      "Submit the claim before checking its receipt.",
    );
  const c = campaignById(submitted.campaignId),
    d = c.drops.find((d) => d.dropId === dropId)!;
  if (d.claimed)
    throw new ApiError("already_claimed", "Someone already found this drop.");
  d.claimed = true;
  c.campaign.remaining = (
    BigInt(c.campaign.remaining) - BigInt(d.amount)
  ).toString();
  c.campaign.dropsLeft -= 1;
  state().wallet.balance = (
    BigInt(state().wallet.balance) + BigInt(d.amount)
  ).toString();
  const collectible: Collectible = {
    id: d.campaignId,
    title: c.campaign.title,
    creatorName: d.creatorName,
    kind: d.kind,
    earnedAt: now(),
  };
  if (!state().wallet.collectibles.some((item) => item.id === collectible.id))
    state().wallet.collectibles.push(collectible);
  const receipt = {
    explorerUrl: `https://explorer.arc.io/tx/${txHash}`,
  };
  state().found[dropId] = {
    ...receipt,
    confirmedMs: Date.now() - submitted.startedAt,
    drop: publicDrop(c, d),
    campaign: { ...c.campaign },
    collectible,
  };
  save();
  return receipt;
}
export async function getFound(dropId: string): Promise<FoundView | null> {
  // Receipt view is app state, not a new server endpoint.
  if (typeof window !== "undefined") {
    try {
      const data = sessionStorage.getItem(`ego.found.${dropId}`);
      if (data) return JSON.parse(data) as FoundView;
    } catch {
      /* use the mock fallback when storage is unavailable */
    }
  }
  if (USE_MOCKS) return state().found[dropId] ?? null;
  return null;
}
export function rememberFound(view: FoundView) {
  if (typeof window !== "undefined")
    sessionStorage.setItem(
      `ego.found.${view.drop.dropId}`,
      JSON.stringify(view),
    );
}
export async function createCampaign(
  input: CreateCampaignInput,
): Promise<Deposit> {
  if (!USE_MOCKS) return request("/api/campaigns", input);
  await wait();
  if (
    input.endsAt <= now() ||
    !input.title.trim() ||
    !input.creatorName.trim() ||
    !input.drops.length ||
    input.drops.length > 200
  )
    throw new ApiError(
      "invalid_campaign",
      "Add a title, creator and 1–200 drops with a future end time.",
    );
  if (
    input.drops.some(
      (d) =>
        !/^\d+$/.test(d.amount) ||
        BigInt(d.amount) < 1000000n ||
        BigInt(d.amount) > (d.kind === "prize" ? 10000000000n : 5000000n),
    )
  )
    throw new ApiError(
      "invalid_amount",
      "Keep public drops between 1 and 5 USDC, and prizes up to 10,000 USDC.",
    );
  if (
    input.drops.some(
      (d) =>
        d.kind === "map" &&
        (!Number.isFinite(d.lat) || !Number.isFinite(d.lng)),
    )
  )
    throw new ApiError(
      "invalid_location",
      "Place every map drop in a public location.",
    );
  const campaignId = tx(),
    total = input.drops
      .reduce((sum, d) => sum + BigInt(d.amount), 0n)
      .toString();
  const publicDrops: DropPublic[] = input.drops.map((d) => ({
    campaignId,
    dropId: tx(),
    kind: d.kind,
    amount: d.amount,
    title: d.title,
    hint: d.hint,
    creatorName: input.creatorName,
    endsAt: input.endsAt,
    claimed: false,
    ...(d.kind === "map"
      ? { approx: { lat: d.lat! + 0.0005, lng: d.lng! - 0.0005, radiusM: 150 } }
      : {}),
  }));
  const privateProofs: MockCampaign["privateProofs"] = {};
  input.drops.forEach(
    (d, i) =>
      (privateProofs[publicDrops[i].dropId] = {
        lat: d.lat,
        lng: d.lng,
        code: d.code,
        answer: d.answer,
        email: d.email?.trim().toLowerCase(),
      }),
  );
  state().campaigns.push({
    campaign: {
      campaignId,
      title: input.title,
      creatorName: input.creatorName,
      creator: state().wallet.address,
      total,
      remaining: total,
      endsAt: input.endsAt,
      onePerWallet: input.onePerWallet,
      drops: input.drops.length,
      dropsLeft: input.drops.length,
    },
    drops: publicDrops,
    active: false,
    privateProofs,
  });
  save();
  return {
    campaignId,
    total,
    deposit: {
      to: "0x0000000000000000000000000000000000000E60",
      amount: total,
    },
  };
}
export async function submitDeposit(
  deposit: Deposit,
  input: CreateCampaignInput,
): Promise<string> {
  // TODO(wallet): approve the exact six-decimal USDC amount, then call
  // EgoDrops.createCampaign(campaignId, total, endsAt, onePerWallet) on ARC.
  if (!USE_MOCKS)
    throw new ApiError(
      "wallet_not_connected",
      "Connect your wallet to fund this campaign. Nothing has been deposited.",
    );
  void input;
  await wait();
  if (BigInt(state().wallet.balance) < BigInt(deposit.total))
    throw new ApiError(
      "insufficient_balance",
      "Your demo balance is too low. Reduce the total.",
    );
  const c = campaignById(deposit.campaignId);
  if (c.campaign.createTx) return c.campaign.createTx;
  state().wallet.balance = (
    BigInt(state().wallet.balance) - BigInt(deposit.total)
  ).toString();
  c.campaign.createTx = tx();
  save();
  return c.campaign.createTx;
}
export async function confirmCampaign(
  campaignId: string,
  txHash: string,
): Promise<Campaign> {
  if (!USE_MOCKS)
    return request(`/api/campaigns/${encodeURIComponent(campaignId)}/confirm`, {
      txHash,
    });
  await wait();
  const c = campaignById(campaignId);
  if (c.campaign.createTx !== txHash)
    throw new ApiError(
      "not_deposited",
      "Confirm the deposit before sharing the drops.",
    );
  c.active = true;
  save();
  return { ...c.campaign };
}
export async function getWallet(): Promise<WalletView> {
  // TODO(wallet): read connected ARC wallet's six-decimal ERC-20 USDC balance
  // and EgoDrops collectible holdings. There is no wallet endpoint in INTERFACE.md.
  if (!USE_MOCKS) return { address: "", balance: "0", collectibles: [] };
  await wait();
  return { ...state().wallet, collectibles: [...state().wallet.collectibles] };
}
export async function sendMoney(
  to: string,
  amount: string,
): Promise<{ txHash: string; explorerUrl: string }> {
  // TODO(wallet): Circle user-controlled wallet USDC transfer with Gas Station.
  if (!USE_MOCKS)
    throw new ApiError(
      "wallet_not_connected",
      "Connect your wallet before sending. Nothing has been sent.",
    );
  await wait();
  if (!/^0x[\da-fA-F]{40}$/.test(to))
    throw new ApiError("invalid_wallet", "Enter a full 0x wallet address.");
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n)
    throw new ApiError("invalid_amount", "Enter an amount greater than zero.");
  if (BigInt(amount) > BigInt(state().wallet.balance))
    throw new ApiError(
      "insufficient_balance",
      "That amount is more than your available balance.",
    );
  state().wallet.balance = (
    BigInt(state().wallet.balance) - BigInt(amount)
  ).toString();
  save();
  const txHash = tx();
  return { txHash, explorerUrl: `https://explorer.arc.io/tx/${txHash}` };
}
export async function reportLocation(dropId: string): Promise<void> {
  if (!USE_MOCKS)
    await request<{ ok: true }>(
      `/api/drops/${encodeURIComponent(dropId)}/report`,
      {},
    );
  if (USE_MOCKS) {
    if (!state().reported.includes(dropId)) state().reported.push(dropId);
    save();
  }
  if (typeof window !== "undefined") {
    try {
      const reports = JSON.parse(
        localStorage.getItem("ego.hidden") ?? "[]",
      ) as string[];
      localStorage.setItem(
        "ego.hidden",
        JSON.stringify([...new Set([...reports, dropId])]),
      );
    } catch {
      /* the server report still succeeds if browser storage is unavailable */
    }
  }
}
export function isReported(dropId: string) {
  if (typeof window === "undefined") return false;
  try {
    return (
      JSON.parse(localStorage.getItem("ego.hidden") ?? "[]") as string[]
    ).includes(dropId);
  } catch {
    return false;
  }
}
export function demoEntryId(kind: DropKind) {
  return id(kind === "code" ? 201 : kind === "qr" ? 202 : 203);
}
export function simulationStart(drop: DropPublic) {
  return {
    lat: drop.approx?.lat ?? ENUGU.lat,
    lng: (drop.approx?.lng ?? ENUGU.lng) - 0.004,
    accuracyM: 5,
  };
}
export function simulateStep(drop: DropPublic, position: Position): Position {
  // Development-only fake GPS. These fixture coordinates are never used with the real server.
  if (!USE_MOCKS || process.env.NODE_ENV !== "development")
    throw new Error("Simulation is only available in mock development mode.");
  const target = campaignById(drop.campaignId).privateProofs[drop.dropId];
  const remaining = distance(position, { lat: target.lat!, lng: target.lng! });
  const fraction = Math.min(1, 50 / Math.max(remaining, 1));
  return {
    lat: position.lat + (target.lat! - position.lat) * fraction,
    lng: position.lng + (target.lng! - position.lng) * fraction,
    accuracyM: 5,
  };
}

/* ───────────── Prizes: money locked for a named winner, claimed by email ───────────── */
const SESSION_KEY = "ego.session";
const DEMO_PRIZE_CAMPAIGN = `0x${"3".repeat(64)}`;
export const DEMO_EMAIL_CODE = "123456";

export function getEmailSession(): EmailSession | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as EmailSession | null;
  } catch {
    return null;
  }
}
export function signOutEmail() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage is optional */
  }
}
export async function startEmailSignIn(email: string): Promise<void> {
  if (!USE_MOCKS) return void (await request("/api/auth/email/start", { email }));
  await wait();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new ApiError("bad_request", "Enter a valid email.");
}
export async function verifyEmailCode(email: string, code: string): Promise<EmailSession> {
  let session: string;
  if (USE_MOCKS) {
    await wait();
    if (code.trim() !== DEMO_EMAIL_CODE) throw new ApiError("wrong_code", `That code isn't right. In demo mode it's ${DEMO_EMAIL_CODE}.`);
    session = "demo";
  } else session = (await request<{ session: string }>("/api/auth/email/verify", { email, code: code.trim() })).session;
  const value = { session, email: email.trim().toLowerCase() };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {
    /* the session then lasts only for this page */
  }
  return value;
}

// Demo mode: one sample prize for whoever signs in, plus any prizes created on this device for that email.
function demoPrizeCampaign(): MockCampaign {
  let c = state().campaigns.find((x) => x.campaign.campaignId === DEMO_PRIZE_CAMPAIGN);
  if (!c) {
    const endsAt = now() + 86400 * 14;
    c = {
      campaign: {
        campaignId: DEMO_PRIZE_CAMPAIGN, title: "Arc Builders Bounty · Best map UX", creatorName: "Arc Builders",
        creator: "0x0000000000000000000000000000000000000A2C", total: "25000000", remaining: "25000000",
        endsAt, onePerWallet: false, drops: 1, dropsLeft: 1,
      },
      drops: [{ campaignId: DEMO_PRIZE_CAMPAIGN, dropId: id(301), kind: "prize", amount: "25000000", title: "Winner · Best map UX", creatorName: "Arc Builders", endsAt, claimed: false }],
      active: true,
      privateProofs: { [id(301)]: { email: "*" } },
    };
    state().campaigns.push(c);
    save();
  }
  return c;
}
export async function getPrizes(): Promise<Prize[]> {
  const s = getEmailSession();
  if (!s) throw new ApiError("sign_in", "Verify your email to see your prizes.");
  if (!USE_MOCKS) return request<Prize[]>("/api/prizes", undefined, s.session);
  await wait();
  demoPrizeCampaign();
  return state().campaigns
    .filter((c) => c.active)
    .flatMap((c) =>
      c.drops
        .filter((d) => d.kind === "prize" && ["*", s.email].includes(c.privateProofs[d.dropId]?.email ?? ""))
        .map((d) => ({ ...d, campaignTitle: c.campaign.title })),
    );
}
// The server checks the email session, signs, submits the claim and pays the gas.
export async function claimPrize(prize: Prize, to: string): Promise<string> {
  const s = getEmailSession();
  if (!s) throw new ApiError("sign_in", "Verify your email first.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new ApiError("bad_request", "Enter a valid wallet address (0x…).");
  const started = performance.now();
  let receipt: { explorerUrl: string; confirmedMs?: number };
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 650));
    const c = campaignById(prize.campaignId);
    const d = c.drops.find((x) => x.dropId === prize.dropId)!;
    if (d.claimed) throw new ApiError("already_claimed", "This prize has already been claimed.");
    d.claimed = true;
    c.campaign.dropsLeft -= 1;
    if (to.toLowerCase() === state().wallet.address.toLowerCase())
      state().wallet.balance = (BigInt(state().wallet.balance) + BigInt(d.amount)).toString();
    save();
    receipt = { explorerUrl: `https://explorer.arc.io/tx/${tx()}` };
  } else receipt = await request("/api/claims/relay", { campaignId: prize.campaignId, dropId: prize.dropId, to, proof: {} }, s.session);
  const campaign = await getCampaign(prize.campaignId).catch(() => null);
  const collectible: Collectible = { id: prize.campaignId, title: prize.campaignTitle, creatorName: prize.creatorName, kind: "prize", earnedAt: now() };
  if (USE_MOCKS) {
    state().wallet.collectibles.unshift(collectible);
    save();
  }
  rememberFound({
    explorerUrl: receipt.explorerUrl,
    confirmedMs: receipt.confirmedMs ?? Math.round(performance.now() - started),
    drop: { ...prize, claimed: true },
    campaign: campaign
      ? { ...campaign, drops: campaign.drops.length }
      : { campaignId: prize.campaignId, title: prize.campaignTitle, creatorName: prize.creatorName, creator: "", total: prize.amount, remaining: "0", endsAt: prize.endsAt, onePerWallet: false, drops: 1, dropsLeft: 0 },
    collectible,
  });
  return prize.dropId;
}
