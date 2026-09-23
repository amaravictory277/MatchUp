import { NextRequest, NextResponse } from "next/server";
import { getFeaturedMatches, getMatchById, searchMatches } from "../../../../lib/football/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const fixture = request.nextUrl.searchParams.get("fixture");
    const search = request.nextUrl.searchParams.get("search");
    const force = request.nextUrl.searchParams.get("refresh") === "1";
    if (fixture) return NextResponse.json({ matches: [await getMatchById(fixture, force)] });
    if (search) return NextResponse.json({ matches: await searchMatches(search) });
    return NextResponse.json({ matches: await getFeaturedMatches() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load football matches.";
    return NextResponse.json({ error: message, matches: [] }, { status: 503 });
  }
}
