import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  updateDoc,
} from "firebase/firestore";

// ⚡ Configuración Firebase
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

// 🎲 Lista de jugadores conocidos
const jugadoresFamosos = [
  "Messi", "Cristiano Ronaldo", "Mbappé", "Neymar", "Suárez",
  "Ronaldinho", "Maradona", "Pelé", "Zidane", "Modric", "Xavi",
  "Iniesta", "Henry", "Lewandowski", "Hazard", "Benzema",
  "Salah", "Ramos", "Buffon", "Ibrahimovic", "Kanté", "Vinicius",
];

function App() {
  const [roomId, setRoomId] = useState("");
  const [jugadorNombre, setJugadorNombre] = useState("");
  const [jugadoresEsperados, setJugadoresEsperados] = useState(0);
  const [miPalabra, setMiPalabra] = useState("");
  const [jugadores, setJugadores] = useState([]);
  const [voto, setVoto] = useState("");

  // 🔹 Crear sala
  const crearSala = async () => {
    if (!roomId || jugadoresEsperados < 3) {
      alert("Debes ingresar un Room ID y al menos 3 jugadores esperados");
      return;
    }
    const salaRef = doc(db, "rooms", roomId);
    await setDoc(salaRef, {
      jugadoresEsperados,
      creadaEn: new Date(),
      juegoIniciado: false,
    });
    alert("Sala creada. Comparte el Room ID: " + roomId);
  };

  // 🔹 Unirse a sala
  const unirseSala = async () => {
    if (!roomId || !jugadorNombre) {
      alert("Debes ingresar Room ID y tu nombre");
      return;
    }
    const salaRef = doc(db, "rooms", roomId);
    const salaSnap = await getDoc(salaRef);

    if (!salaSnap.exists()) {
      alert("La sala no existe.");
      return;
    }

    await addDoc(collection(db, "rooms", roomId, "players"), {
      nombre: jugadorNombre,
      palabra: "",
      rol: "",
      voto: "",
    });
  };

  // 🔹 Escuchar jugadores en tiempo real y actualizar palabra localmente
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(
      collection(db, "rooms", roomId, "players"),
      (snapshot) => {
        const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJugadores(lista);

        // Actualizamos la palabra localmente para el jugador actual
        const miInfo = lista.find(j => j.nombre === jugadorNombre);
        if (miInfo) setMiPalabra(miInfo.palabra);
      }
    );
    return () => unsub();
  }, [roomId, jugadorNombre]);

  // 🔹 Asignar roles y palabras en Firestore
  const asignarRoles = async () => {
    if (jugadores.length !== jugadoresEsperados) {
      alert("Todavía no se conectaron todos los jugadores");
      return;
    }

    const impostorIndex = Math.floor(Math.random() * jugadores.length);
    const palabraJuego = jugadoresFamosos[Math.floor(Math.random() * jugadoresFamosos.length)];

    const salaRef = doc(db, "rooms", roomId);

    // Guardamos la palabra del juego y el impostor en la sala
    await setDoc(salaRef, {
      jugadoresEsperados,
      palabraJuego,
      impostorId: jugadores[impostorIndex].id,
      juegoIniciado: true,
      creadaEn: new Date()
    }, { merge: true });

    // Actualizamos a cada jugador con su rol
    const updates = jugadores.map((j, idx) =>
      updateDoc(doc(db, "rooms", roomId, "players", j.id), {
        rol: idx === impostorIndex ? "impostor" : "jugador",
        palabra: idx === impostorIndex ? "IMPOSTOR" : palabraJuego
      })
    );

    await Promise.all(updates);
  };

  // 🔹 Votar
  const votar = async (id) => {
    await updateDoc(doc(db, "rooms", roomId, "players", jugadores.find(j => j.id === id).id), {
      voto: id,
    });
    setVoto(id);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Juego del Impostor 412 ⚽</h1>

      {!miPalabra && (
        <div>
          <input
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <input
            placeholder="Tu nombre"
            value={jugadorNombre}
            onChange={(e) => setJugadorNombre(e.target.value)}
          />
          <input
            type="number"
            placeholder="Jugadores esperados"
            value={jugadoresEsperados}
            onChange={(e) => setJugadoresEsperados(Number(e.target.value))}
          />
          <button onClick={crearSala}>Crear Sala</button>
          <button onClick={unirseSala}>Unirse a Sala</button>
        </div>
      )}

      {miPalabra && (
        <div>
          <h2>Tu palabra: {miPalabra}</h2>
          {miPalabra !== "IMPOSTOR" ? (
            <p>No reveles tu palabra 😉</p>
          ) : (
            <p>¡Eres el impostor! 🤫</p>
          )}
        </div>
      )}

      <h3>Jugadores en la sala</h3>
      <ul>
        {jugadores.map((j) => (
          <li key={j.id}>
            {j.nombre} {voto === j.id && "✅"}
            <button onClick={() => votar(j.id)}>Votar</button>
          </li>
        ))}
      </ul>

      {jugadores.length === jugadoresEsperados && !miPalabra && (
        <button onClick={asignarRoles}>Iniciar Juego</button>
      )}
    </div>
  );
}

export default App;
