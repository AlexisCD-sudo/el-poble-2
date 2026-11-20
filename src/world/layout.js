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
//   - CH-N (nau de l'església, FASE A): ja NO és un bloc sòlid. La seva
//     `collision` és una LLISTA de 5 rectangles (parets E i W, paret del
//     fons i dos trams de façana a banda i banda de D1). L'interior
//     (visual.interior.footprint, 6 × 10,8 m) i l'obertura de D1 (2,2 m)
//     queden lliures. Les parets laterals fan 1 m (la torre és adossada
//     a l'oest) i façana/fons 0,6 m.
//   - PORTES (D2–D4): visuals, tancades i no enterables. NO creen cap
//     obertura a la col·lisió dels edificis. D1 (església) és OBERTA i
//     enterable: l'obertura és el buit entre CH-N-FW i CH-N-FE.
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
      // Interior accessible (Fase A): espai lliure de la nau, entre les parets.
      // Gruixos: oest/est 1,0 m (x −4→−3 i 3→4: el campanar és adossat a l'oest),
      // façana sud 0,6 m (z −9,6→−9) i paret del fons 0,6 m (z −21→−20,4).
      interior: {
        footprint: { type: 'rect', xMin: -3, xMax: 3, zMin: -20.4, zMax: -9.6 },
      },
    },
    // COL·LISIÓ COMPOSTA (llista de rectangles, cada un amb el seu `id`).
    // Junts cobreixen l'empremta (8 × 12) MENYS l'interior i MENYS el pas de
    // D1 (x −1,1→1,1 a la façana sud). Es toquen per les vores, sense solapar-se.
    collision: [
      { id: 'CH-N-W', type: 'rect', xMin: -4, xMax: -3, zMin: -20.4, zMax: -9.6 },   // paret oest
      { id: 'CH-N-E', type: 'rect', xMin: 3, xMax: 4, zMin: -20.4, zMax: -9.6 },     // paret est
      { id: 'CH-N-B', type: 'rect', xMin: -4, xMax: 4, zMin: -21, zMax: -20.4 },     // paret del fons
      { id: 'CH-N-FW', type: 'rect', xMin: -4, xMax: -1.1, zMin: -9.6, zMax: -9 },   // façana, a l'oest de D1
      { id: 'CH-N-FE', type: 'rect', xMin: 1.1, xMax: 4, zMin: -9.6, zMax: -9 },     // façana, a l'est de D1
    ],
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
      // Interior accessible (Fase B): parets de 0,4 m. Un sol ambient (sostre a 2,75 m).
      interior: { footprint: { type: 'rect', xMin: -11.6, xMax: -7.4, zMin: -8.6, zMax: -3.4 }, ceilingY: 2.75 },
    },
    // COL·LISIÓ COMPOSTA: empremta − interior − pas de D2 (z −6,6 → −5,4 a la paret est).
    collision: [
      { id: 'HA-W', type: 'rect', xMin: -12, xMax: -11.6, zMin: -9, zMax: -3 },
      { id: 'HA-N', type: 'rect', xMin: -11.6, xMax: -7, zMin: -9, zMax: -8.6 },
      { id: 'HA-S', type: 'rect', xMin: -11.6, xMax: -7, zMin: -3.4, zMax: -3 },
      { id: 'HA-EN', type: 'rect', xMin: -7.4, xMax: -7, zMin: -8.6, zMax: -6.6 },
      { id: 'HA-ES', type: 'rect', xMin: -7.4, xMax: -7, zMin: -5.4, zMax: -3.4 },
    ],
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
      // Interior accessible (Fase B): parets de 0,4 m.
      interior: { footprint: { type: 'rect', xMin: 7.4, xMax: 11.6, zMin: -6.6, zMax: -1.4 }, ceilingY: 2.75 },
      // Balcó de fusta sobre la plaça: només visual, SENSE col·lisió.
      balcony: {
        footprint: { type: 'rect', xMin: 6, xMax: 7, zMin: -6, zMax: -2 },
        undersideY: 2.5, // alçada mínima de la cara inferior
      },
    },
    // COL·LISIÓ COMPOSTA: empremta − interior − pas de D3 (z −4,6 → −3,4 a la paret oest).
    collision: [
      { id: 'HB-E', type: 'rect', xMin: 11.6, xMax: 12, zMin: -7, zMax: -1 },
      { id: 'HB-N', type: 'rect', xMin: 7, xMax: 11.6, zMin: -7, zMax: -6.6 },
      { id: 'HB-S', type: 'rect', xMin: 7, xMax: 11.6, zMin: -1.4, zMax: -1 },
      { id: 'HB-WN', type: 'rect', xMin: 7, xMax: 7.4, zMin: -6.6, zMax: -4.6 },
      { id: 'HB-WS', type: 'rect', xMin: 7, xMax: 7.4, zMin: -3.4, zMax: -1.4 },
    ],
    doorIds: ['D3'],
  },
  {
    id: 'HC',
    name: 'Casa C (casa gran del carrer d\'entrada)',
    faces: 'west', // la façana principal dona al carrer d'entrada
    visual: {
      footprint: { type: 'rect', xMin: 2, xMax: 7, zMin: 9, zMax: 15 },
      eaveHeight: 5.4,
      ridgeHeight: 7, // aproximat
      // Interior accessible (Fase C): parets de 0,4 m, planta baixa (sostre a 2,65 m: el forjat del pis fa 0,1 m)
      // i pis superior (terra a 2,75 m, sostre a 5,3 m). L'escala puja per la banda est (vegeu FLOORS).
      interior: {
        footprint: { type: 'rect', xMin: 2.4, xMax: 6.6, zMin: 9.4, zMax: 14.6 },
        ceilingY: 2.65,
        upper: { floorY: 2.75, ceilingY: 5.3 },
      },
    },
    // COL·LISIÓ COMPOSTA: empremta − interior − pas de D4 (z 11,5 → 12,5 a la paret oest). Igual que HA i HB.
    collision: [
      { id: 'HC-E', type: 'rect', xMin: 6.6, xMax: 7, zMin: 9, zMax: 15 },
      { id: 'HC-N', type: 'rect', xMin: 2.4, xMax: 6.6, zMin: 9, zMax: 9.4 },
      { id: 'HC-S', type: 'rect', xMin: 2.4, xMax: 6.6, zMin: 14.6, zMax: 15 },
      { id: 'HC-WN', type: 'rect', xMin: 2, xMax: 2.4, zMin: 9, zMax: 11.5 },
      { id: 'HC-WS', type: 'rect', xMin: 2, xMax: 2.4, zMin: 12.5, zMax: 15 },
    ],
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
// D2–D4 (cases): VISUALS, TANCADES i NO ENTERABLES (`opensCollision: false`).
// D1 (església, Fase A): OBERTA i ENTERABLE (`state: 'open'`, `enterable: true`,
// `opensCollision: true`): el pas és el buit de 2,2 m entre CH-N-FW i CH-N-FE.
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
    kind: 'visual', state: 'open', enterable: true, opensCollision: true,
    // Porta FÍSICA de dues fulles de fusta (Fase A2). Cada fulla gira sobre una frontissa vertical,
    // col·locada davant del bastiment de fusta, DINS de la nau (la porta s'obre cap a dins):
    //   hingeX/hingeZ  eix de la frontissa de cada fulla: (−hingeX, hingeZ) l'oest i (+hingeX, hingeZ) l'est;
    //   leafLength     de la frontissa al cantell lliure (tancada: 2,32 m en total, 2 cm de junta al mig);
    //   leafThickness  gruix visual; collisionHalfThickness = meitat del gruix de la col·lisió (càpsula);
    //   angles (graus) 0 = tancada (les dues fulles tapen el pas), 170 = oberta contra la paret interior;
    //   initialAngleDeg  0 = les dues fulles COMENCEN TANCADES (Fase D.3.1); s'obren amb E;
    //   openTargetDeg    angle on porta la tecla E en obrir;
    //   maxPushSpeed     velocitat angular màxima (rad/s) amb què el jugador pot empènyer una fulla;
    //   smoothTime/maxSpeed  animació suau amb E (temps de suavitzat en s i velocitat màxima en rad/s);
    //   interactDistance   distància (m) al centre de la porta per poder-hi interactuar amb E.
    // A qualsevol angle les fulles queden dins la nau (z < −9,6): no toquen mai les parets de la façana.
    swing: {
      hingeX: 1.17, hingeZ: -9.705, leafLength: 1.16,
      leafThickness: 0.09, collisionHalfThickness: 0.05,
      minAngleDeg: 0, maxAngleDeg: 170, initialAngleDeg: 0, openTargetDeg: 165,
      maxPushSpeed: 4.5, smoothTime: 0.4, maxSpeed: 3.0,
      interactDistance: 3.2,
    },
  },
  // PORTES DE CASA (Fase C): una fulla de fusta que COMENÇA TANCADA i s'obre amb E cap a DINS de la casa.
  //   hinge      jamba on és la frontissa, en coordenades de món ('zMin' = costat nord, 'zMax' = costat sud);
  //   openDeg    angle d'obertura màxim (graus); smoothTime / maxSpeed  animació suau (s, rad/s);
  //   interactDistance  distància (m) al centre del pas per prémer E.
  //   block      rectangle de col·lisió que tanca el pas mentre la fulla és tancada (tot el gruix de la paret).
  // Obertes, la fulla queda contra la paret interior, fora del pas; la col·lisió del pas desapareix.
  {
    id: 'D2', buildingId: 'HA', face: 'east',
    center: { x: -7, z: -6 },
    width: 1.2, height: 2.0, style: 'plank', lintelWidth: 1.6,
    kind: 'visual', state: 'closed', enterable: true, opensCollision: true,
    house: { hinge: 'zMin', openDeg: 90, smoothTime: 0.28, maxSpeed: 4.5, interactDistance: 1.8,
      block: { type: 'rect', xMin: -7.4, xMax: -7, zMin: -6.6, zMax: -5.4 } },
  },
  {
    id: 'D3', buildingId: 'HB', face: 'west',
    center: { x: 7, z: -4 },
    width: 1.2, height: 2.0, style: 'plank', lintelWidth: 1.6,
    kind: 'visual', state: 'closed', enterable: true, opensCollision: true,
    house: { hinge: 'zMax', openDeg: 90, smoothTime: 0.28, maxSpeed: 4.5, interactDistance: 1.8,
      block: { type: 'rect', xMin: 7, xMax: 7.4, zMin: -4.6, zMax: -3.4 } },
  },
  {
    id: 'D4', buildingId: 'HC', face: 'west',
    center: { x: 2, z: 12 },
    // Fase C: sense esglaons (el llindar queda a ras de terra, com a D2 i D3) perquè el jugador hi entra caminant.
    width: 1.0, height: 2.0, style: 'plank', lintelWidth: 1.4,
    kind: 'visual', state: 'closed', enterable: true, opensCollision: true,
    house: { hinge: 'zMin', openDeg: 90, smoothTime: 0.28, maxSpeed: 4.5, interactDistance: 1.8,
      block: { type: 'rect', xMin: 2, xMax: 2.4, zMin: 11.5, zMax: 12.5 } },
  },
];

// ---------------------------------------------------------------------
// MOBLES D'INTERIOR (Fase B). Col·lisió = rectangle (igual que el visual).
// REGLA: dos mobles que es miren han d'estar tocant-se o a ≥ 1,2 m (ho valida
// tools/validate-layout.js), i el passadís central de l'església queda lliure.
//   pew    banc de l'església · altar  altar de pedra · dresser  còmoda amb calaix (clau A)
//   cabinet armari baix · table taula · crate caixa · bed llit · chest arca amb tapa (clau B)
// `faces` = costat on mira el davant del moble (calaix, seient...).
// ---------------------------------------------------------------------
const pewRow = (side, k) => {
  const zMax = -11.4 - 1.8 * k; // files separades 1,8 m (banc de 0,55 m + 1,25 m lliures)
  const r = side < 0 ? { xMin: -3, xMax: -1.6 } : { xMin: 1.6, xMax: 3 };
  const fp = { type: 'rect', ...r, zMin: zMax - 0.55, zMax };
  return { id: `PEW-${side < 0 ? 'W' : 'E'}${k + 1}`, type: 'pew', buildingId: 'CH-N', name: 'Banc de fusta fosca', faces: 'north',
    visual: { footprint: fp, height: 0.95 }, collision: { ...fp } };
};
// `extra`: level (0 = planta baixa, 1 = pis superior; sense nivell = actiu a tots dos), soft (cadires i tamborets:
// col·lisionen però no compten per a la regla de passos estrets), head (capçal del llit).
const furn = (id, type, buildingId, name, faces, xMin, xMax, zMin, zMax, height, extra = {}) => {
  const fp = { type: 'rect', xMin, xMax, zMin, zMax };
  return { id, type, buildingId, name, faces, visual: { footprint: fp, height }, collision: { ...fp }, ...extra };
};
export const FURNITURE = [
  ...[0, 1, 2, 3].flatMap((k) => [pewRow(-1, k), pewRow(1, k)]),
  // Altar a 1,25 m de la paret del fons: es pot caminar per darrere i per les bandes fins a la porta secreta.
  furn('ALT', 'altar', 'CH-N', 'Altar de pedra', 'south', -0.9, 0.9, -19.15, -18.45, 1.0),
  // Casa A (interior x −11,6→−7,4, z −8,6→−3,4; porta a l'est, carril central z −6 lliure).
  furn('A-DRS', 'dresser', 'HA', 'Còmoda amb calaix', 'south', -11.6, -10.4, -8.6, -8.1, 0.95),
  furn('A-CAB', 'cabinet', 'HA', 'Armari baix', 'east', -11.6, -11.1, -4.8, -3.4, 1.3),
  furn('A-TAB', 'table', 'HA', 'Taula', 'north', -9.85, -8.65, -4.2, -3.4, 0.8),
  furn('A-CRT', 'crate', 'HA', 'Caixa vella', 'south', -8.3, -7.4, -8.6, -7.8, 0.6),
  // Casa B (interior x 7,4→11,6, z −6,6→−1,4; porta a l'oest, carril central z −4 lliure).
  furn('B-BED', 'bed', 'HB', 'Llit', 'south', 7.4, 9.4, -6.6, -5.6, 0.6),
  furn('B-CHS', 'chest', 'HB', 'Arca antiga', 'west', 10.9, 11.6, -4.7, -3.3, 0.7),
  furn('B-CAB', 'cabinet', 'HB', 'Armari baix', 'north', 8.65, 9.85, -1.9, -1.4, 1.3),
  // Casa B (Fase C): escriptori i prestatgeria per a més espelmes. Passos ≥ 1,2 m amb el llit i l'arca.
  furn('B-TAB', 'table', 'HB', 'Escriptori', 'south', 10.6, 11.6, -6.6, -5.95, 0.8),
  furn('B-SHELF', 'shelf', 'HB', 'Aparador', 'north', 9.85, 11.6, -1.8, -1.4, 0.9),
  // Casa A (Fase C): prestatgeria al costat de la taula (cara sud).
  furn('A-SHELF', 'shelf', 'HA', 'Aparador', 'north', -8.65, -7.4, -3.8, -3.4, 0.9),
  // ---- CASA C (Fase C): la casa gran del carrer d'entrada. Interior x 2,4→6,6, z 9,4→14,6; porta D4 a l'oest (z 11,5→12,5).
  // Planta baixa (level 0): rebedor (arca i banc al costat de la porta), sala principal amb taula gran i cadires,
  // cuina al nord (armari i prestatgeria) i rebost sota l'escala (barrils i sacs, a la banda nord-est).
  furn('C-COFFER', 'coffer', 'HC', 'Arca de la família', 'east', 2.4, 2.9, 9.4, 10.4, 0.7, { level: 0 }),
  furn('C-CAB1', 'cabinet', 'HC', 'Aparador de la cuina', 'south', 2.9, 3.9, 9.4, 9.95, 0.95, { level: 0 }),
  furn('C-SHELF', 'shelf', 'HC', 'Prestatgeria', 'south', 3.9, 5.32, 9.4, 9.8, 1.9, { level: 0 }),
  furn('C-STORE', 'store', 'HC', 'Rebost: barrils i sacs', 'west', 5.32, 6.6, 9.4, 10.9, 1.2, { level: 0 }),
  furn('C-TABLE', 'table', 'HC', 'Taula gran', 'south', 3.4, 4.4, 11.3, 12.7, 0.8, { level: 0 }),
  furn('C-CH1', 'chair', 'HC', 'Cadira', 'south', 3.45, 3.85, 10.85, 11.3, 0.9, { level: 0, soft: true }),
  furn('C-DRS', 'dresser2', 'HC', 'Calaixera', 'north', 2.4, 3.6, 14.1, 14.6, 0.95, { level: 0 }),
  furn('C-CAB2', 'cabinet', 'HC', 'Armari de roba', 'north', 3.6, 4.3, 14.1, 14.6, 1.9, { level: 0 }),
  // Pis superior (level 1): dormitori de la família. Terra a y = 2,75; res no tapa les finestres (llindar a 3,55 m).
  furn('C-U-BED', 'bed2', 'HC', 'Llit de la família', 'south', 2.4, 3.9, 12.65, 14.6, 0.6, { level: 1, head: 'south' }),
  furn('C-U-NIGHT', 'nightstand', 'HC', 'Tauleta de nit', 'south', 3.9, 4.4, 14.0, 14.6, 0.55, { level: 1 }),
  furn('C-U-WARD', 'wardrobe', 'HC', 'Armari gran', 'north', 4.4, 5.32, 14.0, 14.6, 2.1, { level: 1 }),
  furn('C-U-DRS', 'dresser2', 'HC', 'Calaixera', 'south', 2.4, 3.6, 9.4, 9.95, 0.8, { level: 1 }),
];

// ---------------------------------------------------------------------
// PISOS I ESCALES (Fase C). El jugador camina sempre sobre un "terra" que depèn del nivell on és:
//   nivell 0 = planta baixa (y = 0), nivell 1 = pis superior (y = floorY). Els obstacles poden dur `level`.
//   levelSplit    alçada del terra a partir de la qual el jugador és al nivell 1 (a mig escala).
//   slabs         terra del pis superior: rectangle (interior de la casa) i els `holes` (forat de l'escala).
//   stairs        escala recta: el terra puja linealment pel rectangle `rect` en la direcció `dir` (±1) de l'eix
//                 `axis`, des de `start` (peu, y = rise) fins a `start + dir·run` (cim, y = floorY). `rise` = alçada
//                 d'un graó (13 contrahuells de 0,2115 m i 12 petjades de 0,26 m: 39°, escala medieval).
// ---------------------------------------------------------------------
export const FLOORS = {
  levelSplit: 1.4,
  slabs: [
    { id: 'HC-UP', buildingId: 'HC', y: 2.75,
      rect: { xMin: 2.4, xMax: 6.6, zMin: 9.4, zMax: 14.6 },
      holes: [{ xMin: 5.42, xMax: 6.6, zMin: 10.18, zMax: 14.6 }] },
  ],
  stairs: [
    { id: 'HC-ST', buildingId: 'HC', rect: { xMin: 5.42, xMax: 6.6, zMin: 10.18, zMax: 13.3 },
      axis: 'z', dir: -1, start: 13.3, run: 3.12, rise: 2.75 / 13, tread: 0.26, floorY: 2.75, treads: 12 },
  ],
};
// Obstacles de l'escala (no són mobles): la barana/estringa del costat oest i el rebost que tanca el cim a la planta baixa.
export const STAIRS = [
  { id: 'HC-ST', buildingId: 'HC', name: 'Escala de fusta de la casa C',
    collision: [
      { id: 'HC-STR', type: 'rect', xMin: 5.32, xMax: 5.42, zMin: 10.9, zMax: 13.3 },              // estringa: tots dos nivells
      { id: 'HC-RAIL', type: 'rect', xMin: 5.32, xMax: 5.42, zMin: 13.3, zMax: 14.6, level: 1 },    // barana del forat (pis superior)
    ] },
];

// ---------------------------------------------------------------------
// ESPELMES (Fase C): base de l'espelma (y = superfície on descansa). Dins de l'interior de la casa.
// `on` = moble on descansa (o 'wall' = cadell de ferro a la paret). Cada una té una flama visible (emissiva).
// ---------------------------------------------------------------------
export const CANDLES = [
  // Fase C.1: només unes poques espelmes per casa (ambient de terror: petites zones càlides envoltades de foscor).
  // Casa A
  { id: 'CA1', buildingId: 'HA', on: 'A-DRS', x: -10.7, y: 0.95, z: -8.35 },
  { id: 'CA3', buildingId: 'HA', on: 'A-TAB', x: -9.25, y: 0.8, z: -3.8 },
  { id: 'CA7', buildingId: 'HA', on: 'wall', x: -9.5, y: 1.75, z: -8.52 },
  // Casa B
  { id: 'CB2', buildingId: 'HB', on: 'B-TAB', x: 11.0, y: 0.8, z: -6.3 },
  { id: 'CB4', buildingId: 'HB', on: 'B-SHELF', x: 10.4, y: 0.94, z: -1.6 },
  { id: 'CB7', buildingId: 'HB', on: 'wall', x: 9.5, y: 1.75, z: -6.52 },
  // Casa C, planta baixa (a més del canelobre penjat sobre la taula, de 2 ciris)
  { id: 'CC4', buildingId: 'HC', on: 'C-CAB1', x: 3.4, y: 0.99, z: 9.7 },
  { id: 'CC6', buildingId: 'HC', on: 'C-DRS', x: 3.45, y: 0.95, z: 14.3 },
  // Casa C, pis superior (y absoluta)
  { id: 'CC9', buildingId: 'HC', on: 'C-U-NIGHT', x: 4.15, y: 3.3, z: 14.35, level: 1 },
  { id: 'CC11', buildingId: 'HC', on: 'wall', x: 4.7, y: 4.4, z: 9.47, level: 1 },
];
// Llums puntuals càlides dels interiors: UNA per estança, amb radi petit (distance ≈ 3 m) i intensitat baixa, a l'alçada
// d'una espelma: creen una petita zona càlida i deixen les cantonades fosques. Les altres flames són només emissives (sprites).
// La llum de dalt (HC1) queda a més de `distance` de la planta baixa i la de baix a més de `distance` del terra de dalt.
export const INTERIOR_LIGHTS = [
  { id: 'L-HA', buildingId: 'HA', x: -9.5, y: 1.1, z: -5.3, intensity: 1.5, distance: 2.9 },
  { id: 'L-HB', buildingId: 'HB', x: 10.2, y: 1.2, z: -2.4, intensity: 1.5, distance: 2.9 },
  { id: 'L-HC0', buildingId: 'HC', x: 4.1, y: 1.6, z: 12.0, intensity: 1.6, distance: 2.9 },
  { id: 'L-HC1', buildingId: 'HC', x: 4.1, y: 3.7, z: 13.6, intensity: 1.4, distance: 2.7 },
];

// ---------------------------------------------------------------------
// TERANYINES (Fase C.2): decals plans ENGANXATS a parets, sostre i a la part de dalt dels mobles (mai en suspensió).
// Cada teranyina és un grup de rectangles (`quads`) que comparteixen vèrtex (la cantonada). Un quad = origen `o`, dos eixos unitaris
// `a` (longitud `sa`) i `b` (longitud `sb`) i la normal `n` cap a l'interior de l'estança (es desplaça 1,2 cm per no fer z-fighting).
// `variant` (0, 1, 2) tria el dibuix de l'atles de textura; `flip` el reflecteix. Selectives: unes poques per casa.
// ---------------------------------------------------------------------
const cwBuilding = (id) => BUILDINGS.find((b) => b.id === id);
// Cantonada alta (paret–paret–sostre). corner: 'NW','NE','SW','SE'. sx/sz: llargada del quad del sostre; dx/dz: caiguda a les parets.
function cwTopCorner(id, level, corner, sx, sz, dx, dz, variant, flip, only = ['c', 'x', 'z']) {
  const it = cwBuilding(id).visual.interior;
  const f = it.footprint;
  const cy = level === 1 ? it.upper.ceilingY : it.ceilingY;
  const east = corner.includes('E'); const south = corner.includes('S');
  const x0 = east ? f.xMax : f.xMin; const z0 = south ? f.zMax : f.zMin;
  const ux = east ? -1 : 1;    // direcció cap a l'interior de l'estança, eix X
  const iz = south ? -1 : 1;   // eix Z
  const quads = [];
  if (only.includes('c')) quads.push({ surface: 'ceiling', o: [x0, cy, z0], a: [ux, 0, 0], sa: sx, b: [0, 0, iz], sb: sz, n: [0, -1, 0] });
  if (only.includes('x')) quads.push({ surface: 'wall', o: [x0, cy, z0], a: [ux, 0, 0], sa: sx, b: [0, -1, 0], sb: dx, n: [0, 0, iz] });
  if (only.includes('z')) quads.push({ surface: 'wall', o: [x0, cy, z0], a: [0, 0, iz], sa: sz, b: [0, -1, 0], sb: dz, n: [ux, 0, 0] });
  return { id: `CW-${id}${level ? 'U' : ''}-${corner}`, buildingId: id, level, variant, flip, quads };
}
// Entre la part de dalt d'un moble i la paret del darrere. wall: 'W','E','N','S' (cara del moble que toca la paret);
// end: 'lo'|'hi' (extrem del moble on s'ancora l'àpex); len = llargada al llarg de la vora; up = alçada sobre la paret; depth = sobre la tapa.
function cwFurnTop(furnId, wall, end, len, up, depth, variant, flip) {
  const m = FURNITURE.find((q) => q.id === furnId); const r = m.collision;
  const base = m.level === 1 ? 2.75 : 0; const topY = base + m.visual.height;
  const horiz = wall === 'N' || wall === 'S';
  const into = { W: [1, 0, 0], E: [-1, 0, 0], N: [0, 0, 1], S: [0, 0, -1] }[wall];
  const plane = { W: r.xMin, E: r.xMax, N: r.zMin, S: r.zMax }[wall];
  const lo = horiz ? r.xMin : r.zMin; const hi = horiz ? r.xMax : r.zMax;
  const at = end === 'lo' ? lo : hi; const e = end === 'lo' ? 1 : -1;
  const o = horiz ? [at, topY, plane] : [plane, topY, at];
  const a = horiz ? [e, 0, 0] : [0, 0, e];
  return { id: `CW-${furnId}`, buildingId: m.buildingId, level: m.level || 0, variant, flip, quads: [
    { surface: 'wall', o, a, sa: len, b: [0, 1, 0], sb: up, n: into },
    { surface: 'top', o, a, sa: len, b: into, sb: depth, n: [0, 1, 0] },
  ] };
}
export const COBWEBS = [
  // Casa A: una cantonada gran, una de mitjana (SE), una de petita (NE) i una entre l'armari baix i la paret oest
  cwTopCorner('HA', 0, 'NW', 0.85, 0.8, 0.5, 0.45, 0, false),
  cwTopCorner('HA', 0, 'SE', 0.7, 0.6, 0.4, 0.5, 1, true),
  cwTopCorner('HA', 0, 'NE', 0.45, 0.4, 0.3, 0.3, 2, false),
  cwFurnTop('A-CAB', 'W', 'lo', 0.5, 0.45, 0.4, 1, false),
  // Casa B
  cwTopCorner('HB', 0, 'NE', 0.9, 0.85, 0.5, 0.5, 0, true),
  cwTopCorner('HB', 0, 'SW', 0.7, 0.6, 0.4, 0.45, 1, false),
  cwTopCorner('HB', 0, 'NW', 0.5, 0.45, 0.3, 0.3, 2, true),
  cwFurnTop('B-CAB', 'S', 'hi', 0.5, 0.45, 0.35, 2, false),
  // Casa C, planta baixa (sostre a 2,65 m; el forat de l'escala deixa la cantonada SE sense sostre: no hi ha teranyina)
  cwTopCorner('HC', 0, 'NW', 0.8, 0.75, 0.38, 0.4, 1, false),
  cwTopCorner('HC', 0, 'SW', 0.8, 0.7, 0.45, 0.4, 2, true),
  cwFurnTop('C-CAB2', 'S', 'hi', 0.45, 0.4, 0.35, 0, true),
  // Casa C, pis superior (dormitori): més teranyines a les cantonades
  cwTopCorner('HC', 1, 'SW', 1.0, 0.9, 0.5, 0.5, 0, false),
  cwTopCorner('HC', 1, 'SE', 0.9, 0.8, 0.5, 0.5, 2, true),
  cwTopCorner('HC', 1, 'NW', 0.8, 0.75, 0.45, 0.45, 1, true),
  cwTopCorner('HC', 1, 'NE', 0.55, 0.5, 0.3, 0.3, 2, false),
  cwFurnTop('C-U-WARD', 'S', 'lo', 0.5, 0.4, 0.35, 1, false),
];

// ---------------------------------------------------------------------
// ENTRADA DEL POBLE (Fase C): porta reixada de ferro al final del carrer d'entrada (mur M-S2, z 29 → 29,4).
// La col·lisió continua sent la del mur M-S2 (sòlida de paret a paret: x −2,4 → 2,4 amb M-SO i M-SE).
// El bosc nocturn queda més enllà (z > 29,4): només es veu a través de la reixa, no és accessible.
// ---------------------------------------------------------------------
export const GATE = {
  id: 'GATE', wallId: 'M-S2',
  center: { x: 0, z: 29.2 },
  width: 4.0,           // entre les cares interiors dels murs M-SO i M-SE (x −2 → 2)
  openingWidth: 3.0,    // amplada de la reixa (entre els pilars de pedra)
  pillarWidth: 0.5,     // pilars de pedra a cada costat
  height: 3.0,          // alçada de la reixa
  archTop: 3.7,         // alçada de la llinda de pedra
  barSpacing: 0.18,
};
export const FOREST = {
  zMin: 30.5, zMax: 62, xHalf: 26, trees: 120, seed: 4242,
};

// ---------------------------------------------------------------------
// PUZLE DE LES DUES CLAUS (Fase B)
//   SECRET_DOOR  porta segellada a la paret del fons de la nau (cara interior z = −20,4). Té dues ranures
//                (una per clau) a les dovelles. Tancada, la col·lisió és la mateixa paret CH-N-B.
//   KEYS         les dues claus. `container` = moble on s'amaguen i `reveal` = com es mostren
//                ('drawer' el calaix s'obre; 'lid' la tapa de l'arca s'alça). `pos` = on és la clau un cop revelada.
// ---------------------------------------------------------------------
export const SECRET_DOOR = {
  id: 'SD', buildingId: 'CH-N', face: 'north',
  center: { x: 0, z: -20.4 }, width: 1.4, height: 2.6,     // pas lliure d'1,4 × 2,6 m (apuntat)
  slots: [
    { id: 'SLOT-A', key: 'KEY-A', x: -0.95, y: 1.3 },        // ranura de la campana (oest)
    { id: 'SLOT-B', key: 'KEY-B', x: 0.95, y: 1.3 },          // ranura de la lluna (est)
  ],
  interactRange: 3.4,     // distància (m) des de la porta per examinar-la / inserir claus
  openSeconds: 6,         // durada de l'obertura (lenta i pesada)
  unlockDelay: 1.5,       // pausa entre la 2a clau i l'inici de l'obertura
  slide: 0.75,            // cada batent llisca 0,75 m cap al gruix de la paret
  inscription: 'Només dues voluntats poden obrir el camí.',
};
export const KEYS = [
  { id: 'KEY-A', name: 'Clau del guardià', material: 'bronze', symbol: 'bell', container: 'A-DRS', reveal: 'drawer',
    pos: { x: -11.0, z: -7.9 }, y: 0.68, pickRange: 1.8 },
  { id: 'KEY-B', name: 'Clau dels oblidats', material: 'iron', symbol: 'moon', container: 'B-CHS', reveal: 'lid',
    pos: { x: 11.25, z: -4.0 }, y: 0.42, pickRange: 1.8 },
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

// =====================================================================
// FASE D.2 — CEMENTIRI (només dades). Especificació: docs/FASE_D1_CEMENTIRI_DISSENY.md, v4 «DISSENY FINAL APROVAT».
// Les coordenades i els ids són els de l'informe; no s'han de canviar per conveniència.
//
// Per no barrejar-se amb el poble ni trencar cap prova existent, el cementiri viu en GRUPS NOUS (CEM_WALLS, CEM_PROPS) amb
// la mateixa forma que WALLS i PROPS (cada objecte té `visual` i `collision`). buildColliders (collisions.js) les llegeix com
// a grups opcionals i main.js els hi passa.
//   - Clos principal x 4→28, z −34→−9,4 (24 × 24,6 m) + vestíbul x 15,4→28, z −9,4→−7 davant de la reixa.
//   - Els murs nous creixen cap a l'EXTERIOR (la cara transitable cau en un nombre enter) i tanquen el perímetre amb M-N1, M-E3,
//     M-E1 i la nau de l'església. El jugador NO pot entrar-hi a la Fase D.2: la reixa (M-E3) és sòlida.
//   - NO hi ha `openCollision` ni cap estat de la reixa: això és la Fase D.4. La porta posterior és NOMÉS visual i tancada.
// =====================================================================
const cemRect = (xMin, xMax, zMin, zMax) => ({ type: 'rect', xMin, xMax, zMin, zMax });
const cemWall = (id, name, xMin, xMax, zMin, zMax, extra = {}) => ({
  id, name, visual: { footprint: cemRect(xMin, xMax, zMin, zMax), height: 2.8, ...extra }, collision: cemRect(xMin, xMax, zMin, zMax),
});

export const CEM_AREA = {
  clos: cemRect(4, 28, -34, -9.4),
  vestibule: cemRect(15.4, 28, -9.4, -7),
};

export const CEM_WALLS = [
  // `breach`: tram esfondrat (NOMÉS visual: la col·lisió és contínua) amb vista al bosc futur. `looseStone`: pedra solta del mur oest.
  cemWall('CW-N', 'Mur nord del cementiri (cara transitable z = −34)', 3.6, 28.4, -34.4, -34, { breach: { xMin: 21, xMax: 23.4, height: 1.4 } }),
  cemWall('CW-E', 'Mur est del cementiri (cara transitable x = 28)', 28, 28.4, -34, -7),
  cemWall('CW-S3', 'Mur sud del vestíbul (cara z = −7; prolonga M-E1)', 15.4, 28.4, -7, -6.6),
  cemWall('CW-W', 'Mur oest del cementiri, darrere de l\'església (cara x = 4)', 3.6, 4, -34, -21, { looseStone: { z: -31.4, y: 1.0 } }),
];

// Porta posterior: només visual i TANCADA (cap col·lisió pròpia: la del mur CW-E és contínua).
export const CEM_REAR_GATE = {
  id: 'CEM-REAR', wallId: 'CW-E', zMin: -21, zMax: -19, height: 2.6,
  state: 'closed', locked: true, opensCollision: false,
};

// Reixa d'entrada sobre M-E3 (x 15→15,4, z −9→−7). La col·lisió de M-E3 NO canvia (sòlida). Fase D.2: tancada i IMMÒBIL.
// Obertura z −8,4→−7,0 (1,4 m, centre −7,7); pilar nord de pedra z −9→−8,4; pilar sud = extrem de M-E1 (sense col·lisió pròpia).
export const CEM_GATE = {
  id: 'CEM-GATE', wallId: 'M-E3',
  opening: { zMin: -8.4, zMax: -7.0, center: -7.7, height: 2.6 },
  pillarNorth: { zMin: -9, zMax: -8.4 },
  southJamb: { zMin: -7.1, zMax: -7.0 },           // muntant VISUAL (ferro) de la frontissa: sense col·lisió
  leaf: { x: 15.2, thickness: 0.06, length: 1.38, hingeZ: -7.05, bars: 8, rails: 3 },
  padlock: { x: 14.93, y: 1.05, z: -7.7, symbol: 'cross' },
  interactionPoint: { x: 15.0, z: -7.7 },          // (només dades per a D.4; cap interacció a D.2)
  state: 'locked',
};

// Camins de terra gastats: NOMÉS decals (cap col·lisió). `width` en metres.
export const CEM_PATHS = [
  { id: 'E0', name: 'Entrada', width: 1.8, points: [[15.4, -7.7], [16.8, -8], [18.2, -8.6], [18, -13], [16.5, -14.8], [14.5, -16]] },
  { id: 'P2', name: 'Camí de ronda', width: 1.8, points: [[5.5, -16], [12, -16], [24, -16], [24, -20], [28, -20]] },
  { id: 'P1', name: "Camí de l'església", width: 1.6, points: [[5.5, -16], [5.5, -19], [6.4, -26], [8, -29.5], [8.6, -31.6]] },
  { id: 'P3', name: 'Camí del mausoleu', width: 1.8, points: [[12, -16], [13.5, -22], [15, -28.4]] },
  { id: 'P4', name: 'Branca de la fossa', width: 1.4, points: [[22.5, -16], [22.5, -14.6]] },
  { id: 'P5', name: 'Camí de la caseta', width: 1.4, points: [[24, -20], [24.5, -28], [25.2, -30.4]] },
];

// Ajudants de dades per repartir làpides i creus (resultats deterministes, arrodonits a 1 mm).
const r3 = (v) => Math.round(v * 1000) / 1000;
const cemRow = (n, x0, step, z) => Array.from({ length: n }, (_, k) => ({ x: r3(x0 + k * step), z }));
const GRAVE_W = 1.15; // ample d'una tomba lliure (x); fons 2,0 m (z): bloc = n × 1,15 × 2,0
const cemGraves = (rect, kinds) => kinds.map((kind, k) => ({
  x: r3(rect.xMin + GRAVE_W * (k + 0.5)), z: r3((rect.zMin + rect.zMax) / 2), w: GRAVE_W, l: rect.zMax - rect.zMin, kind,
}));
const cemBlock = (id, name, xMin, xMax, zMin, zMax, kinds) => {
  const fp = cemRect(xMin, xMax, zMin, zMax);
  return { id, type: 'graveBlock', name, visual: { footprint: fp, graves: cemGraves(fp, kinds) }, collision: { ...fp } };
};
const cemTree = (id, x, z, height) => ({
  id, type: 'deadTree', name: 'Arbre mort', visual: { center: { x, z }, trunkRadius: 0.3, height }, collision: { type: 'circle', cx: x, cz: z, radius: 0.3 },
});

// ATREZZO DEL CEMENTIRI. `collision` = la que fixa l'informe (apartat 5.2 i 5.3). Els camps `visual.*` que no són l'empremta
// (làpides, creus, tipus de tomba) són decoració i es poden repartir DINS de l'empremta.
export const CEM_PROPS = [
  {
    id: 'CT2', type: 'sign', name: 'Cartell «CEMENTIRI →» (carreró est)',
    visual: {
      center: { x: 5.5, z: -7.6 }, postRadius: 0.2, height: 2.4,
      // taulell 1,3 × 0,45 m (y 1,75→2,2), orientat a la plaça (cara cap al sud), fletxa a l'est
      board: { width: 1.3, height: 0.45, bottom: 1.75, top: 2.2, thickness: 0.06, text: 'CEMENTIRI →', facing: 'south' },
    },
    collision: { type: 'circle', cx: 5.5, cz: -7.6, radius: 0.2 },
  },
  {
    // Tomba de Sibil·la Aldaira (casa C), al vestíbul, a l'eix de la reixa. E–O; l'única làpida girada cap a l'entrada (cap a l'oest).
    id: 'SIB', type: 'tomb', name: 'Tomba de Sibil·la Aldaira',
    visual: { footprint: cemRect(20.4, 22.4, -9.2, -8.2), family: 'Aldaira', facing: 'west', inscription: ['SIBIL·LA', 'ALDAIRA'], height: 0.35, stoneHeight: 1.05 },
    collision: cemRect(20.4, 22.4, -9.2, -8.2),
  },
  {
    id: 'CAL', type: 'calvary', name: 'Calvari',
    visual: { center: { x: 12, z: -16 }, radius: 0.9, height: 3.4 },
    collision: { type: 'circle', cx: 12, cz: -16, radius: 0.9 },
  },
  {
    id: 'MAU', type: 'mausoleum', name: 'Mausoleu segellat',
    visual: { footprint: cemRect(12.5, 17.5, -34, -29.2), facing: 'south', sealed: true, height: 4.6 },
    collision: cemRect(12.5, 17.5, -34, -29.2),
  },
  {
    id: 'SHED', type: 'shed', name: 'Caseta del fosser',
    visual: { footprint: cemRect(23.5, 26.8, -34, -30.5), facing: 'south', height: 2.5 },
    collision: cemRect(23.5, 26.8, -34, -30.5),
  },
  {
    id: 'PIT', type: 'openGrave', name: 'Fossa oberta',
    visual: { footprint: cemRect(19.6, 20.8, -29.4, -27.2), height: 0.3 },
    collision: cemRect(19.6, 20.8, -29.4, -27.2),
  },
  {
    // 13 creus iguals, sense nom, amb la mateixa data. Reixa de ferro (no enterable): es veuen a través dels barrots.
    id: 'FOSSA', type: 'massGrave', name: 'Fossa comuna amb reixa',
    visual: { footprint: cemRect(19.5, 26.5, -14.4, -11.5), crosses: [...cemRow(7, 20.05, 0.97, -13.7), ...cemRow(6, 20.55, 0.98, -12.4)], fenceHeight: 1.25 },
    collision: cemRect(19.5, 26.5, -14.4, -11.5),
  },
  {
    id: 'LONE', type: 'loneGrave', name: 'Tomba solitària amb reixa',
    visual: { footprint: cemRect(5.4, 7.8, -32.8, -30.4), fenceHeight: 1.0 },
    collision: cemRect(5.4, 7.8, -32.8, -30.4),
  },
  {
    // Parcel·la dels Montvell (casa A, campaners): 10 làpides amb campana; l'última, en blanc, amb un forat per a un batall.
    id: 'ENC-M', type: 'plot', name: 'Parcel·la dels Montvell',
    visual: { footprint: cemRect(17, 21.2, -25.6, -21.6), family: 'Montvell', symbol: 'bell', blankLast: true,
      stones: [...cemRow(5, 17.6, 0.8, -24.75), ...cemRow(5, 17.6, 0.8, -22.55)], fenceHeight: 0.9 },
    collision: cemRect(17, 21.2, -25.6, -21.6),
  },
  {
    // Parcel·la dels Vilarnau (casa B, «els oblidats»): 6 làpides amb mitja lluna; 4 amb el nom picat.
    id: 'ENC-V', type: 'plot', name: 'Parcel·la dels Vilarnau',
    visual: { footprint: cemRect(17, 21.4, -20.2, -17.6), family: 'Vilarnau', symbol: 'moon', scarred: [1, 2, 4, 5],
      stones: cemRow(6, 17.45, 0.72, -19.6), fenceHeight: 0.9 },
    collision: cemRect(17, 21.4, -20.2, -17.6),
  },
  // Blocs de tombes lliures (11 tombes; amb SIB en fan 12)
  cemBlock('Z1-a', 'Tombes Z1-a', 8.5, 10.8, -28, -26, ['arch', 'leaning']),
  cemBlock('Z1-b', 'Tombes Z1-b', 7.6, 11.05, -24.8, -22.8, ['woodCross', 'bell', 'broken']),
  cemBlock('Z1-c', 'Tombes Z1-c', 7.28, 10.73, -21.6, -19.6, ['stoneCross', 'scar', 'bare']),
  cemBlock('Z3', 'Tombes Z3', 11.24, 14.69, -13.9, -11.9, ['arch', 'moon', 'plain']),
  // Arbres morts (no són l'arbre de la plaça ARB: aquest no es toca)
  cemTree('T1', 5.6, -28.4, 5.2), cemTree('T2', 9.4, -12.2, 4.6), cemTree('T4', 26.2, -24.5, 5.8),
  cemTree('T6', 10.2, -31.0, 4.4), cemTree('T7', 19.4, -31.8, 5.0),
];

// =====================================================================
// FASE D.3 — CRIPTA SECRETA I PUZLE DELS TRES SÍMBOLS (només dades).
// Especificació: docs/FASE_D1_CEMENTIRI_DISSENY.md (v4, apartat 8) + encàrrec de la Fase D.3. Les coordenades són les aprovades.
//
// Tot és NOU i viu en grups propis (CRYPT_FLOORS, CRYPT_WALLS, CRYPT_PROPS, CRYPT) perquè no es toqui cap dada existent:
//   · SD (porta secreta) i KEY-A / KEY-B queden tal com eren. KEY-C NO és a `KEYS`: és a CRYPT.keyC (el sistema de claus A/B no canvia).
//   · Nivell −1 (cripta): terra a y −3,2. Els obstacles del nivell −1 porten `level: −1` (collisions.js ja filtra per nivell).
//     El pou de l'escala (CR-SH-*) no porta `level`: és una paret real a tots dos nivells.
//   · Col·lisió condicional de SD: CH-N-B (x −4→4) es parteix en dues peces quan SD és 'open' (mecanisme `enabled`, com les portes de casa).
//     Tancada, les dues peces són DINS de CH-N-B i la seva unió és idèntica: no canvia res.
// =====================================================================
const crRect = (xMin, xMax, zMin, zMax) => ({ type: 'rect', xMin, xMax, zMin, zMax });
const crWall = (id, name, xMin, xMax, zMin, zMax, extra = {}) => {
  const { level, height = 3.0, draw = true, ...rest } = extra;
  return { id, name, ...(level !== undefined ? { level } : {}), visual: { footprint: crRect(xMin, xMax, zMin, zMax), height, draw, ...rest }, collision: crRect(xMin, xMax, zMin, zMax) };
};

// Terres del nivell −1 i escala descendent. S'afegeixen a FLOORS a main.js (createFloors) sense tocar FLOORS.
//   levelSplitDown: per sota d'aquesta alçada dels peus el jugador és al nivell −1.
//   L'escala fa 16 graons de 0,2 m d'alçada i 0,28 m de petjada (4,48 m): del replà (z −22,2, y 0) a la boca de l'antecambra (z −26,68, y −3,2).
//   Igual que a l'escala de la casa C, el terra és una rampa que passa per les arestes dels graons (`rise` = alçada inicial: 0 al replà).
export const CRYPT_FLOORS = {
  levelSplitDown: -1.4,
  slabs: [
    { id: 'CR-F-ANT', level: -1, y: -3.2, rect: { xMin: -2.2, xMax: 2.2, zMin: -30, zMax: -26.7 }, holes: [] },
    { id: 'CR-F-PAS', level: -1, y: -3.2, rect: { xMin: -0.8, xMax: 0.8, zMin: -30.4, zMax: -30 }, holes: [] },
    { id: 'CR-F-SALA', level: -1, y: -3.2, rect: { xMin: -6, xMax: 2.6, zMin: -35.6, zMax: -30.4 }, holes: [] },
    { id: 'CR-F-ARC', level: -1, y: -3.2, rect: { xMin: -6.4, xMax: -6, zMin: -34.6, zMax: -33 }, holes: [] },
    { id: 'CR-F-GUARDIA', level: -1, y: -3.2, rect: { xMin: -10.4, xMax: -6.4, zMin: -35.6, zMax: -31 }, holes: [] },
  ],
  stairs: [
    { id: 'CR-ST', rect: { xMin: -0.9, xMax: 0.9, zMin: -26.7, zMax: -22.2 }, axis: 'z', dir: -1, start: -22.2, run: 4.48, rise: 0, tread: 0.28, riser: 0.2, floorY: -3.2, treads: 16 },
  ],
};

// Parets i obstacles de la cripta (rectangles; cada objecte té `visual` i `collision`, com CEM_WALLS / CEM_PROPS).
export const CRYPT_WALLS = [
  // Pou de l'escala («sagristia oculta»): parets de 0,4 m, interior x −0,9→0,9. Sense `level`: existeixen a la superfície i sota terra.
  crWall('CR-SH-W', 'Pou de l\'escala, paret oest', -1.3, -0.9, -26.7, -21, { height: 6.4 }),
  crWall('CR-SH-E', 'Pou de l\'escala, paret est', 0.9, 1.3, -26.7, -21, { height: 6.4 }),
  crWall('CR-BOX-N', 'Caixa de l\'escala, paret nord (només superfície)', -1.3, 1.3, -27.1, -26.7, { level: 0, height: 3.2 }),
  // Antecambra ANT (interior x −2,2→2,2, z −30→−26,7): la cara sud té la boca de l'escala (x −0,9→0,9).
  crWall('CR-ANT-S-W', 'Antecambra, cara sud (oest)', -2.6, -1.3, -26.7, -26.3, { level: -1 }),
  crWall('CR-ANT-S-E', 'Antecambra, cara sud (est)', 1.3, 2.6, -26.7, -26.3, { level: -1 }),
  crWall('CR-ANT-W', 'Antecambra, paret oest', -2.6, -2.2, -30, -26.7, { level: -1 }),
  crWall('CR-ANT-E', 'Antecambra, paret est', 2.2, 2.6, -30, -26.7, { level: -1 }),
  // Mur entre l'antecambra i la gran sala (z −30,4→−30) amb el pas ANT→SALA (x −0,8→0,8)
  crWall('CR-DIV-W', 'Mur ANT/SALA (oest del pas)', -6.4, -0.8, -30.4, -30, { level: -1 }),
  crWall('CR-DIV-E', 'Mur ANT/SALA (est del pas)', 0.8, 3.0, -30.4, -30, { level: -1 }),
  // Gran sala SALA (interior x −6→2,6, z −35,6→−30,4) i sala del guardià (x −10,4→−6,4, z −35,6→−31)
  crWall('CR-SALA-E', 'Gran sala, paret est', 2.6, 3.0, -36, -30.4, { level: -1 }),
  crWall('CR-N', 'Cripta, paret nord', -10.8, 3.0, -36, -35.6, { level: -1 }),
  crWall('CR-ARC-S', 'Mur de l\'arc, tram sud', -6.4, -6.0, -33, -30.4, { level: -1 }),
  crWall('CR-ARC-N', 'Mur de l\'arc, tram nord', -6.4, -6.0, -35.6, -34.6, { level: -1 }),
  crWall('CR-G-W', 'Sala del guardià, paret oest', -10.8, -10.4, -35.6, -30.6, { level: -1 }),
  crWall('CR-G-S', 'Sala del guardià, paret sud', -10.8, -6.4, -31, -30.6, { level: -1 }),
  // Peces que substitueixen CH-N-B quan SD és oberta (x −4→−0,7 i 0,7→4, z −21→−20,4). No es dibuixen (la paret ja existeix).
  crWall('CH-N-B-W', 'Paret del fons, peça oest (SD oberta)', -4, -0.7, -21, -20.4, { draw: false }),
  crWall('CH-N-B-E', 'Paret del fons, peça est (SD oberta)', 0.7, 4, -21, -20.4, { draw: false }),
];

// Atrezzo amb col·lisió: altar dels discs, pilars, sarcòfag del guardià i la tauleta de la caixa (casa C, pis superior).
const crCircle = (cx, cz, radius) => ({ type: 'circle', cx, cz, radius });
export const CRYPT_PROPS = [
  { id: 'CR-ALT', type: 'discAltar', name: 'Altar dels tres discs', level: -1,
    visual: { footprint: crRect(-0.9, 0.9, -35.6, -34.8), height: 1.0 }, collision: crRect(-0.9, 0.9, -35.6, -34.8) },
  { id: 'CR-PIL-1', type: 'pillar', name: 'Pilar de la gran sala (oest)', level: -1,
    visual: { center: { x: -2.8, z: -32.4 }, radius: 0.3, height: 3.0 }, collision: crCircle(-2.8, -32.4, 0.3) },
  { id: 'CR-PIL-2', type: 'pillar', name: 'Pilar de la gran sala (est)', level: -1,
    visual: { center: { x: 1.0, z: -32.4 }, radius: 0.3, height: 3.0 }, collision: crCircle(1.0, -32.4, 0.3) },
  { id: 'CR-SARC', type: 'sarcophagus', name: 'Sarcòfag del guardià', level: -1,
    visual: { footprint: crRect(-8.9, -7.9, -34.4, -32.2), height: 0.85 }, collision: crRect(-8.9, -7.9, -34.4, -32.2) },
  { id: 'C-U-CLUE-TABLE', type: 'clueTable', name: 'Tauleta de la caixa antiga (casa C, pis superior)', level: 1,
    visual: { footprint: crRect(3.8, 4.6, 9.4, 9.95), height: 0.8 }, collision: crRect(3.8, 4.6, 9.4, 9.95) },
];

// Dades del puzle, la caixa-pista i els elements visuals/interactius de la cripta.
export const CRYPT = {
  id: 'CRYPT',
  floorY: -3.2, ceilingY: -0.2,
  // Volum subterrani reservat (D.1 v4 §8.3): cap peça a x > 3,0 ni sota l'església (z ≤ −26,3 → la caixa comença a z −26,3).
  bounds: { xMin: -10.8, xMax: 3.0, zMin: -36, zMax: -26.3 },
  // Pou de l'escala: exterior x −1,3→1,3, z −27,1→−21; interior x −0,9→0,9; teulada a y 3,2; replà z −22,2→−21; forat de terra z −26,7→−22,2.
  shaft: { outer: crRect(-1.3, 1.3, -27.1, -21), inner: crRect(-0.9, 0.9, -26.7, -21), wall: 0.4, roofY: 3.2,
    landing: crRect(-0.9, 0.9, -22.2, -21), hole: crRect(-0.9, 0.9, -26.7, -22.2) },
  stair: { steps: 16, rise: 0.2, tread: 0.28, topZ: -22.2, topY: 0, bottomY: -3.2, xMin: -0.9, xMax: 0.9 },
  rooms: {
    ANT: { name: 'Antecambra', rect: crRect(-2.2, 2.2, -30, -26.7), ceilingY: -0.75 },
    SALA: { name: 'Gran sala', rect: crRect(-6, 2.6, -35.6, -30.4), ceilingY: -0.35 },
    GUARDIA: { name: 'Sala del guardià', rect: crRect(-10.4, -6.4, -35.6, -31), ceilingY: -0.6 },
  },
  openings: {
    antSala: crRect(-0.8, 0.8, -30.4, -30),     // pas ANT → SALA (1,6 m)
    arc: crRect(-6.4, -6, -34.6, -33),          // arc SALA → GUARDIÀ (1,6 m) amb una reixa baixa decorativa oberta
  },
  // Pas de SD (nau → pou): CH-N-B es parteix en dues peces amb l'obertura x −0,7→0,7.
  sdSplit: { original: 'CH-N-B', pieces: ['CH-N-B-W', 'CH-N-B-E'], gap: { xMin: -0.7, xMax: 0.7 }, wallZ: { zMin: -21, zMax: -20.4 } },

  // PUZLE: tres discs a l'altar (de l'oest a l'est, tal com els veu el jugador). Cada disc recorre els símbols en aquest ordre.
  puzzle: {
    symbols: ['bell', 'moon', 'cross', 'sun'],
    names: { bell: 'Campana', moon: 'Lluna', cross: 'Creu', sun: 'Sol' },
    solution: ['bell', 'moon', 'cross'],          // CAMPANA → LLUNA → CREU
    start: ['sun', 'sun', 'sun'],                 // estat inicial fix (no aleatori): cap combinació encertada
    discX: [-0.55, 0, 0.55], discY: 1.62, discR: 0.22, discZ: -35.31,   // centre dels discs (y relativa al terra del nivell −1)
    interact: { x: 0, z: -35.31, range: 1.75, standZ: -34.4, standHalfX: 1.3 },  // el jugador ha de ser DAVANT de l'altar (z ≥ −34,4)
    turnSeconds: 0.35,            // gir d'un disc (90°)
    solveDelay: 1.2,              // pausa entre l'últim símbol correcte i el mecanisme del sarcòfag
    sealSeconds: 1.6,             // animació de segellat dels discs un cop resolt
  },
  // SARCÒFAG: bloquejat fins que el puzle és resolt; E alça la tapa (llisca cap al nord) i apareix KEY-C.
  sarcophagus: {
    id: 'CR-SARC', interact: { x: -8.4, z: -33.3, range: 2.0 },
    lidSlide: 1.05, lidSeconds: 2.6, unlockSeconds: 1.4,
  },
  // KEY-C (NO és a KEYS): ferro negre, petita creu. Dins del sarcòfag, sobre el sudari.
  keyC: { id: 'KEY-C', name: 'Clau del cementiri', material: 'blackIron', symbol: 'cross',
    description: 'clau de ferro negre molt vell, amb una petita creu a l\'anella',
    pos: { x: -8.4, z: -32.75 }, y: -3.2 + 0.64, pickRange: 2.0 },
  // CAIXA-PISTA (casa C, pis superior): caixa de fusta antiga damunt la tauleta. No dona cap clau ni activa cap mecanisme de la casa.
  clue: {
    id: 'CLUE-BOX', table: 'C-U-CLUE-TABLE', center: { x: 4.2, z: 9.68 }, y: 2.75 + 0.8, w: 0.36, d: 0.24, h: 0.15,
    range: 1.8, closeDistance: 2.6,
    text: 'El guardià no escolta qui truca, sinó qui recorda l\'ordre.',
    order: ['bell', 'moon', 'cross'],
  },
  // Flames (ciris petits): `light` = punt on es posa l'única llum puntual càlida (es mou al racó més proper al jugador).
  candles: [
    { id: 'CR-C1', x: -0.8, y: -0.95, z: -25.1, on: 'wall' },
    { id: 'CR-C2', x: -2.12, y: -2.55, z: -28.4, on: 'ledge' },
    { id: 'CR-C3', x: -0.72, y: -2.2, z: -35.0, on: 'altar' },
    { id: 'CR-C4', x: 0.72, y: -2.2, z: -35.0, on: 'altar' },
    { id: 'CR-C5', x: 1.55, y: -3.2, z: -31.1, on: 'floor' },
    { id: 'CR-C6', x: -9.4, y: -3.2, z: -34.8, on: 'floor' },
    { id: 'CR-C7', x: -7.4, y: -3.2, z: -34.8, on: 'floor' },
    // Fase D.3.1: cinc espelmes més, a punts estratègics (antecambra, sala principal, sala del guardià), fora de les lloses i dels pilars
    { id: 'CR-C8', x: 1.85, y: -3.2, z: -29.55, on: 'floor' },
    { id: 'CR-C9', x: -3.6, y: -3.2, z: -35.25, on: 'floor' },
    { id: 'CR-C10', x: 2.25, y: -3.2, z: -35.25, on: 'floor' },
    { id: 'CR-C11', x: -5.6, y: -3.2, z: -31.0, on: 'floor' },
    { id: 'CR-C12', x: -9.9, y: -3.2, z: -31.55, on: 'floor' },
  ],
  lights: [
    { id: 'CL-STAIR', x: -0.45, y: -1.15, z: -25.0 },
    { id: 'CL-ANT', x: -1.5, y: -2.3, z: -28.3 },
    { id: 'CL-SALA', x: 0, y: -1.95, z: -34.1 },
    { id: 'CL-GUARDIA', x: -8.4, y: -1.95, z: -34.0 },
    // Fase D.3.1: més punts on la llum única pot «posar-se» (continua sent UNA sola PointLight)
    { id: 'CL-ANT-E', x: 1.4, y: -2.3, z: -28.8 },
    { id: 'CL-SALA-W', x: -3.9, y: -1.95, z: -33.4 },
    { id: 'CL-GUARDIA-S', x: -9.3, y: -1.95, z: -32.0 },
  ],
  light: { color: 0xffb468, intensity: 9, distance: 8, decay: 2 }, // D.3.1: abans 6 / 6,5 (massa fosca)
  // Il·luminació global soterrada: s'interpola amb la fondària (vegeu src/player/crypt.js → undergroundView).
  ambient: { hemiSurface: 1.5, hemiDeep: 0.42, moonSurface: 1.2, moonDeep: 0, fogNearDeep: 2.5, fogFarDeep: 16, fogColorDeep: 0x050608 },
};
