
const LEAGUE_ID = "1576190115";
const SEASON = "2027";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";

  const views = {
    teams: ["mTeam"],
    rankings: ["mTeam", "mRoster"],
    rosters: ["mRoster", "mTeam"],
    freeagents: ["kona_player_info"],
    transactions: ["mTransactions2", "mTeam", "mRoster", "kona_player_info"]
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

  if (type === "freeagents" || type === "transactions" || type === "all") {
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
          ties: team.record?.overall?.ties ?? 0,
          pointsFor: team.record?.overall?.pointsFor ?? null,
          standing: team.rankCalculatedFinal ?? team.playoffSeed ?? null,
          roster: (team.roster?.entries || []).map((entry) => ({
            id: entry.playerId ?? entry.playerPoolEntry?.player?.id,
            name: entry.playerPoolEntry?.player?.fullName ?? null,
            lineupSlotId: entry.lineupSlotId,
            stats: entry.playerPoolEntry?.player?.stats || []
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

    const playerNames = new Map();
    for (const entry of data.players || []) {
      const player = entry.player || entry;
      if (player?.id != null && player.fullName) playerNames.set(String(player.id), player.fullName);
    }
    for (const team of data.teams || []) {
      for (const entry of team.roster?.entries || []) {
        const player = entry.playerPoolEntry?.player;
        if (player?.id != null && player.fullName) playerNames.set(String(player.id), player.fullName);
      }
    }
    const teamNames = new Map(teams.map((team) => [String(team.id), team.name]));
    const rawTransactions = Array.isArray(data.transactions) ? data.transactions : [];
    const transactions = rawTransactions
      .filter((transaction) => {
        const actions = transaction.items || [];
        return actions.some((action) => ["ADD", "DROP", "TRADE"].includes(action.type)) ||
          ["TRADE", "WAIVER", "FREEAGENT"].includes(transaction.type);
      })
      .map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        date: transaction.processDate || transaction.executionDate || transaction.proposedDate,
        teamName: teamNames.get(String(transaction.teamId)) || null,
        items: (transaction.items || []).map((action) => ({
          type: action.type,
          playerId: action.playerId,
          playerName: action.player?.fullName || playerNames.get(String(action.playerId)) || null,
          fromTeamName: teamNames.get(String(action.fromTeamId)) || null,
          toTeamName: teamNames.get(String(action.toTeamId)) || null
        }))
      }));

    // ESPN statSourceId: 0 = actual, 1 = projected. Only use ESPN's
    // precomputed fantasy totals when available; never fabricate player ratings.
    function statTotal(player, source) {
      const candidates = (player.stats || [])
        .filter((stat) => stat.statSourceId === source && Number.isFinite(stat.appliedTotal));
      const season = candidates.find((stat) => stat.scoringPeriodId === 0);
      return (season || candidates[0])?.appliedTotal ?? null;
    }
    const rosterScores = teams.map((team) => {
      const players = team.roster || [];
      const projected = players.map((p) => statTotal(p, 1)).filter((v) => v != null);
      const actual = players.map((p) => statTotal(p, 0)).filter((v) => v != null);
      const avg = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return { id: team.id, projected: avg(projected), actual: avg(actual),
        projectedCount: projected.length, actualCount: actual.length };
    });
    const normalized = (value, values) => {
      if (value == null) return null;
      const available = values.filter((v) => v != null);
      if (available.length < 2) return null;
      const low = Math.min(...available), high = Math.max(...available);
      return high === low ? 50 : Math.round(100 * (value - low) / (high - low));
    };
    const ratingById = new Map(rosterScores.map((score) => {
      const projectionRating = normalized(score.projected, rosterScores.map((r) => r.projected));
      const actualRating = normalized(score.actual, rosterScores.map((r) => r.actual));
      const rating = projectionRating != null && actualRating != null
        ? Math.round(0.65 * projectionRating + 0.35 * actualRating)
        : projectionRating ?? actualRating;
      return [score.id, { rating, projectionRating, actualRating,
        ratingSource: projectionRating != null && actualRating != null ? "65% proyección / 35% rendimiento" :
          projectionRating != null ? "Solo proyección" : actualRating != null ? "Solo rendimiento" : "Datos insuficientes" }];
    }));

    const rankings = teams
      .map(({ roster, ...team }) => {
        const played = (team.wins || 0) + (team.losses || 0) + (team.ties || 0);
        return { ...team, ...ratingById.get(team.id), played, winPercentage: played ? ((team.wins || 0) + (team.ties || 0) / 2) / played : null };
      })
      .sort((a, b) => {
        if (a.rating != null && b.rating != null) return b.rating - a.rating || a.name.localeCompare(b.name);
        if (a.rating != null) return -1;
        if (b.rating != null) return 1;
        if (a.winPercentage != null && b.winPercentage != null) {
          return b.winPercentage - a.winPercentage ||
            (b.pointsFor ?? 0) - (a.pointsFor ?? 0) ||
            a.name.localeCompare(b.name);
        }
        if (a.winPercentage != null) return -1;
        if (b.winPercentage != null) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((team, index) => ({ ...team, rank: index + 1 }));
    const rankingsProvisional = rankings.every((team) => team.rating == null && team.played === 0);

    const result = {
      leagueId: LEAGUE_ID,
      season: SEASON,
      type,
      ...(type === "all" || type === "rankings" ? { rankings, rankingsProvisional } : {}),
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
