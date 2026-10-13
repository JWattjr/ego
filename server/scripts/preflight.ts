// Prints only public info: chain, USDC token facts, deployer address and balances. Never prints keys.
import { createPublicClient, http, formatUnits, parseAbi, type Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { readFileSync, writeFileSync } from "node:fs";

const USDC = "0x3600000000000000000000000000000000000000";
const pk = process.env.DEPLOYER_PRIVATE_KEY as Hex;
if (!/^0x[0-9a-fA-F]{64}$/.test(pk ?? "")) throw new Error("DEPLOYER_PRIVATE_KEY missing or not 0x + 64 hex chars");
const client = createPublicClient({ transport: http(process.env.RPC_URL) });
const erc20 = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)"]);
const me = privateKeyToAccount(pk).address;
console.log("chainId", await client.getChainId(), "(expected", process.env.CHAIN_ID + ")");
console.log("USDC", await client.readContract({ address: USDC, abi: erc20, functionName: "symbol" }), "decimals", await client.readContract({ address: USDC, abi: erc20, functionName: "decimals" }));
console.log("deployer", me);
console.log("USDC balance", formatUnits(await client.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [me] }), 6));
console.log("native gas balance (18 dp)", formatUnits(await client.getBalance({ address: me }), 18));

if (!process.env.SIGNER_PRIVATE_KEY) {
  const key = generatePrivateKey();
  const f = ".env.local";
  writeFileSync(f, readFileSync(f, "utf8").replace(/^SIGNER_PRIVATE_KEY=.*$/m, `SIGNER_PRIVATE_KEY=${key}`));
  console.log("signer generated:", privateKeyToAccount(key).address);
} else console.log("signer:", privateKeyToAccount(process.env.SIGNER_PRIVATE_KEY as Hex).address);
