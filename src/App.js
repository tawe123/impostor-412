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

// --- LISTA DE PALABRAS (jugadores de fútbol) ---
const palabras = [
  "Messi","Cristiano","Neymar","Mbappé","Lewandowski",
  "Salah","Modric","Kante","Ronaldo","Benzema",
  "Hazard","Pogba","De Bruyne","Kane","Dybala",
  "Suárez","Griezmann","Foden","Sterling","Jordi Alba",
  "Alisson","Kimmich","Rodri","Sancho","Haaland"
];

function App() {
  const [nombre, setNombre] = useState("");
  const [roomId, setRoomId] = useState("sala123"); // room fijo para pruebas
  const [miId, setMiId] = useState("");
  const [miPalabra, setMiPalabra] = useState("");
  const [jugadores, setJugadores] = useState([]);
  const [votos, setVotos] = useState({});
  const [impostorDescubierto, setImpostorDescubierto] = useState(false);

  // --- CREAR SALA SI NO EXISTE ---
  const crearSalaSiNoExiste = async () => {
    const salaRef = doc(db, "rooms", roomId);
    const salaSnap = await getDoc(salaRef);
    if (!salaSnap.exists()) {
      const impostorIndex = Math.floor(Math.random() * palabras.length);
      await setDoc(salaRef, { jugadores: [], impostor: impostorIndex, impostorDescubierto: false });
    }
  };

  // --- UNIRSE A SALA ---
  const unirseSala = async () => {
    if (!nombre) return alert("Ingrese su nombre");
    await crearSalaSiNoExiste();
    const jugadorId = Math.random().toString(36).substring(2, 9);
    setMiId(jugadorId);
    const jugadorRef = doc(db, "rooms", roomId, "players", jugadorId);
    await setDoc(jugadorRef, { nombre, palabra: "", voto: null });

    // Escuchar cambios de sala
    const salaRef = doc(db, "rooms", roomId);
    onSnapshot(salaRef, (snap) => {
      const data = snap.data();
      if (!data) return;
      setImpostorDescubierto(data.impostorDescubierto || false);
    });

    // Escuchar jugadores y votos
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

  // --- ASIGNAR PALABRA ---
  const asignarPalabra = async () => {
    const salaRef = doc(db, "rooms", roomId);
    const salaSnap = await getDoc(salaRef);
    if (!salaSnap.exists()) return;
    const data = salaSnap.data();
    const jugadorIndex = jugadores.findIndex((j) => j.id === miId);
    const palabra = data.impostor === jugadorIndex ? "IMPOSTOR" : palabras[Math.floor(Math.random() * palabras.length)];
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
    const salaRef = doc(db, "rooms", roomId);
    const salaSnap = await getDoc(salaRef);
    if (!salaSnap.exists()) return;
    await updateDoc(salaRef, { impostorDescubierto: false });
    const jugadoresRef = collection(db, "rooms", roomId, "players");
    const allPlayers = await getDocs(jugadoresRef);
    allPlayers.forEach(async (p) => {
      await updateDoc(doc(db, "rooms", roomId, "players", p.id), { palabra: "", voto: null });
    });
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
          <button onClick={unirseSala}>Unirse a Sala</button>
        </div>
      )}

      {miId && (
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
