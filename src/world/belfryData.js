// =====================================================================
// THE FORGOTTEN VILLAGE — EL SECRET DEL CAMPANAR (Fase F, només dades i geometria pura, sense Three.js)
// =====================================================================
// Fitxer NOU: layout.js no es toca (les seves dades segueixen protegides pels hashes). El campanar 'CH-T' de layout.js conserva l'empremta,
// però el seu obstacle massís es SUBSTITUEIX en carregar (src/player/belfry.js) per parets, escala de cargol i sala de campanes.
//
// COORDENADES: metres; X = est, Z = sud, Y = amunt (com layout.js). Angle de l'escala φ = atan2(z − cz, x − cx) en graus: 0° = est, 90° = sud,
// 180° = oest, 270° = nord. L'escala puja amb φ creixent (est → sud → oest → nord: sentit horari vist des de dalt).
//
// PLANTA DEL CAMPANAR
//   · Parets de 0,4 m. Interior x −6,6 → −4,0 (2,6 m), z −12,6 → −9,4 (3,2 m). L'est és la paret de la nau (1 m de gruix, x −4 → −3).
//   · PORTA: a la paret oest de la nau (cara interior x = −3), a l'alçada del cantó dels bancs: z −11,3 → −10,3 (el banc PEW-W1 acaba a z = −11,4:
//     la fulla, penjada a z = −10,3, mai no el toca). S'obre cap a DINS DE LA NAU, 80°.
//   · ESCALA DE CARGOL: centre (−5,3 ; −10,8), pilar (newel) de radi 0,30, paret exterior de radi 1,30 → graons de 1,0 m de llarg.
//     35 graons de 0,2 m = 7,0 m. 1,75 voltes (630°): 18° per graó, 0,27 m de petjada al mig: estreta i costeruda com una escala medieval.
//   · SALA DE LES CAMPANES: terra a y = 7,0 (nivell 1). El terra cobreix el rectangle MENYS el forat de l'escala (el sector φ 72° → 260°, on la
//     darrera volta puja cap a la sala; allà el cap seria a menys de 1,95 m del forjat). Una barana tanca la vora del forat a φ = 72°.
//   · TRES CAMPANES penjades d'una biga a x = −5,3 (z −12,0 / −10,95 / −9,8). Les cordes baixen per la paret est (x = −4,25).
// =====================================================================

export const BELFRY = {
  id: 'BEL',
  tower: {
    footprint: { xMin: -7, xMax: -4, zMin: -13, zMax: -9 },          // el mateix que CH-T de layout.js (col·lisió; ho comprova una prova)
    wall: 0.4,
    interior: { xMin: -6.6, xMax: -4.0, zMin: -12.6, zMax: -9.4 },
    bodyHeight: 10.4,                                                 // = 14 − 2,8 − 0,8 (village.js: TOWER)
    floorY: 7.0, floorThickness: 0.14,
  },
  // Porta del campanar (a la paret oest de la nau). Pany de bronze amb tres campanes; només s'obre amb KEY-BELLS (que NO es gasta).
  door: {
    id: 'BEL-DOOR', keyId: 'KEY-BELLS', x: -3.0, zMin: -11.3, zMax: -10.3, height: 2.2,
    hinge: { x: -3.02, z: -10.3 }, openDeg: 80, swingSeconds: 2.6,
    leafLength: 0.98, leafHalfThickness: 0.04,
    interactionPoint: { x: -3.0, z: -10.8 }, interact: { maxDistance: 1.8, coneDeg: 60 },
    lock: { y: 1.05, z: -11.05 },                                      // el pany és al costat lliure de la fulla (cara cap a la nau)
  },
  // Escala de cargol.
  stair: {
    cx: -5.3, cz: -10.8, rIn: 0.30, rOut: 1.30, steps: 35, rise: 0.2, turns: 1.75, startDeg: -10,
    landingDeg: 40,                                                   // replà de sortida: el terra del nivell 0 arriba fins a 40° abans del primer graó
    headroom: 1.95,                                                   // espai mínim sota el forjat de la sala
  },
  // Les cordes i les campanes. `order` = ordre de la solució (índexs de `bells`): PETITA → GRAN → MITJANA.
  bells: [
    { id: 'small', name: 'Campana petita', pos: { x: -5.3, z: -12.0 }, radius: 0.23, height: 0.45, freq: 880, rope: { x: -4.25, z: -12.0 } },
    { id: 'large', name: 'Campana gran', pos: { x: -5.3, z: -10.95 }, radius: 0.43, height: 0.95, freq: 196, rope: { x: -4.25, z: -10.95 } },
    { id: 'medium', name: 'Campana mitjana', pos: { x: -5.3, z: -9.8 }, radius: 0.33, height: 0.7, freq: 392, rope: { x: -4.25, z: -9.8 } },
  ],
  solution: ['small', 'large', 'medium'],
  beamY: 9.95,                                                        // biga de les campanes (cara inferior)
  ropeBottomY: 8.35,
  rope: { interact: { maxDistance: 1.15, coneDeg: 110 } },
  idleResetSeconds: 20,                                               // sense tocar res durant aquest temps, la seqüència parcial s'oblida
  resonanceSeconds: 9,
  swing: { seconds: 4.5, maxAmp: 0.32, omega: 5.0 },                  // oscil·lació de la campana (rad, decau exponencialment)
  light: { color: 0x9fb4d8, intensity: 1.4, distance: 7.5, decay: 2, y: 8.6 },
};

// --- Geometria derivada (funcions pures) ---
export const deg = (a) => (a * Math.PI) / 180;
const norm360 = (a) => ((a % 360) + 360) % 360;

export function stairTotalDeg(S = BELFRY.stair) { return S.turns * 360; }
export function stairEndDeg(S = BELFRY.stair) { return S.startDeg + stairTotalDeg(S); }
// Sector del forat (graus, φ creixent): des de l'angle on l'escala deixa de tenir espai lliure sota el forjat fins a l'angle del cim.
export function holeSector(B = BELFRY) {
  const S = B.stair; const total = stairTotalDeg(S); const topY = B.tower.floorY; const H = topY - B.tower.floorThickness - S.headroom;
  const startDeg = stairEndDeg(S) - ((topY - H) / topY) * total;     // a partir d'aquí l'escala és a menys de `headroom` del forjat
  return { fromDeg: norm360(startDeg), toDeg: norm360(stairEndDeg(S)), spanDeg: ((topY - H) / topY) * total };
}
// Punt de la corda `i` i posició d'una campana: dades directes.
export const ropePosition = (i, B = BELFRY) => ({ ...B.bells[i].rope });

// Obstacles (ids propis). `level` només on cal. La porta i les fulles es creen a belfry.js.
const R = (id, xMin, xMax, zMin, zMax, extra = {}) => ({ id, spec: { type: 'rect', xMin, xMax, zMin, zMax }, ...extra });
const Ci = (id, cx, cz, radius, extra = {}) => ({ id, spec: { type: 'circle', cx, cz, radius }, ...extra });

export const BELFRY_COLLIDERS = (() => {
  const f = BELFRY.tower.footprint; const w = BELFRY.tower.wall; const S = BELFRY.stair;
  const out = [
    R('BEL-TW', f.xMin, f.xMin + w, f.zMin, f.zMax),
    R('BEL-TN', f.xMin, f.xMax, f.zMin, f.zMin + w),
    R('BEL-TS', f.xMin, f.xMax, f.zMax - w, f.zMax),
    Ci('BEL-NEWEL', S.cx, S.cz, S.rIn),
  ];
  // Paret exterior de l'escala: anell de cercles (radi 0,3) amb el centre a 1,6 m, tret de l'arc de la porta (±35° al voltant de l'est).
  const N = 32;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 360; const aa = a > 180 ? a - 360 : a;
    if (Math.abs(aa) < 35) continue;
    out.push(Ci(`BEL-RING-${i}`, S.cx + 1.6 * Math.cos(deg(a)), S.cz + 1.6 * Math.sin(deg(a)), 0.3));
  }
  // Mur del replà (nivell 0): a landingDeg° abans del primer graó. Radial, cercles de 0,12 m.
  const lw = S.startDeg - S.landingDeg;
  for (let k = 0; k < 6; k++) { const r = S.rIn + 0.04 + k * 0.2; out.push(Ci(`BEL-LAND-${k}`, S.cx + r * Math.cos(deg(lw)), S.cz + r * Math.sin(deg(lw)), 0.12, { level: 0 })); }
  // Barana de la vora del forat (nivell 1): a la vora «tancada» del sector (φ = fromDeg).
  const hs = holeSector();
  for (let k = 0; k < 6; k++) { const r = S.rIn + 0.04 + k * 0.2; out.push(Ci(`BEL-RAIL-${k}`, S.cx + r * Math.cos(deg(hs.fromDeg)), S.cz + r * Math.sin(deg(hs.fromDeg)), 0.12, { level: 1 })); }
  return out;
})();

// Parts de la paret oest de la nau que se substitueixen per deixar el pas de la porta (CH-N-W de layout.js: x −4 → −3, z −20,4 → −9,6).
export const NAVE_WEST_WALL_ID = 'CH-N-W';
export const NAVE_WEST_WALL_PIECES = [
  R('CH-N-W-A', -4, -3, -20.4, BELFRY.door.zMin),
  R('CH-N-W-B', -4, -3, BELFRY.door.zMax, -9.6),
];
// El bloc massís del campanar que se substitueix.
export const TOWER_SOLID_ID = 'CH-T';
// Mentre la porta és tancada, el pas és ple: una llosa de fusta dins del gruix de la paret.
export const DOOR_CLOSED_COLLIDER = R('BEL-DOOR', -3.12, -3.0, BELFRY.door.zMin, BELFRY.door.zMax);

// Sons i textos (català, sense xifres: la font Pixel Monastery Script les escriu en romans i no té el zero).
export const BELFRY_TEXT = {
  doorLocked: 'La porta del campanar és de roure fosc, amb un pany de bronze: tres campanes en relleu. No cedeix. Caldria la clau que reposava al mausoleu.',
  doorOpen: 'La clau de les tres campanes gira sense esforç. El pany, de bronze, cruix i la porta s\'obre cap a la nau. Darrere, una escala de cargol puja a la foscor.',
  ropeHint: 'E - estirar la corda',
  wrong: 'La campana sona fora de to. Un silenci pesat, i el so s\'esvaeix.',
  step: 'Una campana respon. Un so net, que es perd poble enllà.',
  solved: 'Les tres campanes ressonen alhora, greus, i el so travessa el poble. A les profunditats, alguna cosa antiga es desperta.',
  afterSolved: 'Les campanes callen, però el so encara és a l\'aire.',
};
