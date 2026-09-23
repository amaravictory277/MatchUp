import { NextRequest, NextResponse } from "next/server";
import { callSupabaseRpc, getAuthenticatedAccessToken, getMatchById, getServiceRoleConfigured } from "../../../../lib/football/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAuthenticatedAccessToken();
    if (!accessToken) return NextResponse.json({ error: "Sign in to open a Match Room." }, { status: 401 });
    if (!getServiceRoleConfigured()) {
      console.error("[football] Match Room backend is not configured.");
      return NextResponse.json({ error: "Could not open the Match Room right now." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const fixtureId = String(body?.fixtureId || "").trim();
    if (!fixtureId || !/^\d{1,20}$/.test(fixtureId)) return NextResponse.json({ error: "Invalid fixture." }, { status: 400 });

    await getMatchById(fixtureId, true);
    const roomId = await callSupabaseRpc<string>(accessToken, "get_or_create_match_room", { p_fixture_id: fixtureId });
    return NextResponse.json({ roomId, fixtureId });
  } catch (error) {
    console.error("[football] Match Room request failed", error);
    return NextResponse.json({ error: "Could not open the Match Room right now." }, { status: 500 });
  }
}
