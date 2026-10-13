import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProof, distanceM, emailHash, fuzzedCentre, hashSecret, isEmail, signSession, toPublic, verifySession, type DropRecord } from "./core.ts";

const base = { campaignId: "0x01", dropId: "0xabc", amount: "1000000", title: "t", claimed: false } as const;
const mapDrop: DropRecord = { ...base, kind: "map", lat: 6.4584, lng: 7.5464 };

test("distance is about right", () => {
  const d = distanceM(6.4584, 7.5464, 6.4584 + 0.0009, 7.5464); // ~100 m north
  assert.ok(d > 95 && d < 105, String(d));
});

test("map claim: within 30 m passes, farther or poor accuracy fails", () => {
  assert.equal(checkProof(mapDrop, { lat: 6.4585, lng: 7.5464, accuracyM: 10 }), null); // ~11 m
  assert.equal(checkProof(mapDrop, { lat: 6.4590, lng: 7.5464, accuracyM: 10 }), "too_far"); // ~67 m
  assert.equal(checkProof(mapDrop, { lat: 6.4584, lng: 7.5464, accuracyM: 500 }), "too_far");
  assert.equal(checkProof(mapDrop, { code: "x" }), "bad_proof");
});

test("code and puzzle: normalised match only", () => {
  const code: DropRecord = { ...base, kind: "code", secretHash: hashSecret("EGO-ENUGU") };
  assert.equal(checkProof(code, { code: "  ego-enugu " }), null);
  assert.equal(checkProof(code, { code: "ego-enug" }), "wrong_code");
  const puzzle: DropRecord = { ...base, kind: "puzzle", secretHash: hashSecret("Coal Camp") };
  assert.equal(checkProof(puzzle, { answer: "coal   camp" }), null);
  assert.equal(checkProof(puzzle, { code: "coal camp" }), "bad_proof"); // answer field required
});

test("fuzzed circle always contains the true spot and is stable", () => {
  for (let i = 0; i < 200; i++) {
    const d = { ...mapDrop, dropId: `0x${i.toString(16)}` as `0x${string}` };
    const c = fuzzedCentre(d);
    assert.ok(distanceM(c.lat, c.lng, d.lat!, d.lng!) < c.radiusM);
    assert.deepEqual(c, fuzzedCentre(d));
  }
});

test("public view never leaks secrets or the exact spot from afar", () => {
  const far = toPublic({ ...mapDrop, secretHash: "s" }, "Ada", 0, { lat: 6.47, lng: 7.55 });
  assert.equal(far.exact, undefined);
  assert.equal((far as any).secretHash, undefined);
  assert.equal((far as any).lat, undefined);
  const near = toPublic(mapDrop, "Ada", 0, { lat: 6.4585, lng: 7.5464 });
  assert.deepEqual(near.exact, { lat: 6.4584, lng: 7.5464 });
});

test("prize drops: only the verified winner's email passes", () => {
  const prize: DropRecord = { ...base, kind: "prize", recipientHash: emailHash("Winner@Example.com ") };
  assert.equal(checkProof(prize, {}, emailHash("winner@example.com")), null);
  assert.equal(checkProof(prize, {}, emailHash("someone@else.com")), "not_your_prize");
  assert.equal(checkProof(prize, { code: "x" }), "bad_proof"); // no verified session
});

test("email sessions: valid, tampered, expired, wrong secret", () => {
  const h = emailHash("a@b.co"), t = signSession(h, "s3cret", 60, 1_000_000);
  assert.equal(verifySession(t, "s3cret", 1_000_000), h);
  assert.equal(verifySession(t, "other", 1_000_000), null);
  assert.equal(verifySession(t.replace(/.$/, (c) => (c === "0" ? "1" : "0")), "s3cret", 1_000_000), null);
  const forged = `${emailHash("x@y.co")}.${t.split(".")[1]}.${t.split(".")[2]}`;
  assert.equal(verifySession(forged, "s3cret", 1_000_000), null);
  assert.equal(verifySession(t, "s3cret", 1_000_000 + 61_000), null);
  assert.ok(isEmail("a@b.co") && !isEmail("nope") && !isEmail("a @b.co"));
});
