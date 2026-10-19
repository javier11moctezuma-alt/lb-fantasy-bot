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
      setMessages((prev) => [...prev, { role: "bot", text: "No pude consultar ESPN. " + error.message + " Intenta de nuevo." }]);
    } finally { setBusy(false); }
  }
  return <section aria-label="Chat de LB Fantasy Bot" style={{ background: "#1d1d2b", border: "1px solid #343449", borderRadius: 18, padding: 20, marginBottom: 28 }}>
    <h2 style={{ marginTop: 0 }}>💬 Pregúntale al bot</h2>
    <p style={{ color: "#a1a1aa", fontSize: 13 }}>Chat con IA conectado a los datos disponibles de ESPN. Las recomendaciones dependen de la información recibida.</p>
    <div aria-live="polite" style={{ maxHeight: 350, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "12px 0" }}>
      {messages.map((message, i) => <div key={i} style={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", background: message.role === "user" ? "#4f46e5" : "#303047", borderRadius: 14, padding: "12px 14px", maxWidth: "90%", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{message.text}</div>)}
      {busy && <p role="status" style={{ color: "#a1a1aa" }}>Consultando ESPN...</p>}
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
      {suggestions.map((s) => <button key={s} disabled={busy} onClick={() => send(s)} style={{ background: "#303047", border: "1px solid #45455b", borderRadius: 20, padding: "8px 10px", color: "white", cursor: "pointer" }}>{s}</button>)}
    </div>
    <form onSubmit={(e) => { e.preventDefault(); send(draft); }} style={{ display: "flex", gap: 8 }}>
      <input aria-label="Pregunta para el bot" maxLength={300} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Pregunta sobre tu liga..." style={{ flex: 1, minWidth: 0, background: "#10101a", color: "white", border: "1px solid #45455b", borderRadius: 12, padding: 12 }} />
      <button disabled={busy || !draft.trim()} type="submit" style={{ background: "#6366f1", border: 0, borderRadius: 12, padding: "12px 16px", color: "white", cursor: "pointer" }}>Enviar</button>
    </form>
  </section>;
}
