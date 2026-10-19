
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

    // Keep the original ESPN payload available for debugging.
    if (searchParams.get("format") === "raw") {
      return Response.json({ leagueId: LEAGUE_ID, season: SEASON, type, data });
    }

    const teams = Array.isArray(data.teams)
      ? data.teams.map((team) => ({
          id: team.id,
          name: [team.location, team.nickname].filter(Boolean).join(" ") || team.name || `Team ${team.id}`,
          wins: team.record?.overall?.wins ?? null,
          losses: team.record?.overall?.losses ?? null,
          roster: (team.roster?.entries || []).map((entry) => ({
            id: entry.playerId ?? entry.playerPoolEntry?.player?.id,
            name: entry.playerPoolEntry?.player?.fullName ?? null,
            lineupSlotId: entry.lineupSlotId
          }))
        }))
      : [];

    const freeagents = Array.isArray(data.players)
      ? data.players.map((entry) => ({
          id: entry.player?.id ?? entry.id,
          name: entry.player?.fullName ?? entry.fullName ?? null,
          proTeamId: entry.player?.proTeamId ?? null,
          percentOwned: entry.player?.ownership?.percentOwned ?? null
        }))
      : [];

    const transactions = data.transactions || data.transactionCounter || [];

    const result = {
      leagueId: LEAGUE_ID,
      season: SEASON,
      type,
      ...(type === "all" || type === "teams" ? { teams: teams.map(({ roster, ...team }) => team) } : {}),
      ...(type === "all" || type === "rosters" ? { rosters: teams.map(({ id, name, roster }) => ({ teamId: id, teamName: name, players: roster })) } : {}),
      ...(type === "all" || type === "freeagents" ? { freeagents } : {}),
      ...(type === "all" || type === "transactions" ? { transactions } : {})
    };
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: "Could not connect to ESPN" },
      { status: 502 }
    );
  }
}
