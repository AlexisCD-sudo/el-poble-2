// =====================================================================
// THE FORGOTTEN VILLAGE — LAYOUT DE LA PLAÇA CENTRAL (només dades)
// =====================================================================
// Aquest fitxer NOMÉS conté dades JavaScript planes. No importa Three.js,
// no usa cap API del navegador i no conté cap lògica de dibuix ni de col·lisió.
// Altres fitxers (village.js, collisions.js, el validador) el llegiran.
//
// SISTEMA DE COORDENADES (metres)
//   X positiva = est        Z positiva = sud        Y positiva = amunt
//   Nord = −Z. El terra és a Y = 0.
//   L'origen (0, 0) és el centre de la plaça.
//   yaw = 0 mira cap al nord (−Z), igual que el controlador de main.js.
//
// FORMES (explícites, sempre amb els mateixos noms de camp)
//   Rectangle: { type: 'rect',   xMin, xMax, zMin, zMax }
//   Cercle:    { type: 'circle', cx, cz, radius }
//
// REGLES GENERALS
//   - Visual i col·lisió són dades SEPARADES a cada objecte (camps `visual`
//     i `collision`). Les coordenades es repeteixen a propòsit.
//   - La col·lisió és 2D (pla XZ). Les alçades només són visuals.
//   - Els contactes exactes entre vores són correctes (no són solapaments).
//   - Els murs tenen 0,4 m de gruix i creixen cap a l'EXTERIOR: la cara
//     transitable cau sempre en un nombre enter.
//   - Cada `id` és únic i estable en tot el fitxer (inclosos els sub-objectes).
//
// CASOS ESPECIALS (resumits aquí, detallats a cada objecte)
//   - CH-T (campanar): empremta visual x −7→−3, col·lisió x −7→−4
//     (el tros x −4→−3 ja és dins la nau CH-N).
//   - FNT (font): octàgon visual de 4,0 m de pla a pla; col·lisió circular
//     de radi 2,17 m (cobreix els vèrtexs, que són a 2,165 m).
//   - BR-W: dos barrils visuals amb UN sol rectangle de col·lisió.
//   - HB té un balcó visual a 2,5 m: NO té col·lisió (es passa per sota).
//   - PORTES (D1–D4): taula pròpia (DOORS). Fase 1: visuals, tancades i
//     no enterables. NO creen cap obertura a la col·lisió dels edificis.
//
// DADES ENCARA NO DEFINIDES (no s'han inventat; vegeu l'informe):
//   intensitat/distància/color de les llums puntuals dels fanals, orientació
//   de l'octàgon de la font, radis del pedestal, mides dels esglaons de D1 i
//   posició de la xemeneia de HC.
// =====================================================================

export const LAYOUT_META = {
  name: 'Plaça central',
  version: '1.0',
  units: 'metres',
  groundY: 0,
};

// Plaça: zona oberta de referència (no és un obstacle).
export const PLAZA = {
  id: 'PLAZA',
  bounds: { type: 'rect', xMin: -7, xMax: 7, zMin: -9, zMax: 9 },
};

// ---------------------------------------------------------------------
// EDIFICIS (col·lisió = rectangle sòlid, sense obertures)
// `faces` = costat on dona la façana principal.
// ---------------------------------------------------------------------
export const BUILDINGS = [
  {
    id: 'CH-N',
    name: 'Església, nau',
    faces: 'south',
    visual: {
      footprint: { type: 'rect', xMin: -4, xMax: 4, zMin: -21, zMax: -9 },
      eaveHeight: 7,
      ridgeHeight: 10, // aproximat ("~10" a l'auditoria)
    },
    collision: { type: 'rect', xMin: -4, xMax: 4, zMin: -21, zMax: -9 },
    doorIds: ['D1'],
  },
  {
    id: 'CH-T',
    name: 'Església, campanar',
    faces: 'south',
    visual: {
      footprint: { type: 'rect', xMin: -7, xMax: -3, zMin: -13, zMax: -9 },
      height: 14,
    },
    // Retallada: el tros x −4→−3 ja és dins la col·lisió de CH-N.
    collision: { type: 'rect', xMin: -7, xMax: -4, zMin: -13, zMax: -9 },
    doorIds: [],
  },
  {
    id: 'HA',
    name: 'Casa A',
    faces: 'east',
    visual: {
      footprint: { type: 'rect', xMin: -12, xMax: -7, zMin: -9, zMax: -3 },
      eaveHeight: 5.4,
      ridgeHeight: 7, // aproximat
    },
    collision: { type: 'rect', xMin: -12, xMax: -7, zMin: -9, zMax: -3 },
    doorIds: ['D2'],
  },
  {
    id: 'HB',
    name: 'Casa B (amb balcó)',
    faces: 'west',
    visual: {
      footprint: { type: 'rect', xMin: 7, xMax: 12, zMin: -7, zMax: -1 },
      eaveHeight: 5.4,
      ridgeHeight: 7, // aproximat
      // Balcó de fusta sobre la plaça: només visual, SENSE col·lisió.
      balcony: {
        footprint: { type: 'rect', xMin: 6, xMax: 7, zMin: -6, zMax: -2 },
        undersideY: 2.5, // alçada mínima de la cara inferior
      },
    },
    collision: { type: 'rect', xMin: 7, xMax: 12, zMin: -7, zMax: -1 },
    doorIds: ['D3'],
  },
  {
    id: 'HC',
    name: 'Casa C (al carrer)',
    faces: 'west', // la façana principal dona al carrer d'entrada
    visual: {
      footprint: { type: 'rect', xMin: 2, xMax: 7, zMin: 9, zMax: 15 },
      eaveHeight: 5.4,
      ridgeHeight: 7, // aproximat
    },
    collision: { type: 'rect', xMin: 2, xMax: 7, zMin: 9, zMax: 15 },
    doorIds: ['D4'],
  },
];

// ---------------------------------------------------------------------
// MURS (gruix 0,4 m, alçada 2,8 m). Tots sòlids.
// ---------------------------------------------------------------------
export const WALLS = [
  { id: 'M-N1', name: 'Mur nord, est de l\'església (cara transitable z = −9)',
    visual: { footprint: { type: 'rect', xMin: 4, xMax: 15.4, zMin: -9.4, zMax: -9 }, height: 2.8 },
    collision: { type: 'rect', xMin: 4, xMax: 15.4, zMin: -9.4, zMax: -9 } },
  { id: 'M-E1', name: 'Mur sud del carreró est (cara z = −7)',
    visual: { footprint: { type: 'rect', xMin: 12, xMax: 15.4, zMin: -7, zMax: -6.6 }, height: 2.8 },
    collision: { type: 'rect', xMin: 12, xMax: 15.4, zMin: -7, zMax: -6.6 } },
  { id: 'M-E3', name: 'Final del carreró est (cara x = 15)',
    visual: { footprint: { type: 'rect', xMin: 15, xMax: 15.4, zMin: -9, zMax: -7 }, height: 2.8 },
    collision: { type: 'rect', xMin: 15, xMax: 15.4, zMin: -9, zMax: -7 } },
  { id: 'M-E2', name: 'Mur de jardí, costat est de la plaça (cara x = 7)',
    visual: { footprint: { type: 'rect', xMin: 7, xMax: 7.4, zMin: -1, zMax: 9.4 }, height: 2.8 },
    collision: { type: 'rect', xMin: 7, xMax: 7.4, zMin: -1, zMax: 9.4 } },
  { id: 'M-S1', name: 'Mur sud-oest de la plaça (cara z = 9)',
    visual: { footprint: { type: 'rect', xMin: -7, xMax: -2, zMin: 9, zMax: 9.4 }, height: 2.8 },
    collision: { type: 'rect', xMin: -7, xMax: -2, zMin: 9, zMax: 9.4 } },
  { id: 'M-W2', name: 'Mur de jardí, costat oest de la plaça (cara x = −7)',
    visual: { footprint: { type: 'rect', xMin: -7.4, xMax: -7, zMin: -0.6, zMax: 9.4 }, height: 2.8 },
    collision: { type: 'rect', xMin: -7.4, xMax: -7, zMin: -0.6, zMax: 9.4 } },
  { id: 'M-W1', name: 'Mur sud del carreró oest (cara z = −1)',
    visual: { footprint: { type: 'rect', xMin: -15.4, xMax: -7, zMin: -1, zMax: -0.6 }, height: 2.8 },
    collision: { type: 'rect', xMin: -15.4, xMax: -7, zMin: -1, zMax: -0.6 } },
  { id: 'M-W3', name: 'Mur nord del carreró oest (cara z = −3)',
    visual: { footprint: { type: 'rect', xMin: -15.4, xMax: -12, zMin: -3.4, zMax: -3 }, height: 2.8 },
    collision: { type: 'rect', xMin: -15.4, xMax: -12, zMin: -3.4, zMax: -3 } },
  { id: 'M-W4', name: 'Final del carreró oest (cara x = −15)',
    visual: { footprint: { type: 'rect', xMin: -15.4, xMax: -15, zMin: -3, zMax: -1 }, height: 2.8 },
    collision: { type: 'rect', xMin: -15.4, xMax: -15, zMin: -3, zMax: -1 } },
  { id: 'M-SO', name: 'Paret oest del carrer d\'entrada (cara x = −2)',
    visual: { footprint: { type: 'rect', xMin: -2.4, xMax: -2, zMin: 9.4, zMax: 29.4 }, height: 2.8 },
    collision: { type: 'rect', xMin: -2.4, xMax: -2, zMin: 9.4, zMax: 29.4 } },
  { id: 'M-SE', name: 'Paret est del carrer d\'entrada (cara x = 2)',
    visual: { footprint: { type: 'rect', xMin: 2, xMax: 2.4, zMin: 15, zMax: 29.4 }, height: 2.8 },
    collision: { type: 'rect', xMin: 2, xMax: 2.4, zMin: 15, zMax: 29.4 } },
  { id: 'M-S2', name: 'Final del carrer d\'entrada (cara z = 29)',
    visual: { footprint: { type: 'rect', xMin: -2, xMax: 2, zMin: 29, zMax: 29.4 }, height: 2.8 },
    collision: { type: 'rect', xMin: -2, xMax: 2, zMin: 29, zMax: 29.4 } },
];

// ---------------------------------------------------------------------
// ATREZZO (font, arbre, bancs, barrils, caixes, cartell)
// `visual.height` en metres. `facing` = cap on mira el seient del banc.
// ---------------------------------------------------------------------
export const PROPS = [
  {
    id: 'FNT',
    type: 'fountain',
    name: 'Font de pedra octogonal (sense aigua)',
    visual: {
      center: { x: 0, z: 3 },
      shape: 'octagon',
      acrossFlats: 4.0, // 4 m de pla a pla (radi circumscrit ≈ 2,165)
      height: 1.8,
      basinHeight: 0.6,
    },
    collision: { type: 'circle', cx: 0, cz: 3, radius: 2.17 },
  },
  {
    id: 'ARB',
    type: 'tree',
    name: 'Arbre caducifoli',
    visual: {
      center: { x: -4, z: -2 },
      trunkRadius: 0.3,
      height: 6, // l'ART_GUIDE dona 5–7 m; es fa servir 6
    },
    // Només el tronc col·lisiona; la capçada no.
    collision: { type: 'circle', cx: -4, cz: -2, radius: 0.3 },
  },
  {
    id: 'B1', type: 'bench', name: 'Banc est (esquena al mur M-E2)',
    visual: { footprint: { type: 'rect', xMin: 6.5, xMax: 7.0, zMin: 4.2, zMax: 5.8 }, height: 0.85, seatHeight: 0.45, facing: 'west' },
    collision: { type: 'rect', xMin: 6.5, xMax: 7.0, zMin: 4.2, zMax: 5.8 },
  },
  {
    id: 'B2', type: 'bench', name: 'Banc oest (mira la font)',
    visual: { footprint: { type: 'rect', xMin: -4.85, xMax: -4.35, zMin: 2.2, zMax: 3.8 }, height: 0.85, seatHeight: 0.45, facing: 'east' },
    collision: { type: 'rect', xMin: -4.85, xMax: -4.35, zMin: 2.2, zMax: 3.8 },
  },
  {
    id: 'B3', type: 'bench', name: 'Banc de l\'església (sota el fanal F3)',
    visual: { footprint: { type: 'rect', xMin: 2.0, xMax: 3.6, zMin: -9.0, zMax: -8.5 }, height: 0.85, seatHeight: 0.45, facing: 'south' },
    collision: { type: 'rect', xMin: 2.0, xMax: 3.6, zMin: -9.0, zMax: -8.5 },
  },
  {
    // Cas especial: dos barrils visuals, UN sol col·lisionador rectangular.
    id: 'BR-W',
    type: 'barrelPair',
    name: 'Dos barrils contra el mur oest M-W2',
    visual: {
      barrels: [
        { id: 'BR-W-1', center: { x: -6.7, z: 1.6 }, radius: 0.3, height: 0.9 },
        { id: 'BR-W-2', center: { x: -6.7, z: 2.4 }, radius: 0.3, height: 0.9 },
      ],
    },
    collision: { type: 'rect', xMin: -7.0, xMax: -6.4, zMin: 1.3, zMax: 2.7 },
  },
  {
    id: 'BR3', type: 'barrel', name: 'Barril del carrer (contra M-SO)',
    visual: { center: { x: -1.7, z: 17.0 }, radius: 0.3, height: 0.9 },
    collision: { type: 'circle', cx: -1.7, cz: 17.0, radius: 0.3 },
  },
  {
    id: 'BR4', type: 'barrel', name: 'Barril al final del carreró est (cantonada)',
    visual: { center: { x: 14.7, z: -8.7 }, radius: 0.3, height: 0.9 },
    collision: { type: 'circle', cx: 14.7, cz: -8.7, radius: 0.3 },
  },
  {
    id: 'CR1', type: 'crate', name: 'Caixa a la cantonada sud-est de la plaça',
    visual: { footprint: { type: 'rect', xMin: 6.4, xMax: 7.0, zMin: 8.4, zMax: 9.0 }, height: 0.5 },
    collision: { type: 'rect', xMin: 6.4, xMax: 7.0, zMin: 8.4, zMax: 9.0 },
  },
  {
    id: 'CR2', type: 'crate', name: 'Caixa al final del carreró oest (cantonada)',
    visual: { footprint: { type: 'rect', xMin: -15, xMax: -14.4, zMin: -1.6, zMax: -1.0 }, height: 0.5 },
    collision: { type: 'rect', xMin: -15, xMax: -14.4, zMin: -1.6, zMax: -1.0 },
  },
  {
    id: 'CR3', type: 'crate', name: 'Caixa del carrer (contra M-SE)',
    visual: { footprint: { type: 'rect', xMin: 1.4, xMax: 2.0, zMin: 19.7, zMax: 20.3 }, height: 0.5 },
    collision: { type: 'rect', xMin: 1.4, xMax: 2.0, zMin: 19.7, zMax: 20.3 },
  },
  {
    id: 'CT', type: 'sign', name: 'Cartell d\'entrada del poble',
    visual: { center: { x: 1.8, z: 25.0 }, postRadius: 0.2, height: 2.2 },
    collision: { type: 'circle', cx: 1.8, cz: 25.0, radius: 0.2 },
  },
];

// ---------------------------------------------------------------------
// PORTES — taula independent dels edificis i de la col·lisió.
// Fase 1: totes VISUALS, TANCADES i NO ENTERABLES. Cap porta crea una
// obertura a la col·lisió (`opensCollision: false`).
// `face` = cara de l'edifici on és la porta; `center` és sobre aquesta cara.
// Les portes de casa i els esglaons segueixen l'ART_GUIDE (porta 1,0 × 2,0 m,
// llinda de 1,4 m, 2 esglaons de 0,15 m i 0,6 m de fons). La porta de
// l'església és un arc de mig punt de 2,2 × 3,5 m.
// ---------------------------------------------------------------------
export const DOORS = [
  {
    id: 'D1', buildingId: 'CH-N', face: 'south',
    center: { x: 0, z: -9 },
    width: 2.2, height: 3.5, style: 'arch',
    kind: 'visual', state: 'closed', enterable: false, opensCollision: false,
  },
  {
    id: 'D2', buildingId: 'HA', face: 'east',
    center: { x: -7, z: -6 },
    width: 1.0, height: 2.0, style: 'plank', lintelWidth: 1.4,
    steps: { count: 2, riseEach: 0.15, depth: 0.6, width: 1.4 },
    kind: 'visual', state: 'closed', enterable: false, opensCollision: false,
  },
  {
    id: 'D3', buildingId: 'HB', face: 'west',
    center: { x: 7, z: -4 },
    width: 1.0, height: 2.0, style: 'plank', lintelWidth: 1.4,
    steps: { count: 2, riseEach: 0.15, depth: 0.6, width: 1.4 },
    kind: 'visual', state: 'closed', enterable: false, opensCollision: false,
  },
  {
    id: 'D4', buildingId: 'HC', face: 'west',
    center: { x: 2, z: 12 },
    width: 1.0, height: 2.0, style: 'plank', lintelWidth: 1.4,
    steps: { count: 2, riseEach: 0.15, depth: 0.6, width: 1.4 },
    kind: 'visual', state: 'closed', enterable: false, opensCollision: false,
  },
];

// ---------------------------------------------------------------------
// LLUMS: fanals de ferro forjat (sense col·lisió).
// `wallPoint` = punt on el braç toca la paret; `glassPoint` = posició del
// vidre. `pointLight` indica si, a més del vidre emissiu, porta una llum
// puntual feble (només F1 i F3). Els paràmetres de la llum puntual
// (intensitat, distància) encara no estan definits: es decidiran a la Fase 3.
// ---------------------------------------------------------------------
export const LIGHTS = [
  { id: 'F1', type: 'lantern', mountedOn: 'M-SO',
    wallPoint: { x: -2.0, z: 21.0 }, glassPoint: { x: -1.6, z: 21.0 },
    mountHeight: 2.5, armLength: 0.4, glassColor: 0xe8c98a,
    emissiveGlass: true, pointLight: true },
  { id: 'F2', type: 'lantern', mountedOn: 'HC',
    wallPoint: { x: 2.0, z: 13.5 }, glassPoint: { x: 1.6, z: 13.5 },
    mountHeight: 2.5, armLength: 0.4, glassColor: 0xe8c98a,
    emissiveGlass: true, pointLight: false },
  { id: 'F3', type: 'lantern', mountedOn: 'CH-N',
    wallPoint: { x: 2.6, z: -9.0 }, glassPoint: { x: 2.6, z: -8.6 },
    mountHeight: 2.5, armLength: 0.4, glassColor: 0xe8c98a,
    emissiveGlass: true, pointLight: true },
  { id: 'F4', type: 'lantern', mountedOn: 'HB',
    wallPoint: { x: 7.0, z: -1.5 }, glassPoint: { x: 6.6, z: -1.5 },
    mountHeight: 2.5, armLength: 0.4, glassColor: 0xe8c98a,
    emissiveGlass: true, pointLight: false },
  { id: 'F5', type: 'lantern', mountedOn: 'HA',
    wallPoint: { x: -7.0, z: -4.0 }, glassPoint: { x: -6.6, z: -4.0 },
    mountHeight: 2.5, armLength: 0.4, glassColor: 0xe8c98a,
    emissiveGlass: true, pointLight: false },
];

// ---------------------------------------------------------------------
// JUGADOR (només la configuració del món; la velocitat, l'acceleració i la
// sensibilitat continuen a main.js).
// ---------------------------------------------------------------------
export const PLAYER = {
  id: 'PLAYER',
  start: { x: 0, z: 27 },
  eyeHeight: 1.7,
  collisionRadius: 0.35, // cercle en el pla XZ
  yaw: 0, // radians; 0 = mira cap al nord (−Z)
};
