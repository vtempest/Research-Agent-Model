/**
 * @fileoverview Reports the city the current request geolocates to, so
 * Settings can show which location the app is inferring from your IP (the
 * same location the homepage weather widget auto-detects).
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveClientLocation } from "@/lib/cloudflare/ip-geolocation";

export async function GET(req: NextRequest) {
  try {
    const location = await resolveClientLocation(req.headers);
    return NextResponse.json(location, {
      // Per-viewer answer; keep it briefly warm but never on a shared cache.
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    console.error("Error resolving client location:", error);
    return NextResponse.json(
      { message: "Failed to resolve location." },
      { status: 500 }
    );
  }
}
