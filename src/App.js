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
  query,
  where,
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
  const [ronda, setRonda] = useState(1);
  const [juegoTerminado, setJuegoTerminado] = useState(false);

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

  // 🔹 Asignar roles y palabras
  const asignarRoles = async () => {
    const jugadoresActivos = jugadores.filter(j => !j.eliminado);
    if (jugadoresActivos.length !== jugadoresEsperados) {
      alert("Todavía no se conectaron todos los jugadores");
      return;
    }

    const impostorIndex = Math.floor(Math.random() * jugadoresActivos.length);
    const palabraJuego = jugadoresFamosos[Math.floor(Math.random() * jugadoresFamosos.length)];

    const salaRef = doc(db, "rooms", roomId);

    await setDoc(salaRef, {
      palabraJuego,
      impostorId: jugadoresActivos[impostorIndex].id,
      juegoIniciado: true,
      ronda: 1,
    }, { merge: true });

    const updates = jugadoresActivos.map((j, idx) =>
      updateDoc(doc(db, "rooms", roomId, "players", j.id), {
        rol: idx === impostorIndex ? "impostor" : "jugador",
        palabra: idx === impostorIndex ? "IMPOSTOR" : palabraJuego,
        voto: "",
      })
    );
    await Promise.all(updates);
  };

  // 🔹 Votar
  const votar = async (id) => {
    // Verificar si jugador ya votó
    const miInfo = jugadores.find(j => j.nombre === jugadorNombre);
    if (!miInfo || miInfo.voto) {
      alert("Ya votaste en esta ronda");
      return;
    }

    await updateDoc(doc(db, "rooms", roomId, "players", miInfo.id), {
      voto: id,
    });
    setMiPalabra(miInfo.palabra);

    // Revisar si todos los jugadores activos ya votaron
    const jugadoresActivos = jugadores.filter(j => !j.eliminado);
    const votosHechos = jugadoresActivos.filter(j => j.voto && !j.eliminado);
    if (votosHechos.length === jugadoresActivos.length) {
      terminarRonda();
    }
  };

  // 🔹 Terminar ronda
  const terminarRonda = async () => {
    const jugadoresActivos = jugadores.filter(j => !j.eliminado);

    // Contar votos
    const conteoVotos = {};
    jugadoresActivos.forEach(j => {
      if (j.voto) {
        conteoVotos[j.voto] = (conteoVotos[j.voto] || 0) + 1;
      }
    });

    // Encontrar jugador con más votos
    let maxVotos = 0;
    let jugadorEliminadoId = null;
    Object.keys(conteoVotos).forEach(id => {
      if (conteoVotos[id] > maxVotos) {
        maxVotos = conteoVotos[id];
        jugadorEliminadoId = id;
      }
    });

    if (!jugadorEliminadoId) return;

    const jugadorEliminado = jugadores.find(j => j.id === jugadorEliminadoId);

    if (jugadorEliminado.rol === "impostor") {
      alert("¡El impostor fue eliminado! Los demás ganan 🎉");
      setJuegoTerminado(true);
      reiniciarPartida();
      return;
    } else {
      await updateDoc(doc(db, "rooms", roomId, "players", jugadorEliminadoId), {
        eliminado: true,
      });
    }

    // Revisar si quedan solo 2 jugadores → impostor gana
    const activosDespues = jugadores.filter(j => !j.eliminado && j.id !== jugadorEliminadoId);
    if (activosDespues.length <= 2) {
      const impostor = jugadores.find(j => j.rol === "impostor");
      alert(`¡El impostor ${impostor.nombre} gana! 😈`);
      setJuegoTerminado(true);
      reiniciarPartida();
      return;
    }

    // Limpiar votos y aumentar ronda
    const updates = jugadores.map(j =>
      updateDoc(doc(db, "rooms", roomId, "players", j.id), { voto: "" })
    );
    await Promise.all(updates);

    const salaRef = doc(db, "rooms", roomId);
    await updateDoc(salaRef, { ronda: (ronda + 1) });
    setRonda(ronda + 1);
  };

  // 🔹 Reiniciar partida con nueva palabra
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
    setJuegoTerminado(false);
    setRonda(1);
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

      <h3>Ronda: {ronda}</h3>

      <h3>Jugadores en la sala</h3>
      <ul>
        {jugadores.map((j) => (
          <li key={j.id} style={{ textDecoration: j.eliminado ? "line-through" : "none" }}>
            {j.nombre} {j.eliminado && "(eliminado)"} {j.voto && "✅"}
            {!j.eliminado && !juegoTerminado && (
              <button onClick={() => votar(j.id)}>Votar</button>
            )}
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
