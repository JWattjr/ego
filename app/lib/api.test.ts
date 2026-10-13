import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { money, splitAmount, units } from "./format";
import type { CreateCampaignInput } from "./types";
let api: typeof import("./api");
async function finish<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const result = await settled;
  if ("error" in result) throw result.error;
  return result.value;
}
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
  vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "true");
  api = await import("./api");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("six-decimal amounts", () => {
  it("preserves values above floating-point safe precision", () => {
    const value = "9007199254.740993";
    expect(money(units(value))).toBe(value);
  });
  it("splits every base unit without losing remainder", () => {
    const split = splitAmount("5000001", 2);
    expect(split).toEqual(["2500001", "2500000"]);
    expect(split.reduce((a, b) => a + BigInt(b), 0n)).toBe(5000001n);
  });
  it("rejects excess precision and exponential notation", () => {
    expect(() => units("1.0000001")).toThrow();
    expect(() => units("1e6")).toThrow();
  });
});
describe("location privacy and claims", () => {
  it("never returns exact spots without GPS or outside 30 m", async () => {
    const drops = await finish(api.getNearby());
    expect(drops).toHaveLength(3);
    expect(drops.every((d) => !d.exact)).toBe(true);
    const far = await finish(
      api.getDrop(api.DEMO_CAMPAIGN, drops[0].dropId, {
        lat: 6.4584,
        lng: 7.5464,
        accuracyM: 5,
      }),
    );
    expect(far.distanceM).toBeGreaterThan(30);
    expect(far.exact).toBeUndefined();
  });
  it("reveals only the nearby exact spot and rejects inaccurate proof", async () => {
    const [drop] = await finish(api.getNearby());
    const pos = { lat: 6.459, lng: 7.5469, accuracyM: 5 };
    const close = await finish(api.getDrop(drop.campaignId, drop.dropId, pos));
    expect(close.exact).toEqual({ lat: pos.lat, lng: pos.lng });
    await expect(
      finish(
        api.authorizeClaim({
          campaignId: drop.campaignId,
          dropId: drop.dropId,
          to: api.DEMO_WALLET,
          proof: { ...pos, accuracyM: 80 },
        }),
      ),
    ).rejects.toMatchObject({ code: "too_far" });
  });
  it("confirms a claim once, updates wallet and remaining count, and safely retries receipt", async () => {
    const drop = await finish(
      api.getDrop(api.DEMO_ENTRY_CAMPAIGN, api.demoEntryId("code")),
    );
    const before = await finish(api.getWallet());
    const authorization = await finish(
      api.authorizeClaim({
        campaignId: drop.campaignId,
        dropId: drop.dropId,
        to: api.DEMO_WALLET,
        proof: { code: api.DEMO_CODES.code },
      }),
    );
    const txHash = await finish(
      api.submitClaim({
        campaignId: drop.campaignId,
        dropId: drop.dropId,
        to: api.DEMO_WALLET,
        authorization,
      }),
    );
    const receipt = await finish(api.confirmClaim(drop.dropId, txHash));
    expect(await finish(api.confirmClaim(drop.dropId, txHash))).toEqual(
      receipt,
    );
    const after = await finish(api.getWallet());
    expect(BigInt(after.balance) - BigInt(before.balance)).toBe(
      BigInt(drop.amount),
    );
    expect(after.collectibles).toHaveLength(1);
    expect((await finish(api.getCampaign(drop.campaignId))).dropsLeft).toBe(2);
    await expect(
      finish(
        api.authorizeClaim({
          campaignId: drop.campaignId,
          dropId: drop.dropId,
          to: api.DEMO_WALLET,
          proof: { code: api.DEMO_CODES.code },
        }),
      ),
    ).rejects.toMatchObject({ code: "already_claimed" });
  });
  it("does not pay from an invalid proof or missing submission", async () => {
    await expect(
      finish(
        api.authorizeClaim({
          campaignId: api.DEMO_ENTRY_CAMPAIGN,
          dropId: api.demoEntryId("qr"),
          to: api.DEMO_WALLET,
          proof: { code: "WRONG" },
        }),
      ),
    ).rejects.toMatchObject({ code: "wrong_code" });
    await expect(
      finish(api.confirmClaim(api.demoEntryId("qr"), "0xfake")),
    ).rejects.toMatchObject({ code: "not_submitted" });
  });
  it("does not authorize an expired campaign", async () => {
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    await finish(api.getNearby());
    vi.advanceTimersByTime(4 * 86400000);
    await expect(
      finish(
        api.authorizeClaim({
          campaignId: api.DEMO_ENTRY_CAMPAIGN,
          dropId: api.demoEntryId("code"),
          to: api.DEMO_WALLET,
          proof: { code: api.DEMO_CODES.code },
        }),
      ),
    ).rejects.toMatchObject({ code: "campaign_ended" });
  });
  it("hides a reported drop from the nearby list", async () => {
    const [drop] = await finish(api.getNearby());
    await api.reportLocation(drop.dropId);
    expect(
      (await finish(api.getNearby())).some((d) => d.dropId === drop.dropId),
    ).toBe(false);
  });
});
describe("create and integration boundaries", () => {
  const input = (): CreateCampaignInput => ({
    title: "Test adventure",
    creatorName: "Ada",
    endsAt: Math.floor(Date.now() / 1000) + 3600,
    onePerWallet: true,
    drops: [{ kind: "code", amount: "2000000", title: "A gift", code: "GIFT" }],
  });
  it("activates only after deposit confirmation and charges the demo wallet once", async () => {
    const before = await finish(api.getWallet());
    const body = input();
    const deposit = await finish(api.createCampaign(body));
    expect(deposit.total).toBe("2000000");
    await expect(
      finish(api.confirmCampaign(deposit.campaignId, "0xnotpaid")),
    ).rejects.toMatchObject({ code: "not_deposited" });
    const tx = await finish(api.submitDeposit(deposit, body));
    expect(await finish(api.submitDeposit(deposit, body))).toBe(tx);
    const c = await finish(api.confirmCampaign(deposit.campaignId, tx));
    expect(c.drops).toBe(1);
    expect(c.remaining).toBe("2000000");
    expect(
      BigInt(before.balance) - BigInt((await finish(api.getWallet())).balance),
    ).toBe(2000000n);
  });
  it("enforces the 1–5 USDC drop range", async () => {
    const body = input();
    body.drops[0].amount = "999999";
    await expect(finish(api.createCampaign(body))).rejects.toMatchObject({
      code: "invalid_amount",
    });
  });
  it("uses exact server endpoints and error shape when mocks are off", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "false");
    vi.resetModules();
    const real = await import("./api");
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "rate_limited",
        message: "Try again later.",
      }),
    });
    vi.stubGlobal("fetch", fetch);
    await expect(
      real.authorizeClaim({
        campaignId: "campaign",
        dropId: "drop",
        to: api.DEMO_WALLET,
        proof: { code: "ABC" },
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(fetch.mock.calls[0][0]).toBe("/api/claims");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      proof: { code: "ABC" },
    });
    await expect(
      real.sendMoney(api.DEMO_WALLET, "1000000"),
    ).rejects.toMatchObject({ code: "wallet_not_connected" });
  });
});
