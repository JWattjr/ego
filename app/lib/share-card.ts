// Draws a 1080×1350 share image for a find or a prize (Instagram/X portrait size), entirely on-device.
import type { FoundView } from "./types";
import { money } from "./format";

const W = 1080, H = 1350;
const load = (src: string) =>
  new Promise<HTMLImageElement>((ok, bad) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = bad;
    i.src = src;
  });

export async function shareCard(view: FoundView, appUrl: string): Promise<Blob> {
  const prize = view.drop.kind === "prize";
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  await document.fonts.load("700 120px Manrope").catch(() => undefined);

  // Background: Ego's soft blue glow on light grey.
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#f4f7fd");
  bg.addColorStop(1, "#e3eaf5");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 470, 40, W / 2, 470, 520);
  glow.addColorStop(0, "rgba(110,160,255,0.55)");
  glow.addColorStop(1, "rgba(110,160,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  // The 3D coin, with a soft shadow.
  const coin = await load("/coin/front.png");
  g.save();
  g.shadowColor = "rgba(10,50,160,0.35)";
  g.shadowBlur = 60;
  g.shadowOffsetY = 30;
  g.drawImage(coin, W / 2 - 230, 230, 460, 460);
  g.restore();

  const font = (w: number, px: number) => `${w} ${px}px Manrope, "DM Sans", system-ui, sans-serif`;
  g.textAlign = "center";
  g.fillStyle = "#0a1324";
  g.font = font(700, 50);
  g.fillText(prize ? "I just won" : "I just found", W / 2, 820);
  g.font = font(700, 130);
  g.fillText(`${money(view.drop.amount)} USDC`, W / 2, 960);
  g.fillStyle = "#4c5870";
  g.font = font(600, 40);
  g.fillText(`${prize ? "Prize" : "Hidden"} by ${view.drop.creatorName}`, W / 2, 1035);

  // Confirmation pill.
  const pill = `⚡ Confirmed on Arc in ${(view.confirmedMs / 1000).toFixed(1)} s`;
  g.font = font(600, 34);
  const pw = g.measureText(pill).width + 64;
  g.fillStyle = "#e3f6ea";
  g.beginPath();
  g.roundRect(W / 2 - pw / 2, 1080, pw, 72, 36);
  g.fill();
  g.fillStyle = "#12a150";
  g.fillText(pill, W / 2, 1128);

  // Brand + invite.
  g.fillStyle = "#0a1324";
  g.font = font(700, 56);
  g.textAlign = "left";
  g.fillText("ego", 80, 1270);
  g.fillStyle = "#1f6bff";
  g.beginPath();
  g.arc(80 + g.measureText("ego").width + 14, 1258, 9, 0, Math.PI * 2);
  g.fill();
  g.textAlign = "right";
  g.fillStyle = "#4c5870";
  g.font = font(600, 32);
  g.fillText(`Find money near you · ${appUrl.replace(/^https?:\/\//, "")}`, W - 80, 1268);

  return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("Couldn't make the image"))), "image/png"));
}
