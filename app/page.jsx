"use client";

import { useEffect, useState } from "react";

const sections = [
  ["teams", "Equipos"],
  ["rankings", "🏆 Power Rankings"],
  ["rosters", "Plantillas"],
  ["freeagents", "Agentes libres"],
  ["transactions", "Transacciones"]
];

function TransactionDetails({ item }) {
  const actions = Array.isArray(item.items) ? item.items : [];
  const time = item.processDate || item.executionDate || item.proposedDate || item.date;
  const date = typeof time === "number" && time > 1000000000
    ? new Date(time < 10000000000 ? time * 1000 : time).toLocaleDateString("es-MX")
    : null;
  const type = String(item.type || item.transactionType || "Movimiento").replace(/_/g, " ");
  return (
    <div style={{ color: "#d4d4d8" }}>
      <p style={{ margin: "4px 0 12px", textTransform: "capitalize", color: "#c4b5fd" }}>{type}{date ? " · " + date : ""}{item.teamName ? " · " + item.teamName : ""}</p>
      {actions.length > 0 ? (
        <ul style={{ paddingLeft: 20 }}>
          {actions.map((action, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              {action.type === "ADD" ? "➕ Agregó" : action.type === "DROP" ? "➖ Soltó" : action.type || "Movimiento"}
              {" · "}
              {action.player?.fullName || action.playerName || (action.playerId ? "Jugador #" + action.playerId : "Jugador sin nombre")}
              {action.toTeamName ? " · A: " + action.toTeamName : ""}{action.fromTeamName ? " · De: " + action.fromTeamName : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: "#a1a1aa" }}>ESPN no proporcionó detalles de jugadores para este movimiento.</p>
      )}
    </div>
  );
}

export default function Home() {
  const [section, setSection] = useState("teams");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    fetch("/api/league?type=" + section, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "No se pudo cargar ESPN");
        return body;
      })
      .then((body) => { if (active) setData(body); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section]);

  const items = data?.[section] ?? [];
  const list = Array.isArray(items) ? items : [];

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px", fontFamily: "Arial, sans-serif" }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ color: "#818cf8", fontWeight: 700, letterSpacing: 3 }}>LB FANTASY BOT</div>
        <h1 style={{ fontSize: "clamp(30px, 6vw, 52px)", margin: "12px 0" }}>Tu liga, en un solo lugar 🏀</h1>
        <p style={{ color: "#a1a1aa" }}>ESPN Fantasy Basketball · Temporada 2026–27 · Liga 1576190115</p>
      </header>
      <nav aria-label="Secciones de la liga" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
        {sections.map(([key, title]) => (
          <button key={key} onClick={() => setSection(key)} aria-pressed={section === key}
            style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid #404052", cursor: "pointer", background: section === key ? "#6366f1" : "#232333", color: "white", fontWeight: 700 }}>
            {title}
          </button>
        ))}
      </nav>
      {loading && <p role="status">Cargando datos de ESPN...</p>}
      {error && <p role="alert" style={{ color: "#fca5a5" }}>Error: {error}. <a style={{ color: "#c4b5fd" }} href="/api/league?format=raw">Ver datos originales</a></p>}
      {!loading && !error && (
        <>
          <p style={{ color: "#a1a1aa" }}>{list.length} registros encontrados</p>
          {section === "rankings" && <p style={{ color: "#c4b5fd" }}>{data?.rankingsProvisional ? "Clasificación provisional: todavía no hay resultados. Los equipos se muestran en orden alfabético, no por fuerza." : "Ranking basado en resultados de ESPN (no predicción de talento)."}</p>}
          {list.length === 0 && <p>ESPN no devolvió registros para esta sección todavía.</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
            {list.map((item, i) => (
              <article key={item.id ?? item.teamId ?? i} style={{ background: "#1d1d2b", border: "1px solid #343449", padding: 20, borderRadius: 18 }}>
                <h2 style={{ fontSize: 19, marginTop: 0 }}>{(section === "rankings" ? "#" + item.rank + " · " + item.name : item.name) || item.teamName || item.player?.fullName || (section === "transactions" ? "Movimiento " + (i + 1) : "Registro " + (i + 1))}</h2>
                {section === "rankings" && <p style={{ color: "#a1a1aa" }}>{item.played ? "Récord: " + item.wins + "-" + item.losses + " · Victorias: " + (item.winPercentage * 100).toFixed(1) + "%" : "Sin partidos disputados"}{item.pointsFor != null ? " · Puntos: " + item.pointsFor : ""}</p>}
                {section === "teams" && <p style={{ color: "#a1a1aa" }}>Victorias: {item.wins ?? "—"} · Derrotas: {item.losses ?? "—"}</p>}
                {section === "rosters" && <ul style={{ paddingLeft: 20, color: "#d4d4d8" }}>{(item.players || []).map((p, j) => <li key={p.id ?? j}>{p.name || "Jugador " + (p.id ?? j + 1)}</li>)}</ul>}
                {section === "freeagents" && <p style={{ color: "#a1a1aa" }}>Rostered: {item.percentOwned == null ? "—" : item.percentOwned.toFixed(1) + "%"}</p>}
                {section === "transactions" && <TransactionDetails item={item} />}
              </article>
            ))}
          </div>
        </>
      )}
      <footer style={{ marginTop: 40, color: "#71717a", fontSize: 13 }}>
        Datos proporcionados por ESPN. <a href="/api/league" style={{ color: "#a5b4fc" }}>Abrir API JSON</a>
      </footer>
    </main>
  );
}
