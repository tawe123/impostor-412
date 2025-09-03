// App.js
import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  query,
} from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- LISTA AMPLIADA DE JUGADORES DE FÚTBOL ---
const palabras = [
  "Messi","Cristiano","Neymar","Mbappé","Lewandowski",
  "Salah","Modric","Kante","Ronaldo","Benzema",
  "Hazard","Pogba","De Bruyne","Kane","Dybala",
  "Suárez","Griezmann","Foden","Sterling","Jordi Alba",
  "Alisson","Kimmich","Rodri","Sancho","Haaland"
];

function App() {
  const [roomId, setRoomId] = useState("");
  const [jugadores, setJugadores] = useState([]);
  const [miId, setMiId] = useState("");
  const [miPalabra, setMiPalabra] = useState("");
  const [votos, setVotos] = useState({});
  const [impostorDescubierto, setImpostorDescubierto] = useState(false);

  // --- CREAR SALA ---
  const crearSala = async () => {
    const id = Math.random().toString(36).substring(2, 7);
    setRoomId(id);
    const salaRef = doc(db, "rooms", id);
    const impostorIndex = Math.floor(Math.random() * palabras.length);
    await setDoc(salaRef, { jugadores: [], impostor: impostorIndex, impostorDescubierto: false });
  };

  // --- UNIRSE A SALA ---
  const unirseSala = async (id, nombre) => {
    setRoomId(id);
    const jugadorId = Math.random().toString(36).substring(2, 9);
    setMiId(jugadorId);
    const jugadorRef = doc(db, "rooms", id, "players", jugadorId);
    await setDoc(jugadorRef, { nombre, palabra: "", voto: null });
    // escuchar cambios
    onSnapshot(doc(db, "rooms", id), (snap) => {
      const data = snap.data();
      if (!data) return;
      setImpostorDescubierto(data.impostorDescubierto || false);
    });
    // escuchar jugadores
    const q = collection(db, "rooms", id, "players");
    onSnapshot(q, (snap) => {
      const list = [];
      const votosAct = {};
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
        if (d.data().voto) votosAct[d.data().voto] = (votosAct[d.data().voto] || 0) + 1;
      });
      setJugadores(list);
      setVotos(votosAct);
    });
  };

  // --- ASIGNAR PALABRA ---
  const asignarPalabra = async () => {
    const salaRef = doc(db, "rooms", roomId);
    const salaSnap = await getDoc(salaRef);
    if (!salaSnap.exists()) return;
    const data = salaSnap.data();
    const isImpostor = data.impostor === Math.floor(Math.random() * palabras.length); // asigna aleatorio impostor
    const palabra = isImpostor ? "IMPOSTOR" : palabras[Math.floor(Math.random() * palabras.length)];
    const jugadorRef = doc(db, "rooms", roomId, "players", miId);
    await updateDoc(jugadorRef, { palabra });
    setMiPalabra(palabra);
  };

  // --- VOTAR ---
  const votar = async (jugadorId) => {
    const jugadorRef = doc(db, "rooms", roomId, "players", miId);
    await updateDoc(jugadorRef, { voto: jugadorId });
  };

  // --- NUEVA PARTIDA ---
  const nuevaPartida = async () => {
    // resetea todo
    const salaRef = doc(db, "rooms", roomId);
    const salaSnap = await getDoc(salaRef);
    if (!salaSnap.exists()) return;
    await updateDoc(salaRef, { impostorDescubierto: false });
    // reset jugadores
    const q = collection(db, "rooms", roomId, "players");
    const allPlayers = await getDocs(q);
    allPlayers.forEach(async (p) => {
      await updateDoc(doc(db, "rooms", roomId, "players", p.id), { palabra: "", voto: null });
    });
    setMiPalabra("");
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Juego del Impostor 412 ⚽</h1>
      {!roomId && (
        <button onClick={crearSala}>Crear Sala</button>
      )}
      {roomId && !miId && (
        <div>
          <input type="text" placeholder="Tu nombre" id="nombreJugador" />
          <button onClick={() => unirseSala(roomId, document.getElementById("nombreJugador").value)}>Unirse a Sala</button>
        </div>
      )}
      {roomId && miId && (
        <div>
          <p>Sala: {roomId}</p>
          <button onClick={asignarPalabra}>Mostrar Mi Palabra</button>
          <h2>Mi palabra: {miPalabra}</h2>

          <h3>Votar:</h3>
          {jugadores.map((j) => (
            <button key={j.id} onClick={() => votar(j.id)}>
              {j.nombre} ({votos[j.id] || 0} votos)
            </button>
          ))}

          {impostorDescubierto ? (
            <button onClick={nuevaPartida}>Nueva partida</button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default App;
