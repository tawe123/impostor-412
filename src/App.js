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

// 🎲 Lista de jugadores famosos
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
  const [ronda, setRonda] = useState(1);
  const [todosVotaron, setTodosVotaron] = useState(false);

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
      ronda: 1,
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
      eliminado: false,
    });
  };

  // 🔹 Escuchar jugadores en tiempo real
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(
      collection(db, "rooms", roomId, "players"),
      (snapshot) => {
        const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJugadores(lista);

        const miInfo = lista.find(j => j.nombre === jugadorNombre);
        if (miInfo) setMiPalabra(miInfo.palabra);
      }
    );
    return () => unsub();
  }, [roomId, jugadorNombre]);

  // 🔹 Detectar si todos votaron
  useEffect(() => {
    const activos = jugadores.filter(j => !j.eliminado);
    if (activos.length === 0) return;

    const completaronVoto = activos.every(j => j.voto && !j.eliminado);
    setTodosVotaron(completaronVoto);
  }, [jugadores]);

  // 🔹 Asignar roles y palabra
  const asignarRoles = async () => {
    const activos = jugadores.filter(j => !j.eliminado);
    if (activos.length !== jugadoresEsperados) {
      alert("Todavía no se conectaron todos los jugadores");
      return;
    }

    const impostorIndex = Math.floor(Math.random() * activos.length);
    const palabraJuego = jugadoresFamosos[Math.floor(Math.random() * jugadoresFamosos.length)];

    const salaRef = doc(db, "rooms", roomId);
    await setDoc(salaRef, {
      palabraJuego,
      impostorId: activos[impostorIndex].id,
      juegoIniciado: true,
      ronda: 1,
    }, { merge: true });

    const updates = activos.map((j, idx) =>
      updateDoc(doc(db, "rooms", roomId, "players", j.id), {
        rol: idx === impostorIndex ? "impostor" : "jugador",
        palabra: idx === impostorIndex ? "IMPOSTOR" : palabraJuego,
        voto: "",
        eliminado: false,
      })
    );
    await Promise.all(updates);
  };

  // 🔹 Votar (modificable hasta iniciar ronda)
  const votar = async (id) => {
    const miInfo = jugadores.find(j => j.nombre === jugadorNombre);
    if (!miInfo || miInfo.eliminado) return;

    await updateDoc(doc(db, "rooms", roomId, "players", miInfo.id), { voto: id });
  };

  // 🔹 Iniciar ronda (procesar votos)
  const iniciarRonda = async () => {
    const activos = jugadores.filter(j => !j.eliminado);

    // Contar votos
    const conteo = {};
    activos.forEach(j => {
      if (j.voto) conteo[j.voto] = (conteo[j.voto] || 0) + 1;
    });

    // Jugador con más votos
    let maxVotos = 0;
    let eliminadoId = null;
    Object.keys(conteo).forEach(id => {
      if (conteo[id] > maxVotos) {
        maxVotos = conteo[id];
        eliminadoId = id;
      }
    });

    if (!eliminadoId) return;

    const jugadorEliminado = jugadores.find(j => j.id === eliminadoId);

    if (jugadorEliminado.rol === "impostor") {
      alert(`¡El impostor ${jugadorEliminado.nombre} fue eliminado! Los demás ganan 🎉`);
      reiniciarPartida();
      return;
    } else {
      await updateDoc(doc(db, "rooms", roomId, "players", eliminadoId), { eliminado: true });
    }

    const activosDespues = jugadores.filter(j => !j.eliminado && j.id !== eliminadoId);
    if (activosDespues.length <= 2) {
      const impostor = jugadores.find(j => j.rol === "impostor");
      alert(`¡El impostor ${impostor.nombre} gana! 😈`);
      reiniciarPartida();
      return;
    }

    // Limpiar votos y actualizar ronda
    const updates = jugadores.map(j => updateDoc(doc(db, "rooms", roomId, "players", j.id), { voto: "" }));
    await Promise.all(updates);

    const salaRef = doc(db, "rooms", roomId);
    await updateDoc(salaRef, { ronda: ronda + 1 });
    setRonda(ronda + 1);
    setTodosVotaron(false);
  };

  // 🔹 Reiniciar partida
  const reiniciarPartida = async () => {
    const palabraJuego = jugadoresFamosos[Math.floor(Math.random() * jugadoresFamosos.length)];
    const impostorIndex = Math.floor(Math.random() * jugadores.length);

    const updates = jugadores.map((j, idx) =>
      updateDoc(doc(db, "rooms", roomId, "players", j.id), {
        rol: idx === impostorIndex ? "impostor" : "jugador",
        palabra: idx === impostorIndex ? "IMPOSTOR" : palabraJuego,
        eliminado: false,
        voto: "",
      })
    );
    await Promise.all(updates);

    const salaRef = doc(db, "rooms", roomId);
    await updateDoc(salaRef, { juegoIniciado: true, ronda: 1 });
    setRonda(1);
    setTodosVotaron(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Juego del Impostor 412 ⚽</h1>

      {!miPalabra && (
        <div>
          <input placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
          <input placeholder="Tu nombre" value={jugadorNombre} onChange={(e) => setJugadorNombre(e.target.value)} />
          <input type="number" placeholder="Jugadores esperados" value={jugadoresEsperados} onChange={(e) => setJugadoresEsperados(Number(e.target.value))} />
          <button onClick={crearSala}>Crear Sala</button>
          <button onClick={unirseSala}>Unirse a Sala</button>
        </div>
      )}

      {miPalabra && (
        <div>
          <h2>Tu palabra: {miPalabra}</h2>
          {miPalabra !== "IMPOSTOR" ? <p>No reveles tu palabra 😉</p> : <p>¡Eres el impostor! 🤫</p>}
        </div>
      )}

      <h3>Ronda: {ronda}</h3>
      <h3>Jugadores en la sala</h3>
      <ul>
        {jugadores.map(j => (
          <li key={j.id} style={{ textDecoration: j.eliminado ? "line-through" : "none" }}>
            {j.nombre} {j.eliminado && "(eliminado)"} {j.voto && "✅"}
            {!j.eliminado && (
              <button onClick={() => votar(j.id)}>Votar</button>
            )}
          </li>
        ))}
      </ul>

      {jugadores.length === jugadoresEsperados && !miPalabra && (
        <button onClick={asignarRoles}>Iniciar Juego</button>
      )}

      {todosVotaron && (
        <button onClick={iniciarRonda}>Iniciar Ronda</button>
      )}
    </div>
  );
}

export default App;
