
const LEAGUE_ID = "1576190115";
const SEASON = "2027";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";

  const views = {
    teams: ["mTeam"],
    rosters: ["mRoster", "mTeam"],
    freeagents: ["kona_player_info"],
    transactions: ["mTransactions2"]
  };

  if (type !== "all" && !views[type]) {
    return Response.json(
      { error: "Invalid type" },
      { status: 400 }
    );
  }

  const selectedViews =
    type === "all"
      ? [...new Set(Object.values(views).flat())]
      : views[type];

  const url = new URL(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${SEASON}/segments/0/leagues/${LEAGUE_ID}`
  );

  for (const view of selectedViews) {
    url.searchParams.append("view", view);
  }

  if (type === "freeagents" || type === "all") {
    url.searchParams.append("scoringPeriodId", "1");
  }

  const cookies = [];

  if (process.env.ESPN_S2) {
    cookies.push(`espn_s2=${process.env.ESPN_S2}`);
  }

  if (process.env.ESPN_SWID) {
    cookies.push(`SWID=${process.env.ESPN_SWID}`);
  }

  try {
    const headers = {
      Accept: "application/json"
    };

    if (cookies.length) {
      headers.Cookie = cookies.join("; ");
    }

    const response = await fetch(url, {
      headers,
      cache: "no-store"
    });

    if (!response.ok) {
      return Response.json(
        {
          error: "ESPN request failed",
          espnStatus: response.status,
          needsCredentials:
            response.status === 401 ||
            response.status === 403
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return Response.json({
      leagueId: LEAGUE_ID,
      season: SEASON,
      type,
      data
    });
  } catch (error) {
    return Response.json(
      { error: "Could not connect to ESPN" },
      { status: 502 }
    );
  }
}
