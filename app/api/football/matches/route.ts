import { NextRequest, NextResponse } from "next/server";
import { getFeaturedMatches, getMatchById } from "../../../../lib/football/server";
import { searchFootballMatches } from "../../../../lib/football/search-provider";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const fixture = request.nextUrl.searchParams.get("fixture");
  const search = request.nextUrl.searchParams.get("search");
  const force = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    if (fixture) return NextResponse.json({ matches: [await getMatchById(fixture, force)] });
    if (search) return NextResponse.json({ matches: await searchFootballMatches(search) });
    return NextResponse.json({ matches: await getFeaturedMatches() });
  } catch (error) {
    // Keep provider details in server logs for the founder/developer. Never expose
    // API keys, provider configuration, or infrastructure details to users.
    console.error("[football] match feed request failed", error);
    return NextResponse.json({ matches: [], providerUnavailable: true }, { status: 200 });
  }
}
