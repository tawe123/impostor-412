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

// 🎲 Lista de 200 jugadores famosos (incluye 20 peruanos)
const jugadoresFamosos = [
  // Leyendas internacionales
  "Pelé", "Maradona", "Zidane", "Ronaldinho", "Ronaldo Nazário", "Cruyff",
  "Beckenbauer", "Baggio", "Platini", "George Best", "Eusebio", "Roberto Carlos",
  "Figo", "Kaka", "Totti", "Maldini", "Gerrard", "Lampard", "Drogba", "Robben",
  "Schweinsteiger", "Puyol", "Ramos", "Buffon", "Ibrahimovic", "Modric", "Xavi",
  "Iniesta", "Lewandowski", "Messi", "Cristiano Ronaldo", "Mbappé", "Neymar",
  "Suárez", "Hazard", "Benzema", "Salah", "Thiago Silva", "Di Maria", "Reus",
  "Griezmann", "Casillas", "Kovacic", "Vinicius", "Busquets", "Kimmich", "Goretzka",
  "Pogba", "De Bruyne", "Haaland", "Sancho", "Sterling", "Foden", "Alexander-Arnold",
  "Manuel Neuer", "Ederson", "Courtois", "Van Dijk", "Kane", "Son Heung-min",
  "Mane", "Alisson", "Rashford", "Kai Havertz", "Chiesa", "Insigne", "Sanches",
  "Dybala", "Phil Foden", "Grealish", "Verratti", "Thiago Alcantara",

  // Jugadores peruanos (20)
  "Teófilo Cubillas", "Paolo Guerrero", "Jefferson Farfán", "Claudio Pizarro",
  "Nolberto Solano", "Roberto Chale", "Héctor Chumpitaz", "Pedro Gallese",
  "Yoshimar Yotún", "Miguel Trauco", "André Carrillo", "Renato Tapia",
  "Christian Cueva", "Luis Advíncula", "Sergio Peña", "Carlos Zambrano",
  "Alexander Callens", "José Carvallo", "Raúl Ruidíaz", "Edison Flores",

  // Más internacionales hasta completar 200
  "Thiago Motta", "Javier Zanetti", "Philipp Lahm", "Oliver Kahn", "Rivaldo",
  "Falcao", "Carlos Tevez", "Ronaldinho Gaúcho", "Roberto Carlos", "Figo",
  "Totti", "Maldini", "Gerrard", "Lampard", "Drogba", "Robben", "Schweinsteiger",
  "Puyol", "Ramos", "Buffon", "Ibrahimovic", "Modric", "Xavi", "Iniesta", "Lewandowski",
  "Messi", "Cristiano Ronaldo", "Mbappé", "Neymar", "Suárez", "Hazard", "Benzema",
  "Salah", "Thiago Silva", "Di Maria", "Reus", "Griezmann", "Casillas", "Kovacic",
  "Vinicius", "Busquets", "Kimmich", "Goretzka", "Pogba", "De Bruyne", "Haaland",
  "Sancho", "Sterling", "Foden", "Alexander-Arnold", "Manuel Neuer", "Ederson",
  "Courtois", "Van Dijk", "Kane", "Son Heung-min", "Mane", "Alisson", "Rashford",
  "Kai Havertz", "Chiesa", "Insigne", "Sanches", "Dybala", "Phil Foden", "Grealish",
  "Verratti", "Thiago Alcantara", "Neymar", "Messi", "Cristiano Ronaldo", "Mbappé",
  "Hazard", "Benzema", "Salah", "Ramos", "Modric", "Xavi", "Iniesta", "Lewandowski",
  "Kimmich", "Goretzka", "Pogba", "De Bruyne", "Haaland", "Sancho", "Sterling",
  "Foden", "Alexander-Arnold", "Manuel Neuer", "Ederson", "Courtois", "Van Dijk",
  "Kane", "Son Heung-min", "Mane", "Alisson", "Rashford", "Kai Havertz", "Chiesa",
  "Insigne", "Sanches", "Dybala", "Phil Foden", "Grealish", "Verratti", "Thiago Alcantara",
  "Ronaldo", "Ronaldinho", "Pelé", "Maradona", "Zidane", "Figo", "Totti", "Baggio",
  "Platini", "Beckenbauer", "Cruyff", "George Best", "Eusebio"
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
