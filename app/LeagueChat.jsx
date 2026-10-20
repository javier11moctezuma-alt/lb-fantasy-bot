"use client";
import { useState } from "react";

const suggestions = ["¿Cuáles son los equipos?", "Muéstrame los rankings", "¿Quiénes son los agentes libres?", "¿Qué jugadores tiene Arvo?", "Últimas transacciones"];
function normalize(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function analyze(query, data) {
  const q = normalize(query);
  const teams = data.teams || [];
  const rosters = data.rosters || [];
  const rankings = data.rankings || [];
  const agents = data.freeagents || [];
  const transactions = data.transactions || [];
  const match = (names) => names.find((item) => normalize(item.name || item.teamName).split(" ").some((word) => word.length > 3 && q.includes(word))) ||
    names.find((item) => q.includes(normalize(item.name || item.teamName)));
  if (/ayuda|puedes hacer|comandos|hola/.test(q)) return "¡Hola! 🏀 Puedo consultar equipos, plantillas, rankings, agentes libres y transacciones de tu liga. Prueba los ejemplos de abajo.";
  if (/agente|libre|free agent|disponible/.test(q)) return agents.length ? "Agentes libres disponibles (primeros 15):\n" + agents.slice(0, 15).map((p) => "• " + (p.name || "Jugador #" + p.id)).join("\n") : "ESPN no devolvió agentes libres en este momento.";
  if (/mejorar|recomienda|recomendacion|que movimientos|que cambios|que trade|que fichaje|a quien fichar|a quien cambiar|deberia hacer/.test(q)) {
    const team = match(rosters);
    if (team) {
      const names = (team.players || []).map((p) => p.name || "Jugador #" + p.id);
      return "Para recomendar movimientos a " + team.teamName + " necesito comparar estadísticas por categoría y agentes libres. Todavía no tengo ese análisis implementado y no quiero inventar trades.\\n\\nPlantilla actual:\\n" + names.map((n) => "• " + n).join("\\n") + "\\n\\nPuedo mostrar agentes libres, pero todavía no evaluar cuáles mejorarían al equipo.";
    }
    return "Para recomendar mejoras necesito identificar el equipo y analizar estadísticas por categoría. Todavía no puedo dar recomendaciones confiables. Pregúntame por la plantilla de un equipo o por agentes libres.";
  }
  if (/transaccion|ultimos movimientos|movimientos recientes|cambio reciente|trade reciente/.test(q)) return transactions.length ? "Últimos movimientos disponibles:\n" + transactions.slice(0, 8).map((t) => "• " + (t.type || "Movimiento") + ": " + (t.items || []).map((i) => (i.type || "") + " " + (i.playerName || "Jugador #" + i.playerId)).join(", ")).join("\n") : "ESPN no devolvió transacciones recientes.";
  if (/roster|plantilla|jugadores|tiene|equipo de/.test(q)) {
    const team = match(rosters);
    if (team) return "Plantilla de " + team.teamName + ":\n" + (team.players || []).map((p) => "• " + (p.name || "Jugador #" + p.id)).join("\n");
    return "Dime el nombre del equipo. Ejemplo: ¿Qué jugadores tiene Arvo?";
  }
  if (/ranking|power|mejor equipo|clasificacion|posicion|primero|rating/.test(q)) {
    if (!rankings.length) return "No hay rankings disponibles.";
    const withRatings = rankings.some((r) => r.rating != null);
    return (withRatings ? "Power Rankings según datos disponibles:\n" : "Aún no hay suficientes estadísticas para asignar Power Ratings confiables. Equipos registrados (sin orden de fuerza):\n") +
      rankings.map((r) => "• " + (r.rank != null ? "#" + r.rank + " " : "") + r.name + (r.rating != null ? " — " + r.rating + "/100" : "")).join("\n");
  }
  if (/equipo|liga|participan|cuantos/.test(q)) return teams.length ? "Hay " + teams.length + " equipos:\n" + teams.map((t) => "• " + t.name).join("\n") : "ESPN no devolvió los equipos.";
  const found = match(rosters);
  if (found) return "Encontré a " + found.teamName + ". Puedes preguntarme: ¿Qué jugadores tiene " + found.teamName + "?";
  return "Todavía no puedo analizar esa pregunta. Prueba: «Muéstrame los rankings», «¿Qué jugadores tiene Arvo?» o «¿Cuáles son los agentes libres?»";
}
export default function LeagueChat() {
  const [messages, setMessages] = useState([{ role: "bot", text: "¡Bienvenido al chat de LB Fantasy Bot! 🏀 Pregúntame sobre tu liga." }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(value) {
    const query = value.trim();
    if (!query || busy) return;
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", text: query }]);
    setBusy(true);
    try {
      const history = [...messages.map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })), { role: "user", content: query }];
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo consultar la IA.");
      setMessages((prev) => [...prev, { role: "bot", text: body.reply }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "bot", text: "No pude completar la consulta. " + error.message + " Intenta de nuevo." }]);
    } finally { setBusy(false); }
  }
  return <section className="chat-shell" aria-label="Chat de LB Fantasy Bot">
    <div className="chat-heading"><div className="chat-avatar">✦</div><div><span className="chat-kicker">YOUR AI ANALYST</span><h2>LB Intelligence <span className="chat-online">● ONLINE</span></h2></div></div>
    <p className="chat-desc">Tu asistente para analizar equipos, plantillas, movimientos y más. Conectado a ESPN.</p>
    <div className="chat-messages" aria-live="polite">
      {messages.map((message, i) => <div className={"chat-bubble " + (message.role === "user" ? "from-user" : "from-bot")} key={i}>{message.role === "bot" ? message.text.replace(/\*\*/g, "").replace(/\\n/g, "\n") : message.text}</div>)}
      {busy && <p role="status" style={{ color: "#a1a1aa" }}>Consultando ESPN...</p>}
    </div>
    <div className="chat-suggestions">
      {suggestions.map((s) => <button className="suggestion" key={s} disabled={busy} onClick={() => send(s)}>{s}</button>)}
    </div>
    <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
      <input aria-label="Pregunta para el bot" maxLength={300} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Pregúntame lo que quieras..." />
      <button disabled={busy || !draft.trim()} type="submit">Enviar ↗</button>
    </form>
    <style jsx global>{`
.chat-shell{background:linear-gradient(145deg,#1a2630,#111b25);border:1px solid #345248;border-radius:20px;padding:24px;margin-bottom:24px;box-shadow:0 15px 50px #00000022}.chat-heading{display:flex;align-items:center;gap:13px}.chat-avatar{width:46px;height:46px;flex:none;display:grid;place-items:center;border-radius:14px;background:#6beab9;color:#10271e;font-size:29px;font-weight:900}.chat-kicker{font-size:10px;font-weight:900;color:#66e9b9;letter-spacing:2px}.chat-heading h2{font-size:22px;letter-spacing:-.6px;margin:4px 0 0}.chat-online{font-size:9px;color:#69eab9;letter-spacing:1px;vertical-align:middle;margin-left:8px}.chat-desc{font-size:13px;color:#9eafbc;line-height:1.6;margin:15px 0}.chat-messages{min-height:115px;max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:17px 0;border-top:1px solid #2d3d49}.chat-bubble{max-width:90%;padding:13px 16px;border-radius:15px;white-space:pre-wrap;line-height:1.55;font-size:14px;overflow-wrap:anywhere}.from-user{align-self:flex-end;background:#3c806e;color:white;border-bottom-right-radius:4px}.from-bot{align-self:flex-start;background:#263543;color:#e9f2f5;border:1px solid #344756;border-bottom-left-radius:4px}.chat-suggestions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px}.suggestion{background:#192a35;border:1px solid #3a5360;border-radius:999px;padding:9px 12px;color:#d6e4e9;cursor:pointer;font-size:12px}.suggestion:hover{border-color:#67eabb;color:#67eabb}.chat-form{display:flex;gap:9px}.chat-form input{flex:1;min-width:0;background:#0b141d;color:#f5faf9;border:1px solid #3b505c;border-radius:12px;padding:14px}.chat-form input::placeholder{color:#718596}.chat-form button{background:#6beab9;border:0;border-radius:12px;padding:13px 18px;color:#0b241b;font-weight:900;cursor:pointer;white-space:nowrap}.chat-form button:disabled{opacity:.5;cursor:not-allowed}@media(max-width:600px){.chat-shell{padding:17px;border-radius:18px}.chat-heading h2{font-size:19px}.chat-online{font-size:8px}.chat-bubble{max-width:95%}.chat-form button{padding:12px}}
`}</style>
  </section>;
}
