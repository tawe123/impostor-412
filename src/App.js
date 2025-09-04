import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase"; // Asegúrate de exportar `db` desde ./firebase (initializeApp + getFirestore)

// ======= Lista de palabras (jugadores de fútbol) =======
const JUGADORES = [
  "Messi",
  "Cristiano Ronaldo",
  "Mbappé",
  "Neymar",
  "Haaland",
  "Modric",
  "Vinicius",
  "Lewandowski",
  "Bellingham",
  "Griezmann",
  "De Bruyne",
  "Salah",
  "Kane",
  "Suárez",
  "Dybala",
  "Courtois",
  "Ter Stegen",
  "Alisson",
  "Gavi",
  "Pedri",
];

// ======= Utilidades =======
const randChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shortId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function useLocalId() {
  const [id, setId] = useState(null);
  useEffect(() => {
    let pid = localStorage.getItem("playerId");
    if (!pid) {
      pid = crypto?.randomUUID?.() || shortId();
      localStorage.setItem("playerId", pid);
    }
    setId(pid);
  }, []);
  return id;
}

// ======= API de sala =======
async function crearSala({ jugadoresEsperados = 4, hostName }) {
  const roomId = shortId();
  const normalWord = randChoice(JUGADORES);
  const hostId = localStorage.getItem("playerId") || crypto?.randomUUID?.() || shortId();
  // Doc principal de la sala
  await setDoc(doc(db, "rooms", roomId), {
    status: "waiting", // waiting | playing | ended
    jugadoresEsperados,
    normalWord,
    createdAt: serverTimestamp(),
    hostId,
    hostName: hostName || "Anfitrión",
  });
  // Anfitrión como primer jugador
  await setDoc(doc(db, "rooms", roomId, "players", hostId), {
    name: hostName || "Anfitrión",
    joinedAt: serverTimestamp(),
  });
  return { roomId, hostId };
}

async function unirseSala({ roomId, name }) {
  const playerId = localStorage.getItem("playerId") || crypto?.randomUUID?.() || shortId();
  const salaRef = doc(db, "rooms", roomId);
  const sala = await getDoc(salaRef);
  if (!sala.exists()) throw new Error("La sala no existe.");
  await setDoc(doc(db, "rooms", roomId, "players", playerId), {
    name: name || "Jugador",
    joinedAt: serverTimestamp(),
  }, { merge: true });
  return { playerId };
}

// Asigna la MISMA palabra normal de la sala a todos, y a 1 impostor "IMPOSTOR"
async function iniciarPartida({ roomId }) {
  const salaRef = doc(db, "rooms", roomId);
  const salaSnap = await getDoc(salaRef);
  if (!salaSnap.exists()) throw new Error("No existe la sala");
  const sala = salaSnap.data();
  if (sala.status === "playing") return; // ya empezó

  // leer jugadores actuales
  const playersSnap = await getDocs(collection(db, "rooms", roomId, "players"));
  const players = [];
  playersSnap.forEach((d) => players.push({ id: d.id, ...d.data() }));
  if (players.length < 3) throw new Error("Se requieren al menos 3 jugadores para iniciar.");

  // elegir impostor
  const impostorIdx = Math.floor(Math.random() * players.length);
  const impostorId = players[impostorIdx].id;
  const normalWord = sala.normalWord || randChoice(JUGADORES);

  // escribir palabras a cada jugador + actualizar sala
  const batch = writeBatch(db);
  players.forEach((p) => {
    const pRef = doc(db, "rooms", roomId, "players", p.id);
    const palabra = p.id === impostorId ? "IMPOSTOR" : normalWord;
    batch.set(pRef, { palabra }, { merge: true });
  });
  batch.set(salaRef, { status: "playing", startedAt: serverTimestamp(), impostorId }, { merge: true });
  await batch.commit();
}

function useSala(roomId) {
  const [sala, setSala] = useState(null);
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      setSala(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return () => unsub && unsub();
  }, [roomId]);
  return sala;
}

function useJugadores(roomId) {
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(collection(db, "rooms", roomId, "players"), (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      // ordenar por joinedAt asc si existe
      arr.sort((a, b) => {
        const ta = a.joinedAt?.seconds || 0;
        const tb = b.joinedAt?.seconds || 0;
        return ta - tb;
      });
      setPlayers(arr);
    });
    return () => unsub && unsub();
  }, [roomId]);
  return players;
}

function useMiJugador(roomId, playerId) {
  const [me, setMe] = useState(null);
  useEffect(() => {
    if (!roomId || !playerId) return;
    const unsub = onSnapshot(doc(db, "rooms", roomId, "players", playerId), (snap) => {
      setMe(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return () => unsub && unsub();
  }, [roomId, playerId]);
  return me;
}

// ======= UI mínima para probar =======
export default function App() {
  const playerId = useLocalId();
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [esperados, setEsperados] = useState(4);
  const sala = useSala(roomId);
  const jugadores = useJugadores(roomId);
  const yo = useMiJugador(roomId, playerId);

  const enLobby = !sala || sala?.status === "waiting";

  const faltan = useMemo(() => {
    if (!sala) return null;
    const tot = jugadores.length;
    return Math.max(0, (sala.jugadoresEsperados || 0) - tot);
  }, [sala, jugadores.length]);

  async function handleCrearSala() {
    try {
      const { roomId: rid } = await crearSala({ jugadoresEsperados: Number(esperados), hostName: name || "Anfitrión" });
      setRoomId(rid);
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleUnirse() {
    try {
      await unirseSala({ roomId: roomId.trim(), name: name || "Jugador" });
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleIniciar() {
    try {
      await iniciarPartida({ roomId });
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Impostor 412 — Demo fija</h1>

      {/* CREAR / UNIRSE */}
      {!roomId && (
        <section style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label>Tu nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Alex" />
          </div>

          <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
            <h3>Crear sala</h3>
            <label>Jugadores esperados</label>
            <input type="number" min={3} value={esperados} onChange={(e) => setEsperados(e.target.value)} />
            <button onClick={handleCrearSala} style={{ marginLeft: 12 }}>Crear</button>
          </div>

          <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
            <h3>Unirse a una sala</h3>
            <label>ID de sala</label>
            <input value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} placeholder="ABCDE" />
            <button onClick={handleUnirse} style={{ marginLeft: 12 }}>Unirse</button>
          </div>
        </section>
      )}

      {/* SALA */}
      {roomId && (
        <section style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Sala: {roomId}</h2>
            <span>Estado: {sala?.status || "–"}</span>
          </div>

          <p>Esperados: {sala?.jugadoresEsperados ?? "–"} — Conectados: {jugadores.length}</p>
          {enLobby && (
            <p>Faltan: {faltan}</p>
          )}

          <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, marginTop: 8 }}>
            <h3>Jugadores</h3>
            <ol>
              {jugadores.map((j) => (
                <li key={j.id}>
                  {j.name || j.id}
                  {sala?.impostorId && sala.impostorId === j.id ? " (impostor)" : ""}
                </li>
              ))}
            </ol>
          </div>

          {enLobby && (
            <button onClick={handleIniciar} disabled={jugadores.length < 3} style={{ marginTop: 12 }}>
              Iniciar partida
            </button>
          )}

          {/* Tarjeta privada del jugador */}
          {yo?.palabra && (
            <div style={{ marginTop: 16, padding: 12, border: "2px dashed #999", borderRadius: 8 }}>
              <strong>Tu palabra secreta:</strong>
              <div style={{ fontSize: 24, marginTop: 8 }}>{yo.palabra}</div>
            </div>
          )}

          {/* Si ya empezó pero aún no tienes palabra, muéstralo */}
          {sala?.status === "playing" && !yo?.palabra && (
            <p style={{ marginTop: 8 }}>Asignando palabras…</p>
          )}
        </section>
      )}
    </div>
  );
}
