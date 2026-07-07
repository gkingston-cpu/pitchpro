import { NextRequest, NextResponse } from "next/server";
import { runRefresh } from "@/lib/refresh";

export const maxDuration = 300; // connectors + per-firm synthesis can take a while
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // never open in prod
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Vercel Cron (vercel.json) hits this every Monday and Wednesday morning.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await runRefresh();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
