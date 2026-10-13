// Deploys EgoDrops from the audited artifact. Owner = deployer; signer = SIGNER_PRIVATE_KEY's address.
import { createPublicClient, createWalletClient, http, defineChain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "node:fs";

const arc = defineChain({ id: Number(process.env.CHAIN_ID), name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [process.env.RPC_URL!] } } });
const art = JSON.parse(readFileSync("../contracts/studio/contracts/out/EgoDrops.sol/EgoDrops.json", "utf8"));
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const signer = privateKeyToAccount(process.env.SIGNER_PRIVATE_KEY as Hex).address;
const pub = createPublicClient({ chain: arc, transport: http() });
const wallet = createWalletClient({ chain: arc, account, transport: http() });

const hash = await wallet.deployContract({ abi: art.abi, bytecode: art.bytecode.object, args: ["0x3600000000000000000000000000000000000000", signer, "https://ego.app/collectible/{id}.json"] });
console.log("tx", hash);
const r = await pub.waitForTransactionReceipt({ hash });
console.log("status", r.status, "contract", r.contractAddress, "block", r.blockNumber);
const f = ".env.local";
writeFileSync(f, readFileSync(f, "utf8").replace(/^CONTRACT_ADDRESS=.*$/m, `CONTRACT_ADDRESS=${r.contractAddress}`));
const abi = art.abi;
for (const fn of ["owner", "signer", "usdc"]) console.log(fn, await pub.readContract({ address: r.contractAddress!, abi, functionName: fn }));
