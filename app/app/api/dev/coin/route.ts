// Dev-only: saves a rendered coin PNG into public/coin/. Refuses to run outside development.
import { writeFile } from "node:fs/promises";
import path from "node:path";
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("not found", { status: 404 });
  const { name, data } = (await req.json()) as { name: string; data: string };
  if (!/^[a-z-]+$/.test(name) || !data.startsWith("data:image/png;base64,")) return new Response("bad", { status: 400 });
  await writeFile(path.join(process.cwd(), "public", "coin", `${name}.png`), Buffer.from(data.split(",")[1], "base64"));
  return Response.json({ ok: true });
}
