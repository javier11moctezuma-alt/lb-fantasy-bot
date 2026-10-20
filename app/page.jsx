"use client";

import { useEffect, useState } from "react";
import LeagueChat from "./LeagueChat";

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
    <main className="dashboard">
      <header className="hero">
        <div className="hero-top"><span className="brand-mark">LB<span>★</span></span><span className="live-tag"><span className="live-dot" /> ESPN CONNECTED</span></div>
        <div className="eyebrow">THE LEAGUE HUB <span> / 2026–27 SEASON</span></div>
        <h1>Tu liga.<br/><em>Tu legado.</em></h1>
        <p>Estadísticas, movimientos y análisis de tu Fantasy Basketball. Todo en un solo lugar.</p>
        <div className="hero-meta"><span>🏀 ESPN FANTASY</span><span>● TEMPORADA 2026–27</span><span>🏆 11 EQUIPOS</span></div>
        <div className="hero-ball" aria-hidden="true">🏀</div>
      </header>
      <LeagueChat />
      <nav className="tabs" aria-label="Secciones de la liga">
        {sections.map(([key, title]) => (
          <button className={"tab " + (section === key ? "selected" : "")} key={key} onClick={() => setSection(key)} aria-pressed={section === key}>
            {title}
          </button>
        ))}
      </nav>
      {loading && <div className="state-message" role="status">⏳ Sincronizando con ESPN...</div>}
      {error && <p role="alert" style={{ color: "#fca5a5" }}>Error: {error}. <a style={{ color: "#c4b5fd" }} href="/api/league?format=raw">Ver datos originales</a></p>}
      {!loading && !error && (
        <>
          <div className="section-heading"><div><span className="section-kicker">LEAGUE DATA</span><h2>{sections.find(([key]) => key === section)?.[1]}</h2></div><span className="count-pill">{list.length} REGISTROS</span></div>
          {section === "rankings" && <p style={{ color: "#c4b5fd" }}>{data?.rankingsProvisional ? "Clasificación provisional: todavía no hay resultados ni calificaciones suficientes." : "Power Rating basado en proyecciones (65%) y rendimiento (35%) cuando ESPN ofrece ambos; de lo contrario, se usan los datos disponibles."}</p>}
          {list.length === 0 && <p>ESPN no devolvió registros para esta sección todavía.</p>}
          <div className="data-grid">
            {list.map((item, i) => (
              <article className="data-card" key={item.id ?? item.teamId ?? i}><div className="card-top"><span className="card-number">{String(i + 1).padStart(2, "0")}</span><span className="card-label">{section === "teams" ? "FRANCHISE" : section === "rankings" ? "POWER INDEX" : section === "rosters" ? "ROSTER" : section === "freeagents" ? "FREE AGENT" : "LEAGUE MOVE"}</span></div>
                <h3 className="card-title">{(section === "rankings" ? (item.rank != null ? "#" + item.rank + " · " : "") + item.name : item.name) || item.teamName || item.player?.fullName || (section === "transactions" ? "Movimiento " + (i + 1) : "Registro " + (i + 1))}</h3>
                {section === "rankings" && <>{item.rating != null && <p style={{ fontSize: 28, fontWeight: 800, color: "#a5b4fc", margin: "6px 0" }}>{item.rating}/100 <span style={{ fontSize: 12, fontWeight: 400, color: "#a1a1aa" }}>Power Rating relativo</span></p>}<p style={{ color: "#a1a1aa", fontSize: 12 }}>{(item.ratingSource || "Datos insuficientes")}</p><p style={{ color: "#a1a1aa" }}>{item.played ? "Récord: " + item.wins + "-" + item.losses + " · Victorias: " + (item.winPercentage * 100).toFixed(1) + "%" : "Sin partidos disputados"}{item.pointsFor != null ? " · Puntos: " + item.pointsFor : ""}</p></>}
                {section === "teams" && <p style={{ color: "#a1a1aa" }}>Victorias: {item.wins ?? "—"} · Derrotas: {item.losses ?? "—"}</p>}
                {section === "rosters" && <ul style={{ paddingLeft: 20, color: "#d4d4d8" }}>{(item.players || []).map((p, j) => <li key={p.id ?? j}>{p.name || "Jugador " + (p.id ?? j + 1)}</li>)}</ul>}
                {section === "freeagents" && <p style={{ color: "#a1a1aa" }}>Rostered: {item.percentOwned == null ? "—" : item.percentOwned.toFixed(1) + "%"}</p>}
                {section === "transactions" && <TransactionDetails item={item} />}
              </article>
            ))}
          </div>
        </>
      )}
      <footer className="footer">
        Datos proporcionados por ESPN. <a href="/api/league" style={{ color: "#a5b4fc" }}>Abrir API JSON</a>
      </footer>
    <style jsx global>{`
:root{color-scheme:dark}*{box-sizing:border-box}html{scroll-behavior:smooth}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;background:#080b12!important;color:#f8fafc!important}button,input{font:inherit}button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid #8bf5cc;outline-offset:3px}
.dashboard{max-width:1160px;margin:auto;padding:24px 20px 60px}.hero{position:relative;overflow:hidden;isolation:isolate;background:radial-gradient(ellipse at 87% 10%,#244a47 0%,transparent 48%),linear-gradient(120deg,#171d2a,#101723 70%);border:1px solid #2b3847;border-radius:26px;padding:28px 34px 32px;margin-bottom:24px;min-height:310px}.hero:after{content:"";position:absolute;inset:auto -20% -180px 30%;height:250px;background:#4ee4af12;filter:blur(65px);z-index:-1}.hero-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:28px}.brand-mark{font-weight:950;font-style:italic;letter-spacing:-3px;font-size:33px;color:#fff}.brand-mark span{font-size:19px;color:#61f3bd;vertical-align:top;letter-spacing:0}.live-tag{font-size:10px;letter-spacing:1.3px;font-weight:800;color:#b7d4cd;border:1px solid #355d55;background:#142e2b;padding:9px 12px;border-radius:999px;white-space:nowrap}.live-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#58eeb6;margin-right:6px;box-shadow:0 0 9px #58eeb6}.eyebrow,.section-kicker{font-size:11px;letter-spacing:2px;color:#6ef3c1;font-weight:900}.eyebrow span{color:#a0aeba}.hero h1{font-size:clamp(46px,8vw,79px);letter-spacing:-4px;line-height:.99;margin:14px 0;font-weight:950;position:relative;z-index:1}.hero h1 em{font-style:normal;color:#67eabb}.hero p{max-width:475px;color:#b0bbc9;font-size:14px;line-height:1.7;position:relative;z-index:1}.hero-meta{display:flex;flex-wrap:wrap;gap:9px;margin-top:24px;position:relative;z-index:1}.hero-meta span{font-size:10px;letter-spacing:1px;font-weight:800;border:1px solid #3c4b58;background:#ffffff08;padding:9px 11px;border-radius:7px;color:#c6d1da}.hero-ball{position:absolute;right:6%;top:26%;font-size:clamp(90px,17vw,170px);opacity:.25;transform:rotate(-22deg);filter:grayscale(.3)}.tabs{display:flex;overflow-x:auto;gap:9px;margin:22px 0 26px;padding:0 0 10px;scrollbar-width:thin}.tab{flex:none;border:1px solid #2b3645;background:#141b27;color:#aab9c8;border-radius:12px;padding:13px 17px;font-size:13px;font-weight:800;cursor:pointer;transition:background .15s,transform .15s}.tab:hover{background:#263747;transform:translateY(-1px)}.tab.selected{color:#091b16;background:#6beab9;border-color:#6beab9}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:22px 0 18px}.section-heading h2{font-size:clamp(23px,4vw,34px);margin:6px 0 0;letter-spacing:-1px}.count-pill{border:1px solid #324151;border-radius:999px;padding:9px 12px;color:#9dabbc;font-size:10px;font-weight:800;white-space:nowrap;letter-spacing:.6px}.data-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:14px}.data-card{border:1px solid #293646;border-radius:17px;padding:21px;background:linear-gradient(150deg,#1b2431,#111925);min-width:0;transition:transform .2s,border-color .2s}.data-card:hover{transform:translateY(-3px);border-color:#5bdab0}.card-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:23px}.card-number{color:#5ce6b2;font-size:12px;font-weight:900}.card-label{font-size:10px;color:#8497aa;letter-spacing:1.3px;font-weight:900}.card-title{font-size:21px;letter-spacing:-.5px;line-height:1.2;margin:0 0 15px}.data-card p,.data-card li{line-height:1.6}.data-card ul{max-height:340px;overflow-y:auto}.state-message{padding:25px;border:1px solid #2b3847;border-radius:16px;color:#aab9c8;background:#141b27}.footer{margin-top:42px;border-top:1px solid #27313f;padding-top:20px;color:#8491a3;font-size:12px}.footer a{color:#67eabb!important}@media(max-width:600px){.dashboard{padding:12px 13px 44px}.hero{padding:22px 20px 25px;border-radius:19px;min-height:280px}.hero-top{margin-bottom:28px}.hero h1{letter-spacing:-2.5px}.hero-ball{right:-15px;top:32%;font-size:110px;opacity:.13}.hero-meta{gap:6px}.hero-meta span{font-size:9px;padding:8px}.tab{padding:12px 14px}.section-heading{align-items:center}.data-card{padding:18px}}
`}</style></main>
  );
}
