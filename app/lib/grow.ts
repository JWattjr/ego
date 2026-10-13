// Wallet "Investments": what each product is, where it runs on Arc, and its risk in plain words.
// UI first: amounts and rates are demo values until each integration is switched on.
export type GrowKey = "lending" | "pools" | "vaults";
export type GrowProduct = {
  key: GrowKey;
  title: string;
  short: string;
  venue: string;
  demoBalance: string; // USDC base units, demo mode only
  demoRate: string;
  how: string;
  risk: string;
};

export const GROW: GrowProduct[] = [
  {
    key: "lending",
    title: "Lending",
    short: "Lend USDC to borrowers and earn interest",
    venue: "Aave on Arc",
    demoBalance: "360000",
    demoRate: "3.1% APY",
    how: "Your USDC goes into a lending market. Borrowers pay interest, and you can withdraw any time the market has cash available.",
    risk: "Rates change with demand. Smart-contract and borrower-default risk apply. Not a bank account.",
  },
  {
    key: "pools",
    title: "Liquidity pools",
    short: "Earn swap fees on USDC ⇄ EURC",
    venue: "Uniswap on Arc",
    demoBalance: "4820000",
    demoRate: "Fees vary",
    how: "You add USDC and EURC to a pool. Every swap through it pays you a small share of the fee.",
    risk: "If the USDC/EURC rate moves, you can end up with less than you put in (impermanent loss). For experienced users.",
  },
  {
    key: "vaults",
    title: "Vaults",
    short: "Hands-off yield, managed by a curator",
    venue: "Morpho via Circle Earn Kit",
    demoBalance: "6320000",
    demoRate: "4.8% APY",
    how: "A vault spreads your USDC across vetted lending markets and rebalances for you. Deposit and withdraw in one tap.",
    risk: "Earnings vary. Your USDC is lent to over-collateralised borrowers through Morpho. Smart-contract risk applies.",
  },
];
export const growByKey = (k: string) => GROW.find((g) => g.key === k);
