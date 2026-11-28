// =====================================================================
// THE FORGOTTEN VILLAGE — MAUSOLEU: INTERIOR, MECANISME DE LES LLOSES I CAMBRA SECRETA (Fase E, només dades)
// =====================================================================
// Aquest fitxer és NOU i no toca layout.js (les seves dades segueixen protegides pels hashes): el mausoleu 'MAU' de layout.js conserva la
// seva empremta, però el seu obstacle massís es SUBSTITUEIX en carregar (src/player/mausoleum.js) per les parets, la porta i la cambra d'aquí.
//
// PLANTA (X cap a l'est, Z cap al sud; façana i porta a la cara sud, z = −29,2):
//   · Parets de 0,4 m. Interior x 12,9–17,1, z −33,6–−29,6, sostre a 3,3 m.
//   · SALA (z −31,6 → −29,6): s'hi entra per la porta de roure (s'obre amb KEY-C). El MECANISME és incrustat a la paret OEST.
//   · Envà de 0,2 m (z −31,8 → −31,6) amb la PORTA SECRETA a l'extrem est (x 16,0–17,1): una llosa que s'enfonsa al terra en resoldre el puzle.
//   · CAMBRA (z −33,6 → −31,8): pedestal amb la clau de bronze.
// MECANISME: mirant la paret de cara (cap a l'oest), l'ESQUERRA del tauler és al SUD (z gran) i la dreta al nord.
// =====================================================================

export const MAUSOLEUM = {
  id: 'MAU',
  footprint: { xMin: 12.5, xMax: 17.5, zMin: -34, zMax: -29.2 },   // idèntic al de layout.js (ho comprova una prova)
  height: 3.3,
  interior: { xMin: 12.9, xMax: 17.1, zMin: -33.6, zMax: -29.6 },
  hall: { zMin: -31.6, zMax: -29.6 },
  chamber: { zMin: -33.6, zMax: -31.8 },
  partition: { zMin: -31.8, zMax: -31.6 },

  // Porta exterior (roure). S'obre cap a FORA (sud) al voltant de la frontissa de l'oest: així la fulla no tapa el tauler de la paret oest de la sala.
  door: {
    id: 'MAU-DOOR', keyId: 'KEY-C', x0: 14.3, x1: 15.7, zMin: -29.6, zMax: -29.2, top: 2.3,
    hinge: { x: 14.3, z: -29.4 }, openDeg: 90, swingSeconds: 3.5,
    interactionPoint: { x: 15.0, z: -29.1 }, interact: { maxDistance: 2.0, coneDeg: 60 },
  },

  // Porta secreta lateral (envà): llosa que s'enfonsa `sinkDepth` m en `sinkSeconds` s.
  secret: { id: 'MAU-SECRET', x0: 16.0, x1: 17.1, zMin: -31.8, zMax: -31.6, top: 2.3, sinkDepth: 2.4, sinkSeconds: 5 },

  // Tauler incrustat a la paret oest (cara visible cap a l'est). Cel·la (fila, columna): fila 0 dalt; columna 0 a l'ESQUERRA de qui el mira (sud).
  board: {
    id: 'MAU-SLABS', x: 12.9, zc: -30.6, yc: 1.45, pitch: 0.4, slab: 0.38, depth: 0.07,
    interactionPoint: { x: 12.95, z: -30.6 }, interact: { maxDistance: 2.6, coneDeg: 90 },
    // Vista de prop: la càmera es col·loca davant del tauler i el mira de cara (cap a l'oest). yaw = π/2 (mirant −X).
    view: { x: 14.25, y: 1.38, z: -30.6, yaw: Math.PI / 2, pitch: 0, seconds: 0.7 },
  },

  // Pedestal de la cambra amb la clau.
  pedestal: { id: 'MAU-KEY', x: 15.0, z: -32.7, size: 0.5, height: 1.0, interactionPoint: { x: 15.0, z: -32.7 }, interact: { maxDistance: 1.7, coneDeg: 120 } },

  // Una sola llum puntual (com la cripta): freda a la sala i càlida a la cambra. Només s'encén amb el jugador a prop (main.js).
  light: { color: 0xc9b48a, intensity: 1.5, distance: 8.5, decay: 2, hall: { x: 15.0, y: 2.5, z: -30.6 }, chamber: { x: 15.0, y: 2.3, z: -32.7 } },

  // Clau de bronze (NO és a KEYS, ni és KEY-C: id propi). El símbol 'bells3' és al mapa de símbols de src/world/cryptSymbols.js.
  key: {
    id: 'KEY-BELLS', name: 'Clau de les tres campanes', material: 'bronze', symbol: 'bells3',
    description: 'Una clau de bronze, greu i freda, amb tres campanes petites gravades a l\'anella. Reposava sobre un pedestal que ningú no havia tocat en segles. A l\'església, una porta baixa sota el campanar sembla esperar-la.',
  },
};

// Obstacles (ids propis; la resta del joc no els coneix). `closedUntil` indica quin element els deshabilita.
const R = (id, xMin, xMax, zMin, zMax, closedUntil) => ({ id, spec: { type: 'rect', xMin, xMax, zMin, zMax }, closedUntil });
export const MAUSOLEUM_COLLIDERS = (() => {
  const f = MAUSOLEUM.footprint; const d = MAUSOLEUM.door; const w = MAUSOLEUM.interior; const p = MAUSOLEUM.partition; const s = MAUSOLEUM.secret;
  return [
    R('MAU-W', f.xMin, w.xMin, f.zMin, f.zMax), R('MAU-E', w.xMax, f.xMax, f.zMin, f.zMax), R('MAU-N', f.xMin, f.xMax, f.zMin, w.zMin),
    R('MAU-SL', f.xMin, d.x0, d.zMin, d.zMax), R('MAU-SR', d.x1, f.xMax, d.zMin, d.zMax),
    R('MAU-DOOR', d.x0, d.x1, d.zMin, d.zMax, 'door'),
    R('MAU-LEAF', d.hinge.x - 0.05, d.hinge.x + 0.05, d.zMax, d.hinge.z + 1.4, 'leaf'),   // la fulla oberta (perpendicular a la façana, a FORA: no tapa el tauler de la sala)
    R('MAU-PART', w.xMin, s.x0, p.zMin, p.zMax), R('MAU-SECRET', s.x0, s.x1, p.zMin, p.zMax, 'secret'),
  ];
})();
export const MAUSOLEUM_PEDESTAL_COLLIDER = { id: 'MAU-PEDESTAL', spec: { type: 'circle', cx: MAUSOLEUM.pedestal.x, cz: MAUSOLEUM.pedestal.z, radius: 0.36 } };

// ---------------------------------------------------------------------
// TRENCACLOSQUES: tauler inicial trobat per cerca exhaustiva (tools/slab-board-search.js) i verificat a tools/test-fase-e.js.
// Recorregut previst (una de les 36 solucions): caselles 0-1-4-3-6-7-8. Les lloses 0, 6 i 7 són rectes iguals (E-O): per això hi ha diverses solucions.
// ---------------------------------------------------------------------
export const SLAB_PUZZLE = {
  tiles: [
    { id: 0, channels: 'EW' },
    { id: 1, channels: 'SW', symbol: 'bell' },
    { id: 2, channels: 'NW' },
    { id: 3, channels: 'ES', symbol: 'moon' },
    { id: 4, channels: 'NE' },
    { id: 5, channels: 'EW', symbol: 'cross' },
    { id: 6, channels: 'EW' },
    { id: 7, channels: 'EW' },
  ],
  start: [5, 0, 4, 3, 6, -1, 2, 7, 1],
  entry: { cell: 0, side: 'W' },     // el canal d'entrada és a l'esquerra de la casella de dalt a l'esquerra
  exit: { cell: 8, side: 'E' },      // i el de sortida, a la dreta de la de baix a la dreta
  symbols: ['bell', 'moon', 'cross'],
};
export const SLAB_MECH = { litSeconds: 0.45 };
