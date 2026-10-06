import { NextResponse } from "next/server";
import { z } from "zod";
import cachedFile from "@/data/results.cached.json";
import { loadEmails, pastedToEmail, runPipeline } from "@/lib/pipeline";
import { refreshDeadlines } from "@/lib/score";
import type { ScanResult } from "@/lib/types";

// Vercel must not cut the scan off before our own 20 s fallback fires.
export const maxDuration = 30;

const SCAN_TIMEOUT_MS = 20_000;

const BodySchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("sample") }),
  z.object({ source: z.literal("real") }),
  z.object({
    source: z.literal("paste"),
    email: z.object({
      from: z.string().max(300),
      subject: z.string().max(500),
      date: z.string().max(100),
      body: z.string().min(1).max(20_000),
    }),
  }),
]);
type Body = z.infer<typeof BodySchema>;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("Scan timed out")), ms));
}

function cachedSample(): ScanResult {
  const cached = cachedFile as unknown as ScanResult;
  return { ...refreshDeadlines(cached, new Date()), mode: "cached" };
}

async function scan(body: Body): Promise<ScanResult> {
  const emails = body.source === "paste" ? [pastedToEmail(body.email)] : loadEmails(body.source);
  const { result } = await runPipeline(emails, body.source);
  return result;
}

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    return NextResponse.json(await Promise.race([scan(parsed.data), timeout(SCAN_TIMEOUT_MS)]));
  } catch (err) {
    console.error("Scan failed:", err instanceof Error ? err.message : err);
    // The saved run is the sample inbox, so it is only a valid fallback for that source.
    if (parsed.data.source === "sample") return NextResponse.json(cachedSample());
    return NextResponse.json({ error: "Scan unavailable, please try again" }, { status: 503 });
  }
}
