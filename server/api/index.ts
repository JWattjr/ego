// All Ego API routes in one function (vercel.json rewrites /api/* here). Routes match INTERFACE.md section 2.
import { Redis } from "@upstash/redis";
import { createPublicClient, decodeEventLog, http, parseAbiItem, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { checkProof, distanceM, hashSecret, toPublic, type ClaimProof, type DropKind, type DropRecord } from "../lib/core.js";

const env = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`missing env ${k}`); return v; };
const CHAIN_ID = Number(env("CHAIN_ID"));
const CONTRACT = env("CONTRACT_ADDRESS") as Hex;
const EXPLORER = env("EXPLORER_URL");
// Vercel's Upstash integration names these KV_*; a direct Upstash setup names them UPSTASH_REDIS_*.
const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? env("UPSTASH_REDIS_REST_URL"),
  token: process.env.KV_REST_API_TOKEN ?? env("UPSTASH_REDIS_REST_TOKEN"),
});
const chain = createPublicClient({ transport: http(env("RPC_URL")) });
const signer = privateKeyToAccount(env("SIGNER_PRIVATE_KEY") as Hex);

const CampaignCreated = parseAbiItem("event CampaignCreated(bytes32 indexed campaignId, address indexed creator, uint128 amount, uint64 endsAt)");
const Claimed = parseAbiItem("event Claimed(bytes32 indexed campaignId, bytes32 indexed dropId, address indexed to, uint128 amount)");

type CampaignRecord = {
  campaignId: Hex; title: string; creatorName: string; creator?: Hex; total: string;
  endsAt: number; onePerWallet: boolean; dropIds: Hex[]; active: boolean; createTx?: Hex;
};

const MAX_DROP_USDC = 5_000_000n; // 5 USDC: the safety rule, enforced here not just shown in the UI
const SIG_TTL_S = 300;

const cors = { "access-control-allow-origin": process.env.APP_ORIGIN ?? "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });
const fail = (status: number, error: string, message = error) => json({ error, message }, status);

const getCampaign = (id: string) => redis.get<CampaignRecord>(`c:${id.toLowerCase()}`);
const getDrop = (id: string) => redis.get<DropRecord>(`d:${id.toLowerCase()}`);

// ponytail: fixed-window counter per key; good enough to blunt brute-forcing codes, use a sliding window if abused.
async function limited(key: string, max: number, windowS: number) {
  const n = await redis.incr(`rl:${key}`);
  if (n === 1) await redis.expire(`rl:${key}`, windowS);
  return n > max;
}

async function campaignView(c: CampaignRecord, from?: { lat: number; lng: number }) {
  const drops = (await Promise.all(c.dropIds.map(getDrop))).filter(Boolean) as DropRecord[];
  const left = drops.filter((d) => !d.claimed);
  const remaining = left.reduce((s, d) => s + BigInt(d.amount), 0n).toString();
  return {
    campaignId: c.campaignId, title: c.title, creatorName: c.creatorName, creator: c.creator, total: c.total, remaining,
    endsAt: c.endsAt, onePerWallet: c.onePerWallet, drops: drops.map((d) => toPublic(d, c.creatorName, c.endsAt, from)),
    dropsLeft: left.length, createTx: c.createTx,
  };
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  // GET /api/drops/nearby?lat=&lng=
  if (req.method === "GET" && parts[0] === "drops" && parts[1] === "nearby") {
    const lat = Number(url.searchParams.get("lat")), lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail(400, "bad_request", "lat and lng required");
    if (await limited(`near:${ip}`, 120, 60)) return fail(429, "rate_limited");
    const ids = await redis.smembers("map-drops");
    const now = Date.now() / 1000;
    const out = [];
    for (const id of ids) {
      const d = await getDrop(id);
      if (!d || d.claimed || d.reported || distanceM(lat, lng, d.lat!, d.lng!) > 5000) continue;
      const c = await getCampaign(d.campaignId);
      if (c?.active && c.endsAt > now) out.push(toPublic(d, c.creatorName, c.endsAt, { lat, lng }));
    }
    return json(out);
  }

  // POST /api/campaigns
  if (req.method === "POST" && parts[0] === "campaigns" && parts.length === 1) {
    if (await limited(`create:${ip}`, 20, 3600)) return fail(429, "rate_limited");
    const { title, creatorName, endsAt, onePerWallet = true, drops } = body;
    if (!title || !creatorName || !Number.isInteger(endsAt) || endsAt <= Date.now() / 1000 || !Array.isArray(drops) || !drops.length || drops.length > 200)
      return fail(400, "bad_request", "title, creatorName, future endsAt and 1-200 drops required");
    const campaignId = toHex(randomBytes(32));
    const records: DropRecord[] = [];
    for (const d of drops) {
      const kind = d.kind as DropKind;
      let amount: bigint;
      try { amount = BigInt(d.amount); } catch { return fail(400, "bad_request", "amount must be base units"); }
      if (amount <= 0n || amount > MAX_DROP_USDC) return fail(400, "bad_request", "each drop must be 0-5 USDC");
      if (kind === "map" && !(Number.isFinite(d.lat) && Number.isFinite(d.lng))) return fail(400, "bad_request", "map drops need lat/lng");
      if ((kind === "code" || kind === "qr") && !d.code) return fail(400, "bad_request", "code drops need a code");
      if (kind === "puzzle" && !(d.answer && d.hint)) return fail(400, "bad_request", "puzzle drops need a hint and answer");
      if (!["map", "code", "qr", "puzzle"].includes(kind)) return fail(400, "bad_request", "unknown kind");
      records.push({
        campaignId, dropId: toHex(randomBytes(32)), kind, amount: amount.toString(), title: d.title ?? title, hint: d.hint,
        lat: kind === "map" ? d.lat : undefined, lng: kind === "map" ? d.lng : undefined,
        secretHash: kind === "map" ? undefined : hashSecret(kind === "puzzle" ? d.answer : d.code), claimed: false,
      });
    }
    const total = records.reduce((s, d) => s + BigInt(d.amount), 0n).toString();
    const c: CampaignRecord = { campaignId, title, creatorName, total, endsAt, onePerWallet: !!onePerWallet, dropIds: records.map((d) => d.dropId), active: false };
    await Promise.all([redis.set(`c:${campaignId}`, c), ...records.map((d) => redis.set(`d:${d.dropId}`, d))]);
    return json({ campaignId, total, deposit: { to: CONTRACT, amount: total } });
  }

  // GET /api/campaigns/:id
  if (req.method === "GET" && parts[0] === "campaigns" && parts.length === 2) {
    const c = await getCampaign(parts[1]);
    return c ? json(await campaignView(c)) : fail(404, "not_found");
  }

  // POST /api/campaigns/:id/confirm  { txHash }: activate only after the deposit is on-chain and matches.
  if (req.method === "POST" && parts[0] === "campaigns" && parts[2] === "confirm") {
    const c = await getCampaign(parts[1]);
    if (!c) return fail(404, "not_found");
    if (c.active) return json(await campaignView(c));
    const receipt = await chain.getTransactionReceipt({ hash: body.txHash }).catch(() => null);
    if (!receipt || receipt.status !== "success") return fail(400, "tx_not_found", "deposit transaction not confirmed");
    const ev = receipt.logs
      .filter((l) => l.address.toLowerCase() === CONTRACT.toLowerCase())
      .map((l) => { try { return decodeEventLog({ abi: [CampaignCreated], ...l }); } catch { return null; } })
      .find((e) => e?.args.campaignId.toLowerCase() === c.campaignId.toLowerCase());
    if (!ev) return fail(400, "deposit_mismatch", "no CampaignCreated for this campaign in that transaction");
    if (ev.args.amount.toString() !== c.total || Number(ev.args.endsAt) !== c.endsAt)
      return fail(400, "deposit_mismatch", "on-chain amount or end time differs from the campaign");
    Object.assign(c, { active: true, creator: ev.args.creator, createTx: body.txHash });
    const mapIds = (await Promise.all(c.dropIds.map(getDrop))).filter((d) => d?.kind === "map").map((d) => d!.dropId);
    await Promise.all([redis.set(`c:${c.campaignId}`, c), mapIds.length ? redis.sadd("map-drops", mapIds[0], ...mapIds.slice(1)) : null]);
    return json(await campaignView(c));
  }

  // POST /api/claims  { campaignId, dropId, to, proof }: check the proof, sign the EIP-712 approval.
  if (req.method === "POST" && parts[0] === "claims" && parts.length === 1) {
    const { campaignId, dropId, to, proof } = body as { campaignId: string; dropId: string; to: Hex; proof: ClaimProof };
    if (!/^0x[0-9a-fA-F]{40}$/.test(to ?? "")) return fail(400, "bad_request", "to must be an address");
    if (await limited(`claim:${ip}`, 30, 600) || await limited(`claimw:${to.toLowerCase()}`, 30, 600)) return fail(429, "rate_limited");
    const [c, d] = await Promise.all([getCampaign(campaignId ?? ""), getDrop(dropId ?? "")]);
    if (!c || !d || d.campaignId.toLowerCase() !== c.campaignId.toLowerCase() || !c.active) return fail(404, "not_found");
    if (c.endsAt <= Date.now() / 1000) return fail(400, "campaign_ended");
    if (d.claimed || d.reported) return fail(400, "already_claimed");
    const bad = checkProof(d, proof ?? {});
    if (bad) return fail(400, bad);
    const deadline = BigInt(Math.min(Math.floor(Date.now() / 1000) + SIG_TTL_S, c.endsAt - 1));
    const sig = await signer.signTypedData({
      domain: { name: "EgoDrops", version: "1", chainId: CHAIN_ID, verifyingContract: CONTRACT },
      types: { Claim: [
        { name: "campaignId", type: "bytes32" }, { name: "dropId", type: "bytes32" }, { name: "amount", type: "uint128" },
        { name: "to", type: "address" }, { name: "deadline", type: "uint64" }] },
      primaryType: "Claim",
      message: { campaignId: c.campaignId, dropId: d.dropId, amount: BigInt(d.amount), to, deadline },
    });
    return json({ amount: d.amount, deadline: Number(deadline), sig });
  }

  // POST /api/claims/:dropId/submitted  { txHash }: mark claimed once the Claimed event is on-chain.
  if (req.method === "POST" && parts[0] === "claims" && parts[2] === "submitted") {
    const d = await getDrop(parts[1]);
    if (!d) return fail(404, "not_found");
    const receipt = await chain.getTransactionReceipt({ hash: body.txHash }).catch(() => null);
    const ok = receipt?.status === "success" && receipt.logs.some((l) => {
      if (l.address.toLowerCase() !== CONTRACT.toLowerCase()) return false;
      try { return decodeEventLog({ abi: [Claimed], ...l }).args.dropId.toLowerCase() === d.dropId.toLowerCase(); } catch { return false; }
    });
    if (!ok) return fail(400, "tx_not_found", "no Claimed event for this drop in that transaction");
    if (!d.claimed) await Promise.all([redis.set(`d:${d.dropId}`, { ...d, claimed: true }), redis.srem("map-drops", d.dropId)]);
    return json({ explorerUrl: `${EXPLORER}/tx/${body.txHash}` });
  }

  // POST /api/drops/:dropId/report: hide a drop from the map until reviewed.
  if (req.method === "POST" && parts[0] === "drops" && parts[2] === "report") {
    if (await limited(`report:${ip}`, 10, 3600)) return fail(429, "rate_limited");
    const d = await getDrop(parts[1]);
    if (!d) return fail(404, "not_found");
    await Promise.all([redis.set(`d:${d.dropId}`, { ...d, reported: true }), redis.srem("map-drops", d.dropId)]);
    return json({ ok: true });
  }

  return fail(404, "not_found");
}

async function handle(req: Request): Promise<Response> {
  try { return await route(req); }
  catch (e) { console.error(e); return fail(500, "server_error", "something went wrong"); }
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = () => new Response(null, { status: 204, headers: cors });
