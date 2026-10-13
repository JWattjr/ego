export const ENUGU = { lat: 6.4584, lng: 7.5464 };
export function units(value: string): string {
  if (!/^\d+(\.\d{0,6})?$/.test(value))
    throw new Error("Enter a USDC amount with up to six decimal places.");
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * 1000000n +
    BigInt(fraction.padEnd(6, "0"))
  ).toString();
}
export function money(base: string): string {
  const n = BigInt(base);
  const whole = (n / 1000000n).toString();
  const fraction = (n % 1000000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
export function distance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const r = Math.PI / 180;
  const s =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
export function bearing(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const r = Math.PI / 180,
    dl = (b.lng - a.lng) * r;
  return (
    ((Math.atan2(
      Math.sin(dl) * Math.cos(b.lat * r),
      Math.cos(a.lat * r) * Math.sin(b.lat * r) -
        Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(dl),
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
export function splitAmount(total: string, count: number): string[] {
  const n = BigInt(total),
    divisor = BigInt(count),
    each = n / divisor,
    rest = n % divisor;
  return Array.from({ length: count }, (_, i) =>
    (each + (BigInt(i) < rest ? 1n : 0n)).toString(),
  );
}
