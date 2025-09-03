// App.js
import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot,
  getDocs,
} from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- LISTA DE JUGADORES DE FÚTBOL ---
const jugadoresFutbol = [
  "Messi", "Cristiano", "Neymar", "Mbappé", "Lewandowski",
  "Kane", "Salah", "De Bruyne", "Modrić", "Hazard",
  "Griezmann", "Ronaldo Nazário", "Ronaldinho", "Zidane", "Iniesta",
  "Xavi", "Suárez", "Pogba", "Kroos", "Thiago Silva"
];

function App() {
  const [nombre, setNombre] = useState("");
  const [roomId, setRoomId] = useState("");
  const [miId, setMiId] = useState("");
  const [miPalabra, setMiPalabra] = useState("");
  const [jugadores, setJugadores] = useState([]);
  const [votos, setVotos] = useState({});
  const [impostorDescubierto, setImpostorDescubierto] = useState(false);
  const [jugadoresEsperados, setJugadoresEsperados] = useState(4);

  // --- CREAR SALA ---
  const crearSala = async () => {
    const nuevoRoomId = Math.random().toString(36).substring(2, 8);
    setRoomId(nuevoRoomId);

    const jugadorNormal = jugadoresFutbol[Math.floor(Math.random() * jugadoresFutbol.length)];

    await setDoc(doc(db, "rooms", nuevoRoomId), {
      jugadoresEsperados,
      jugadoresConectados: [],
      jugadorNormal,
      impostorIndex: null,
      impostorAsignado: false,
      impostorDescubierto: false
    });

    alert(`Sala creada! Room ID: ${nuevoRoomId}`);
  };

  // --- UNIRSE A SALA ---
  const unirseSala = async () => {
    if (!nombre) return alert("Ingrese su nombre");
    if (!roomId) return alert("Ingrese un Room ID");

    const jugadorId = Math.random().toString(36).substring(2, 9);
    setMiId(jugadorId);

    const salaRef = doc(db, "rooms", roomId);
    const salaSnap = await getDoc(salaRef);
    if (!salaSnap.exists()) return alert("Sala no existe");

    const salaData = salaSnap.data();
    await updateDoc(salaRef, {
      jugadoresConectados: [
        ...salaData.jugadoresConectados,
        { id: jugadorId, nombre, palabra: "", voto: null }
      ]
    });

    // --- ESCUCHAR SALA ---
    onSnapshot(salaRef, (snap) => {
      const data = snap.data();
      if (!data) return;
      setImpostorDescubierto(data.impostorDescubierto || false);

      // Asignar impostor si ya se llegó al número esperado
      if (!data.impostorAsignado && data.jugadoresConectados.length === data.jugadoresEsperados) {
        const impostorIndex = Math.floor(Math.random() * data.jugadoresEsperados);
        updateDoc(salaRef, { impostorIndex, impostorAsignado: true });
      }

      // Asignar palabra a mi jugador
      if (data.impostorAsignado && !miPalabra) {
        const miJugador = data.jugadoresConectados.find(j => j.id === miId);
        if (miJugador) {
          const indexMiJugador = data.jugadoresConectados.findIndex(j => j.id === miId);
          if (indexMiJugador === data.impostorIndex) {
            setMiPalabra("IMPOSTOR");
          } else {
            setMiPalabra(data.jugadorNormal);
          }
        }
      }
    });

    // --- ESCUCHAR JUGADORES Y VOTOS ---
    const jugadoresRef = collection(db, "rooms", roomId, "players");
    onSnapshot(jugadoresRef, (snap) => {
      const lista = [];
      const votosAct = {};
      snap.forEach((d) => {
        lista.push({ id: d.id, ...d.data() });
        if (d.data().voto) votosAct[d.data().voto] = (votosAct[d.data().voto] || 0) + 1;
      });
      setJugadores(lista);
      setVotos(votosAct);
    });
  };

  // --- VOTAR ---
  const votar = async (jugadorId) => {
    const jugadorRef = doc(db, "rooms", roomId, "players", miId);
    await updateDoc(jugadorRef, { voto: jugadorId });
  };

  // --- NUEVA PARTIDA ---
  const nuevaPartida = async () => {
    const salaRef = doc(db, "rooms", roomId);
    const salaSnap = await getDoc(salaRef);
    if (!salaSnap.exists()) return;
    const jugadoresRef = collection(db, "rooms", roomId, "players");
    const allPlayers = await getDocs(jugadoresRef);
    allPlayers.forEach(async (p) => {
      await updateDoc(doc(db, "rooms", roomId, "players", p.id), { palabra: "", voto: null });
    });

    await updateDoc(salaRef, { impostorIndex: null, impostorAsignado: false, impostorDescubierto: false });
    setMiPalabra("");
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Juego del Impostor 412 ⚽</h1>

      {!miId && (
        <div>
          <input
            type="text"
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <br />
          <input
            type="number"
            placeholder="Cantidad de jugadores"
            value={jugadoresEsperados}
            onChange={(e) => setJugadoresEsperados(Number(e.target.value))}
          />
          <br />
          <button onClick={crearSala}>Crear Sala</button>
          <br />
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={unirseSala}>Unirse a Sala</button>
        </div>
      )}

      {miId && (
        <div>
          <p>Sala: {roomId}</p>
          <h2>Mi palabra: {miPalabra}</h2>

          <h3>Votar:</h3>
          {jugadores.map((j) => (
            <button key={j.id} onClick={() => votar(j.id)}>
              {j.nombre} ({votos[j.id] || 0} votos)
            </button>
          ))}

          <h3>Jugadores conectados:</h3>
          <ul>
            {jugadores.map((j) => (
              <li key={j.id}>{j.nombre}</li>
            ))}
          </ul>

          {impostorDescubierto && (
            <div>
              <h3>¡Impostor descubierto!</h3>
              <button onClick={nuevaPartida}>Nueva partida</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
