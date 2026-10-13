"use client";
// Live-mode wallet: an injected browser wallet (MetaMask, Rabby, Coinbase…) on Arc mainnet, via viem.
import { createPublicClient, createWalletClient, custom, defineChain, http, parseAbi, type EIP1193Provider, type Hex } from "viem";

export const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 5042);
const RPC = process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.mainnet.arc.io";
export const EXPLORER = (process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explorer.arc.io").replace(/\/$/, "");
export const EGO_DROPS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "0x141291cf2992a3ad4069d04a0702de78b68524b7") as Hex;
export const USDC = "0x3600000000000000000000000000000000000000" as Hex; // ERC-20 interface, 6 decimals

export const arc = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Arc Explorer", url: EXPLORER } },
});
const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);
const drops = parseAbi([
  "function createCampaign(bytes32 campaignId, uint128 amount, uint64 endsAt, bool onePerWallet)",
  "function refund(bytes32 campaignId)",
  "function campaigns(bytes32) view returns (address creator, uint128 deposited, uint128 claimed, uint64 endsAt, bool onePerWallet, bool refunded)",
]);

export const publicClient = createPublicClient({ chain: arc, transport: http(RPC) });

export class WalletError extends Error {
  constructor(message: string, public code = "wallet") {
    super(message);
  }
}
function provider(): EIP1193Provider {
  const eth = typeof window !== "undefined" ? (window as unknown as { ethereum?: EIP1193Provider }).ethereum : undefined;
  if (!eth) throw new WalletError("No wallet found. Open Ego in a wallet browser (MetaMask, Rabby, Coinbase Wallet) or install a wallet extension.", "wallet_not_connected");
  return eth;
}

// Address of an already-connected wallet, without prompting.
export async function currentAddress(): Promise<Hex | null> {
  try {
    const [a] = (await provider().request({ method: "eth_accounts" })) as Hex[];
    return a ?? null;
  } catch {
    return null;
  }
}

async function ensureArc(eth: EIP1193Provider) {
  const hex = `0x${ARC_CHAIN_ID.toString(16)}` as Hex;
  if ((await eth.request({ method: "eth_chainId" })) === hex) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e; // 4902: the wallet doesn't know Arc yet
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: hex, chainName: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: [EXPLORER] }],
    });
  }
}

export async function connectWallet(): Promise<Hex> {
  const eth = provider();
  const [a] = (await eth.request({ method: "eth_requestAccounts" })) as Hex[];
  if (!a) throw new WalletError("No account was shared. Try connecting again.");
  await ensureArc(eth);
  return a;
}

async function signer() {
  const eth = provider();
  const account = await connectWallet();
  return createWalletClient({ account, chain: arc, transport: custom(eth) });
}

async function wait(hash: Hex) {
  const r = await publicClient.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new WalletError("The transaction failed on Arc. Nothing was moved.");
  return hash;
}

export const usdcBalance = (address: Hex) => publicClient.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [address] });

// Fund a campaign: approve exactly the total (only if needed), then lock it in EgoDrops.
export async function fundCampaign(campaignId: Hex, total: bigint, endsAt: number, onePerWallet: boolean): Promise<Hex> {
  const w = await signer();
  const owner = w.account.address;
  if ((await usdcBalance(owner)) < total) throw new WalletError("Your wallet doesn't have enough USDC on Arc for this.", "insufficient_balance");
  const allowance = await publicClient.readContract({ address: USDC, abi: erc20, functionName: "allowance", args: [owner, EGO_DROPS] });
  if (allowance < total) await wait(await w.writeContract({ address: USDC, abi: erc20, functionName: "approve", args: [EGO_DROPS, total] }));
  return wait(await w.writeContract({ address: EGO_DROPS, abi: drops, functionName: "createCampaign", args: [campaignId, total, BigInt(endsAt), onePerWallet] }));
}

export async function transferUsdc(to: Hex, amount: bigint): Promise<Hex> {
  const w = await signer();
  return wait(await w.writeContract({ address: USDC, abi: erc20, functionName: "transfer", args: [to, amount] }));
}

export async function refundCampaign(campaignId: Hex): Promise<Hex> {
  const w = await signer();
  return wait(await w.writeContract({ address: EGO_DROPS, abi: drops, functionName: "refund", args: [campaignId] }));
}

export async function campaignOnChain(campaignId: Hex) {
  const [creator, deposited, claimed, endsAt, , refunded] = await publicClient.readContract({ address: EGO_DROPS, abi: drops, functionName: "campaigns", args: [campaignId] });
  return { creator, deposited, claimed, endsAt: Number(endsAt), refunded };
}
