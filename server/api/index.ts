// All Ego API routes in one function (vercel.json rewrites /api/* here). Routes match INTERFACE.md section 2.
import { Redis } from "@upstash/redis";
import { createPublicClient, createWalletClient, decodeEventLog, defineChain, http, parseAbiItem, toHex, type Hex } from "viem";
import nodemailer from "nodemailer";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes, randomInt } from "node:crypto";
import { checkProof, distanceM, emailHash, hashSecret, isEmail, normaliseEmail, signSession, toPublic, verifySession, type ClaimProof, type DropKind, type DropRecord } from "../lib/core.js";

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
const SESSION_SECRET = env("SESSION_SECRET");
const APP_URL = process.env.APP_ORIGIN ?? "";
const arc = defineChain({ id: CHAIN_ID, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [env("RPC_URL")] } } });
// Optional: a small wallet that pays claim gas so winners need no crypto first. Holds only gas money.
const relayer = process.env.RELAYER_PRIVATE_KEY
  ? createWalletClient({ chain: arc, account: privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY as Hex), transport: http(env("RPC_URL")) })
  : null;
// Optional: SMTP for verification codes and "you won" emails (Gmail app password, Resend SMTP, etc.).
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") } })
  : null;
const MAIL_FROM = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "";
const claimAbi = [parseAbiItem("function claim(bytes32 campaignId, bytes32 dropId, uint128 amount, address to, uint64 deadline, bytes sig)")];
const usdc = (base: string) => (Number(base) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 });

async function sendMail(to: string, subject: string, text: string) {
  if (!mailer) throw new Error("email is not configured on this server");
  await mailer.sendMail({ from: `Ego <${MAIL_FROM}>`, to, subject, text });
}

const CampaignCreated = parseAbiItem("event CampaignCreated(bytes32 indexed campaignId, address indexed creator, uint128 amount, uint64 endsAt)");
const Claimed = parseAbiItem("event Claimed(bytes32 indexed campaignId, bytes32 indexed dropId, address indexed to, uint128 amount)");

type CampaignRecord = {
  campaignId: Hex; title: string; creatorName: string; creator?: Hex; total: string;
  endsAt: number; onePerWallet: boolean; dropIds: Hex[]; active: boolean; createTx?: Hex;
};

const MAX_DROP_USDC = 5_000_000n; // 5 USDC: the safety rule for public drops, enforced here not just shown in the UI
const MAX_PRIZE_USDC = 10_000_000_000n; // 10,000 USDC per prize: prizes go to a named, verified winner
const SIG_TTL_S = 300;

const cors = { "access-control-allow-origin": process.env.APP_ORIGIN ?? "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET,POST,OPTIONS" };
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

function sessionFrom(req: Request, body: { session?: string }) {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : body?.session;
}

// Shared by /claims and /claims/relay: validates everything and returns a signed approval.
async function authoriseClaim(req: Request, body: Record<string, unknown>, ip: string) {
  const { campaignId, dropId, to, proof } = body as { campaignId: string; dropId: string; to: Hex; proof: ClaimProof };
  if (!/^0x[0-9a-fA-F]{40}$/.test(to ?? "")) return fail(400, "bad_request", "to must be an address");
  if (await limited(`claim:${ip}`, 30, 600) || await limited(`claimw:${to.toLowerCase()}`, 30, 600)) return fail(429, "rate_limited");
  const [c, d] = await Promise.all([getCampaign(campaignId ?? ""), getDrop(dropId ?? "")]);
  if (!c || !d || d.campaignId.toLowerCase() !== c.campaignId.toLowerCase() || !c.active) return fail(404, "not_found");
  if (c.endsAt <= Date.now() / 1000) return fail(400, "campaign_ended");
  if (d.claimed || d.reported) return fail(400, "already_claimed");
  // Prize drops: the email comes only from a verified session, never from the request body.
  const verified = d.kind === "prize" ? verifySession(sessionFrom(req, body as { session?: string }), SESSION_SECRET) : null;
  const bad = checkProof(d, proof ?? {}, verified);
  if (bad) return fail(400, bad, bad === "not_your_prize" ? "this prize belongs to a different email" : bad);
  const deadline = BigInt(Math.min(Math.floor(Date.now() / 1000) + SIG_TTL_S, c.endsAt - 1));
  const sig = await signer.signTypedData({
    domain: { name: "EgoDrops", version: "1", chainId: CHAIN_ID, verifyingContract: CONTRACT },
    types: { Claim: [
      { name: "campaignId", type: "bytes32" }, { name: "dropId", type: "bytes32" }, { name: "amount", type: "uint128" },
      { name: "to", type: "address" }, { name: "deadline", type: "uint64" }] },
    primaryType: "Claim",
    message: { campaignId: c.campaignId, dropId: d.dropId, amount: BigInt(d.amount), to, deadline },
  });
  return { c, d, to, deadline, sig };
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
    const winners: { email: string; amount: string }[] = [];
    for (const d of drops) {
      const kind = d.kind as DropKind;
      let amount: bigint;
      try { amount = BigInt(d.amount); } catch { return fail(400, "bad_request", "amount must be base units"); }
      const cap = kind === "prize" ? MAX_PRIZE_USDC : MAX_DROP_USDC;
      if (amount <= 0n || amount > cap) return fail(400, "bad_request", kind === "prize" ? "each prize must be 0-10,000 USDC" : "each drop must be 0-5 USDC");
      if (kind === "prize" && !isEmail(d.email)) return fail(400, "bad_request", "prizes need the winner's email");
      if (kind === "map" && !(Number.isFinite(d.lat) && Number.isFinite(d.lng))) return fail(400, "bad_request", "map drops need lat/lng");
      if ((kind === "code" || kind === "qr") && !d.code) return fail(400, "bad_request", "code drops need a code");
      if (kind === "puzzle" && !(d.answer && d.hint)) return fail(400, "bad_request", "puzzle drops need a hint and answer");
      if (!["map", "code", "qr", "puzzle", "prize"].includes(kind)) return fail(400, "bad_request", "unknown kind");
      records.push({
        campaignId, dropId: toHex(randomBytes(32)), kind, amount: amount.toString(), title: d.title ?? title, hint: d.hint,
        lat: kind === "map" ? d.lat : undefined, lng: kind === "map" ? d.lng : undefined,
        secretHash: kind === "map" || kind === "prize" ? undefined : hashSecret(kind === "puzzle" ? d.answer : d.code),
        recipientHash: kind === "prize" ? emailHash(d.email) : undefined, claimed: false,
      });
      if (kind === "prize") winners.push({ email: normaliseEmail(d.email), amount: amount.toString() });
    }
    const total = records.reduce((s, d) => s + BigInt(d.amount), 0n).toString();
    const c: CampaignRecord = { campaignId, title, creatorName, total, endsAt, onePerWallet: !!onePerWallet, dropIds: records.map((d) => d.dropId), active: false };
    await Promise.all([
      redis.set(`c:${campaignId}`, c),
      ...records.map((d) => redis.set(`d:${d.dropId}`, d)),
      // Winners' emails are kept only until the deposit is confirmed and they've been told.
      winners.length ? redis.set(`notify:${campaignId}`, winners, { ex: 7 * 24 * 3600 }) : null,
    ]);
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
    const all = (await Promise.all(c.dropIds.map(getDrop))).filter(Boolean) as DropRecord[];
    const mapIds = all.filter((d) => d.kind === "map").map((d) => d.dropId);
    await Promise.all([
      redis.set(`c:${c.campaignId}`, c),
      mapIds.length ? redis.sadd("map-drops", mapIds[0], ...mapIds.slice(1)) : null,
      ...all.filter((d) => d.kind === "prize").map((d) => redis.sadd(`prizes:${d.recipientHash}`, d.dropId)),
    ]);
    const winners = await redis.get<{ email: string; amount: string }[]>(`notify:${c.campaignId}`);
    if (winners?.length && mailer) {
      const until = new Date(c.endsAt * 1000).toUTCString();
      await Promise.allSettled(winners.map((w) => sendMail(
        w.email,
        `You won ${usdc(w.amount)} USDC from ${c.creatorName}`,
        `Congratulations! ${c.creatorName} locked ${usdc(w.amount)} USDC for you on Arc (${c.title}).\n\n` +
          `Claim it with this email address: ${APP_URL}/prizes\n\nUnclaimed prizes go back to the organiser on ${until}.`,
      )));
      await redis.del(`notify:${c.campaignId}`);
    }
    return json(await campaignView(c));
  }

  // POST /api/claims  { campaignId, dropId, to, proof }: check the proof, sign the EIP-712 approval.
  if (req.method === "POST" && parts[0] === "claims" && parts.length === 1) {
    const auth = await authoriseClaim(req, body, ip);
    if (auth instanceof Response) return auth;
    return json({ amount: auth.d.amount, deadline: Number(auth.deadline), sig: auth.sig });
  }

  // POST /api/claims/relay  { campaignId, dropId, to, proof }: same checks, then the server submits the claim
  // and pays the gas, so a brand-new winner needs no crypto. The money still only goes to `to`.
  if (req.method === "POST" && parts[0] === "claims" && parts[1] === "relay") {
    if (!relayer) return fail(503, "relay_unavailable", "gas-free claims are not switched on");
    const auth = await authoriseClaim(req, body, ip);
    if (auth instanceof Response) return auth;
    const started = Date.now();
    const hash = await relayer.writeContract({
      address: CONTRACT, abi: claimAbi, functionName: "claim",
      args: [auth.c.campaignId, auth.d.dropId, BigInt(auth.d.amount), auth.to, auth.deadline, auth.sig],
    });
    const receipt = await chain.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") return fail(400, "claim_failed", "the claim transaction reverted");
    await Promise.all([redis.set(`d:${auth.d.dropId}`, { ...auth.d, claimed: true }), redis.srem("map-drops", auth.d.dropId)]);
    return json({ txHash: hash, explorerUrl: `${EXPLORER}/tx/${hash}`, confirmedMs: Date.now() - started });
  }

  // POST /api/auth/email/start  { email }: email a 6-digit code.
  if (req.method === "POST" && parts[0] === "auth" && parts[1] === "email" && parts[2] === "start") {
    if (!isEmail(body.email)) return fail(400, "bad_request", "enter a valid email");
    const h = emailHash(body.email);
    if (await limited(`otp-start:${h}`, 3, 600) || await limited(`otp-ip:${ip}`, 10, 600))
      return fail(429, "rate_limited", "too many codes requested; try again in 10 minutes");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await redis.set(`otp:${h}`, { code: hashSecret(code), tries: 0 }, { ex: 600 });
    await sendMail(normaliseEmail(body.email), `Your Ego code: ${code}`,
      `Your Ego verification code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this email.`);
    return json({ ok: true });
  }

  // POST /api/auth/email/verify  { email, code }: returns a session proving the email is yours.
  if (req.method === "POST" && parts[0] === "auth" && parts[1] === "email" && parts[2] === "verify") {
    if (!isEmail(body.email) || typeof body.code !== "string") return fail(400, "bad_request");
    const h = emailHash(body.email);
    const otp = await redis.get<{ code: string; tries: number }>(`otp:${h}`);
    if (!otp) return fail(400, "code_expired", "that code expired; ask for a new one");
    if (otp.tries >= 5) return fail(429, "rate_limited", "too many wrong codes; ask for a new one");
    if (hashSecret(body.code) !== otp.code) {
      await redis.set(`otp:${h}`, { ...otp, tries: otp.tries + 1 }, { ex: 600 });
      return fail(400, "wrong_code", "that code isn't right");
    }
    await redis.del(`otp:${h}`);
    return json({ session: signSession(h, SESSION_SECRET) });
  }

  // GET /api/prizes  (Authorization: Bearer <session>): prizes waiting for the verified email.
  if (req.method === "GET" && parts[0] === "prizes") {
    const h = verifySession(sessionFrom(req, body), SESSION_SECRET);
    if (!h) return fail(401, "sign_in", "verify your email to see your prizes");
    const ids = await redis.smembers(`prizes:${h}`);
    const out = [];
    for (const id of ids) {
      const d = await getDrop(id);
      const c = d && (await getCampaign(d.campaignId));
      if (d && c?.active) out.push({ ...toPublic(d, c.creatorName, c.endsAt), campaignTitle: c.title });
    }
    return json(out);
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
