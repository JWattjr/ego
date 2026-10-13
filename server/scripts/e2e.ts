// Real mainnet run: create a 0.5 USDC campaign, sign a claim like the server does, claim it, time it.
import { createPublicClient, createWalletClient, http, defineChain, parseAbi, toHex, formatUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const arc = defineChain({ id: Number(process.env.CHAIN_ID), name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [process.env.RPC_URL!] } } });
const abi = JSON.parse(readFileSync("../contracts/studio/contracts/out/EgoDrops.sol/EgoDrops.json", "utf8")).abi;
const USDC = "0x3600000000000000000000000000000000000000";
const erc20 = parseAbi(["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
const C = process.env.CONTRACT_ADDRESS as Hex;
const me = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const signer = privateKeyToAccount(process.env.SIGNER_PRIVATE_KEY as Hex);
const pub = createPublicClient({ chain: arc, transport: http() });
const wallet = createWalletClient({ chain: arc, account: me, transport: http() });
const send = async (label: string, p: Promise<Hex>) => { const h = await p; const r = await pub.waitForTransactionReceipt({ hash: h }); console.log(label, r.status, h); return r; };

const amount = 500_000n, campaignId = toHex(randomBytes(32)), dropId = toHex(randomBytes(32));
const endsAt = BigInt(Math.floor(Date.now() / 1000) + 86400);
const before = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [me.address] });

await send("approve", wallet.writeContract({ address: USDC, abi: erc20, functionName: "approve", args: [C, amount] }));
await send("createCampaign", wallet.writeContract({ address: C, abi, functionName: "createCampaign", args: [campaignId, amount, endsAt, true] }));

const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
const sig = await signer.signTypedData({
  domain: { name: "EgoDrops", version: "1", chainId: arc.id, verifyingContract: C },
  types: { Claim: [{ name: "campaignId", type: "bytes32" }, { name: "dropId", type: "bytes32" }, { name: "amount", type: "uint128" }, { name: "to", type: "address" }, { name: "deadline", type: "uint64" }] },
  primaryType: "Claim", message: { campaignId, dropId, amount, to: me.address, deadline },
});
const t0 = performance.now();
const r = await send("claim", wallet.writeContract({ address: C, abi, functionName: "claim", args: [campaignId, dropId, amount, me.address, deadline, sig] }));
console.log(`confirmed in ${((performance.now() - t0) / 1000).toFixed(2)} s (send -> receipt, from Lagos)`);

try { await wallet.writeContract({ address: C, abi, functionName: "claim", args: [campaignId, dropId, amount, me.address, deadline, sig] }); console.log("REPLAY SUCCEEDED - BAD"); }
catch (e: any) { console.log("replay rejected:", e.shortMessage?.split("\n")[0] ?? "reverted"); }

const after = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [me.address] });
console.log("collectible balance", await pub.readContract({ address: C, abi, functionName: "balanceOf", args: [me.address, BigInt(campaignId)] }));
console.log("USDC net change", formatUnits(after - before, 6), "| campaign", campaignId, "| explorer", `${process.env.EXPLORER_URL}/tx/${r.transactionHash}`);
