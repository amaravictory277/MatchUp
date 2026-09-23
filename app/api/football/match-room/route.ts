import { NextRequest, NextResponse } from "next/server";
import { callSupabaseRpc, getAuthenticatedAccessToken, getMatchById, getServiceRoleConfigured } from "../../../../lib/football/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAuthenticatedAccessToken();
    if (!accessToken) return NextResponse.json({ error: "Sign in to open a Match Room." }, { status: 401 });
    if (!getServiceRoleConfigured()) return NextResponse.json({ error: "Match Room backend is not configured." }, { status: 503 });

    const body = await request.json().catch(() => ({}));
    const fixtureId = String(body?.fixtureId || "").trim();
    if (!fixtureId || !/^\\d{1,20}$/.test(fixtureId)) return NextResponse.json({ error: "Invalid fixture." }, { status: 400 });

    await getMatchById(fixtureId, true);
    const roomId = await callSupabaseRpc<string>(accessToken, "get_or_create_match_room", { p_fixture_id: fixtureId });
    return NextResponse.json({ roomId, fixtureId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open the Match Room.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
