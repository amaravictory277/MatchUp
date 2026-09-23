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
    if (search) {
      const result = await searchFootballMatches({
        query: search,
        from: request.nextUrl.searchParams.get("from") || "",
        to: request.nextUrl.searchParams.get("to") || "",
        timezone: request.nextUrl.searchParams.get("timezone") || "UTC",
        page: Number(request.nextUrl.searchParams.get("page") || 1),
      });
      return NextResponse.json(result);
    }
    return NextResponse.json({ matches: await getFeaturedMatches() });
  } catch (error) {
    console.error("[football] match feed request failed", error);
    return NextResponse.json({ matches: [], providerUnavailable: true }, { status: 200 });
  }
}
