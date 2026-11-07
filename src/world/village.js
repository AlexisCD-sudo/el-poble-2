// =====================================================================
// THE FORGOTTEN VILLAGE — GREYBOX 3D DE LA PLAÇA CENTRAL (Pas 4)
// =====================================================================
// Aquest fitxer converteix les dades de `layout.js` en geometria Three.js.
//
//   - NO duplica cap coordenada: tot surt de layout.js (BUILDINGS, WALLS,
//     PROPS, DOORS, LIGHTS, PLAZA). Només hi ha aquí constants de DISSENY
//     que el layout no defineix (gruixos, colors, mida dels detalls).
//   - NO fa col·lisions (això és `src/player/collisions.js`).
//   - Estètica greybox: low-poly, ombrejat pla, materials de color sòlid,
//     sense textures ni models externs. Unitats: metres. Terra a Y = 0.
//
// ÚS (vegeu les instruccions de prova):
//   import { buildVillage } from './world/village.js';
//   const village = buildVillage(scene);          // afegeix el poble a l'escena
//   village.dispose();                            // (opcional) el treu i allibera memòria
//
// OPCIONS de buildVillage(scene, options):
//   includeGround  (false)  afegeix un terra pla propi. main.js ja en té un.
//   pointLights    (false)  afegeix PointLight als fanals que ho demanen
//                           (F1 i F3). Intensitat/distància NO són al layout:
//                           són PROVISIONALS i es definiran a la Fase 3.
//   lightIntensity (20)     intensitat provisional en candeles (Three r155+).
//   lightDistance  (12)     abast provisional en metres.
//
// RETORNA { root, lanternLights, stats, dispose }.
//
// DECISIONS DE DISSENY (el layout no les defineix; són només visuals):
//   - Carener de les teulades: sempre paral·lel al costat LLARG de l'empremta.
//     (Nau: carener N–S, façana en frontó. Cases: carener N–S, façana a l'ràfec.)
//   - Teulades a ras de l'empremta (sense voladís) per no sortir de les mides.
//   - Campanar: `height` = alçada TOTAL fins al vèrtex de la piràmide
//     (cos 11 m + piràmide 3 m = 14 m).
//   - Portes de casa: l'alçada 2,0 m es mesura des del llindar (damunt dels
//     esglaons). Cada esglaó fa `depth` de fons: 2 esglaons = 1,2 m de sortida.
//     Els esglaons són només visuals (sense col·lisió, com la resta de portes).
//   - Cartell CT: el taulell penja a la part alta (y 1,85–2,2) i només cap al
//     costat del carrer, perquè el jugador (ull a 1,7 m) no el travessi.
//   - Sense finestres ni xemeneies: el layout encara no les defineix.
// =====================================================================

import * as THREE from 'three';
import { LAYOUT_META, BUILDINGS, WALLS, PROPS, DOORS, LIGHTS } from './layout.js';

// ---------------------------------------------------------------------
// Constants de disseny (no són coordenades del layout)
// ---------------------------------------------------------------------
const COLORS = {
  churchStone: 0x8f9296,
  churchRoof: 0x3a4048,
  houseWall: 0xb5a27f,
  houseRoof: 0x8a4b3a,
  wallStone: 0x6f6d68,
  fountainStone: 0x9a9d9f,
  frameStone: 0xa9aaa6,
  wood: 0x6b4f33,
  darkWood: 0x3a2a1c,
  iron: 0x222428,
  crate: 0x8b6a3e,
  barrel: 0x5a3d26,
  trunk: 0x4a3826,
  foliage: 0x3f5f3a,
  belfryDark: 0x15171a,
  ground: 0x2b2f38,
};

const DOOR_SLAB = 0.08;   // gruix de la fulla de porta de casa
const DOOR_JAMB = 0.12;   // gruix de brancals i llinda
const ARCH_FRAME = 0.05;  // gruix del marc de pedra de l'arc
const ARCH_DOOR = 0.10;   // gruix de la fulla de l'arc
const ARCH_MARGIN = 0.25; // marc de pedra a cada costat de l'arc

const TOWER_ROOF_HEIGHT = 3;
const BELFRY = { y0: 8.5, width: 1.2, straight: 1.4, depth: 0.06 };

const FOUNTAIN = { floorY: 0.35, rimThickness: 0.35, columnRadius: 0.3,
  bowlRadius: 0.9, bowlHeight: 0.3, finialHeight: 0.4 };

const BALCONY = { slab: 0.12, railHeight: 1.0, railThick: 0.06, balusterStep: 0.25, balusterThick: 0.04 };

const BENCH = { slab: 0.06, backGap: 0.10, post: 0.06 };

const SIGN = { boardWidth: 0.9, boardBottom: 1.85, boardThick: 0.06 };

const LANTERN = { armThick: 0.04, link: 0.04, capHeight: 0.12, capRadius: 0.14,
  glass: 0.16, glassHeight: 0.26, ring: 0.02, base: 0.03 };

// ---------------------------------------------------------------------
// Utilitats
// ---------------------------------------------------------------------
const EPS = 1e-9;

function fail(msg) {
  throw new Error(`[village.js] ${msg}`);
}

function createMaterials() {
  const lambert = (color, extra) =>
    new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
  const double = { side: THREE.DoubleSide };
  return {
    churchStone: lambert(COLORS.churchStone),
    churchRoof: lambert(COLORS.churchRoof),
    houseWall: lambert(COLORS.houseWall),
    houseRoof: lambert(COLORS.houseRoof),
    wallStone: lambert(COLORS.wallStone),
    fountainStone: lambert(COLORS.fountainStone, double),
    frameStone: lambert(COLORS.frameStone),
    wood: lambert(COLORS.wood),
    darkWood: lambert(COLORS.darkWood),
    iron: lambert(COLORS.iron, double),
    crate: lambert(COLORS.crate),
    barrel: lambert(COLORS.barrel, double),
    trunk: lambert(COLORS.trunk),
    foliage: lambert(COLORS.foliage),
    belfryDark: lambert(COLORS.belfryDark),
    ground: lambert(COLORS.ground),
  };
}

function addMesh(parent, geometry, material, x, y, z, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

// Caixa per límits (en l'espai del pare).
function addBox(parent, material, b, name) {
  const w = b.xMax - b.xMin;
  const h = b.yMax - b.yMin;
  const d = b.zMax - b.zMin;
  if (!(w > 0 && h > 0 && d > 0)) fail(`Caixa amb mides no positives (${name || '?'})`);
  return addMesh(
    parent,
    new THREE.BoxGeometry(w, h, d),
    material,
    (b.xMin + b.xMax) / 2,
    (b.yMin + b.yMax) / 2,
    (b.zMin + b.zMax) / 2,
    name,
  );
}

function makeGroup(name, layoutId) {
  const g = new THREE.Group();
  g.name = name;
  if (layoutId) g.userData.layoutId = layoutId;
  return g;
}

function requireRect(shape, what) {
  if (!shape || shape.type !== 'rect') fail(`${what}: s'esperava una forma 'rect'`);
  return shape;
}

// Secció d'un arc de mig punt: base a y = 0, costats rectes fins a `straight`
// i semicercle a sobre. Alçada total = straight + width / 2.
function archGeometry(width, straight, depth) {
  const r = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-r, 0);
  shape.lineTo(r, 0);
  shape.lineTo(r, straight);
  shape.absarc(0, straight, r, 0, Math.PI, false);
  shape.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
}

// Referència local d'una cara: l'origen és el punt de la cara, +Z local és
// la normal cap a l'EXTERIOR, +X local és "al llarg" de la cara.
function faceFrame(rect, face, along) {
  switch (face) {
    case 'south': return { x: along, z: rect.zMax, rotY: 0 };
    case 'north': return { x: along, z: rect.zMin, rotY: Math.PI };
    case 'east': return { x: rect.xMax, z: along, rotY: Math.PI / 2 };
    case 'west': return { x: rect.xMin, z: along, rotY: -Math.PI / 2 };
    default: return fail(`Cara desconeguda '${face}'`);
  }
}

// ---------------------------------------------------------------------
// EDIFICIS
// ---------------------------------------------------------------------
const BUILDING_STYLE = {
  'CH-N': { wall: 'churchStone', roof: 'churchRoof' },
  'CH-T': { wall: 'churchStone', roof: 'churchRoof' },
};
const DEFAULT_BUILDING_STYLE = { wall: 'houseWall', roof: 'houseRoof' };

function addGableRoof(parent, mat, fp, eave, ridge, name) {
  if (!(ridge > eave)) fail(`${name}: ridgeHeight ha de ser > eaveHeight`);
  const w = fp.xMax - fp.xMin;
  const d = fp.zMax - fp.zMin;
  const ridgeAlongZ = d >= w;
  const span = ridgeAlongZ ? w : d;
  const length = ridgeAlongZ ? d : w;
  const rise = ridge - eave;

  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, 0);
  shape.lineTo(span / 2, 0);
  shape.lineTo(0, rise);
  shape.lineTo(-span / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });

  if (ridgeAlongZ) {
    // L'extrusió creix cap a +Z: de zMin a zMax.
    return addMesh(parent, geo, mat, (fp.xMin + fp.xMax) / 2, eave, fp.zMin, `${name}-roof`);
  }
  // Carener al llarg de X: girem la geometria 90° (x' = z, z' = −x).
  geo.rotateY(Math.PI / 2);
  return addMesh(parent, geo, mat, fp.xMin, eave, (fp.zMin + fp.zMax) / 2, `${name}-roof`);
}

function addPyramidRoof(parent, mat, fp, baseY, height, name) {
  const w = fp.xMax - fp.xMin;
  const d = fp.zMax - fp.zMin;
  if (Math.abs(w - d) > EPS) fail(`${name}: la piràmide requereix una empremta quadrada`);
  // Con de 4 costats: radi = semidiagonal. Girat 45° perquè les arestes de
  // la base coincideixin amb els eixos X i Z.
  const geo = new THREE.ConeGeometry(w / Math.SQRT2, height, 4, 1);
  geo.rotateY(Math.PI / 4);
  return addMesh(parent, geo, mat, (fp.xMin + fp.xMax) / 2, baseY + height / 2,
    (fp.zMin + fp.zMax) / 2, `${name}-roof`);
}

function addBelfryOpenings(parent, mat, fp, name) {
  const cx = (fp.xMin + fp.xMax) / 2;
  const cz = (fp.zMin + fp.zMax) / 2;
  const faces = [['south', cx], ['north', cx], ['east', cz], ['west', cz]];
  for (const [face, along] of faces) {
    const f = faceFrame(fp, face, along);
    const g = new THREE.Group();
    g.name = `${name}-belfry-${face}`;
    g.position.set(f.x, BELFRY.y0, f.z);
    g.rotation.y = f.rotY;
    const arch = new THREE.Mesh(archGeometry(BELFRY.width, BELFRY.straight, BELFRY.depth), mat);
    arch.name = `${g.name}-arch`;
    g.add(arch);
    parent.add(g);
  }
}

function buildBuildings(mats, parent) {
  const group = makeGroup('Buildings');
  for (const b of BUILDINGS) {
    const style = BUILDING_STYLE[b.id] || DEFAULT_BUILDING_STYLE;
    const v = b.visual;
    const fp = requireRect(v.footprint, `${b.id}.visual.footprint`);
    const g = makeGroup(b.id, b.id);

    if (v.eaveHeight !== undefined) {
      // Edifici amb teulada a dues aigües
      addBox(g, mats[style.wall], { ...fp, yMin: 0, yMax: v.eaveHeight }, `${b.id}-body`);
      addGableRoof(g, mats[style.roof], fp, v.eaveHeight, v.ridgeHeight, b.id);
    } else if (v.height !== undefined) {
      // Torre (campanar): cos + piràmide; `height` és l'alçada total.
      const bodyH = v.height - TOWER_ROOF_HEIGHT;
      addBox(g, mats[style.wall], { ...fp, yMin: 0, yMax: bodyH }, `${b.id}-body`);
      addPyramidRoof(g, mats[style.roof], fp, bodyH, TOWER_ROOF_HEIGHT, b.id);
      addBelfryOpenings(g, mats.belfryDark, fp, b.id);
    } else {
      fail(`${b.id}: el visual no defineix ni eaveHeight ni height`);
    }

    if (v.balcony) addBalcony(g, mats, v.balcony, b);
    group.add(g);
  }
  parent.add(group);
}

// Balcó de fusta: només visual. Per sota queda lliure (no hi ha cap suport)
// perquè el jugador pot passar-hi.
function addBalcony(parent, mats, balcony, building) {
  const fp = requireRect(balcony.footprint, `${building.id}.balcony.footprint`);
  const y0 = balcony.undersideY;
  const y1 = y0 + BALCONY.slab;
  const g = makeGroup(`${building.id}-balcony`, `${building.id}-balcony`);

  addBox(g, mats.wood, { ...fp, yMin: y0, yMax: y1 }, 'balcony-slab');

  // Barana als 3 costats oberts (el costat de la façana no en té).
  // Ajuda: la façana de HB és la cara `faces`; aquí el costat adossat és
  // el que toca l'empremta de l'edifici.
  const bfp = building.visual.footprint;
  const touchesX = Math.abs(fp.xMax - bfp.xMin) < EPS ? 'xMax'
    : Math.abs(fp.xMin - bfp.xMax) < EPS ? 'xMin' : null;
  if (!touchesX) fail(`${building.id}: el balcó ha de tocar la façana E/W de l'edifici`);

  const t = BALCONY.railThick;
  const top = y1 + BALCONY.railHeight;
  const rails = [];
  // costat exterior (paral·lel a la façana)
  if (touchesX === 'xMax') rails.push({ xMin: fp.xMin, xMax: fp.xMin + t, zMin: fp.zMin, zMax: fp.zMax });
  else rails.push({ xMin: fp.xMax - t, xMax: fp.xMax, zMin: fp.zMin, zMax: fp.zMax });
  // costats curts (perpendiculars a la façana)
  rails.push({ xMin: fp.xMin, xMax: fp.xMax, zMin: fp.zMin, zMax: fp.zMin + t });
  rails.push({ xMin: fp.xMin, xMax: fp.xMax, zMin: fp.zMax - t, zMax: fp.zMax });

  for (const r of rails) {
    // passamà
    addBox(g, mats.darkWood, { ...r, yMin: top - t, yMax: top }, 'balcony-handrail');
    // muntants (baluards): al llarg del costat, cada `balusterStep` m
    const alongX = (r.xMax - r.xMin) > (r.zMax - r.zMin);
    const len = alongX ? r.xMax - r.xMin : r.zMax - r.zMin;
    const n = Math.max(2, Math.round(len / BALCONY.balusterStep) + 1);
    const bt = BALCONY.balusterThick;
    for (let i = 0; i < n; i++) {
      const u = (len - bt) * (i / (n - 1)); // desplaçament dins del costat
      const box = alongX
        ? { xMin: r.xMin + u, xMax: r.xMin + u + bt, zMin: r.zMin, zMax: r.zMax }
        : { xMin: r.xMin, xMax: r.xMax, zMin: r.zMin + u, zMax: r.zMin + u + bt };
      addBox(g, mats.wood, { ...box, yMin: y1, yMax: top - t }, 'balcony-baluster');
    }
  }
  parent.add(g);
}

// ---------------------------------------------------------------------
// MURS
// ---------------------------------------------------------------------
function buildWalls(mats, parent) {
  const group = makeGroup('Walls');
  for (const w of WALLS) {
    const fp = requireRect(w.visual.footprint, `${w.id}.visual.footprint`);
    const g = makeGroup(w.id, w.id);
    addBox(g, mats.wallStone, { ...fp, yMin: 0, yMax: w.visual.height }, `${w.id}-mesh`);
    group.add(g);
  }
  parent.add(group);
}

// ---------------------------------------------------------------------
// PORTES (taula DOORS: visuals, tancades, sense obertura de col·lisió)
// ---------------------------------------------------------------------
function assertDoorOnFace(door, fp) {
  const c = door.center;
  const f = door.face;
  const onFace =
    f === 'south' ? Math.abs(c.z - fp.zMax) < EPS && c.x >= fp.xMin && c.x <= fp.xMax
    : f === 'north' ? Math.abs(c.z - fp.zMin) < EPS && c.x >= fp.xMin && c.x <= fp.xMax
    : f === 'east' ? Math.abs(c.x - fp.xMax) < EPS && c.z >= fp.zMin && c.z <= fp.zMax
    : f === 'west' ? Math.abs(c.x - fp.xMin) < EPS && c.z >= fp.zMin && c.z <= fp.zMax
    : false;
  if (!onFace) fail(`${door.id}: el centre de la porta no és sobre la cara '${f}' de ${door.buildingId}`);
}

function buildDoors(mats, parent) {
  const group = makeGroup('Doors');
  for (const door of DOORS) {
    const building = BUILDINGS.find((b) => b.id === door.buildingId);
    if (!building) fail(`${door.id}: l'edifici '${door.buildingId}' no existeix`);
    const fp = building.visual.footprint;
    assertDoorOnFace(door, fp);

    const along = (door.face === 'south' || door.face === 'north') ? door.center.x : door.center.z;
    const f = faceFrame(fp, door.face, along);
    const g = makeGroup(door.id, door.id);
    g.position.set(f.x, 0, f.z);
    g.rotation.y = f.rotY;

    if (door.style === 'arch') {
      // Marc de pedra (darrere) + fulla de fusta (davant).
      const frameW = door.width + 2 * ARCH_MARGIN;
      const straight = door.height - door.width / 2;
      const frame = new THREE.Mesh(archGeometry(frameW, straight, ARCH_FRAME), mats.frameStone);
      frame.name = `${door.id}-frame`;
      g.add(frame);
      const leaf = new THREE.Mesh(archGeometry(door.width, straight, ARCH_DOOR), mats.darkWood);
      leaf.name = `${door.id}-leaf`;
      leaf.position.z = ARCH_FRAME;
      g.add(leaf);
    } else if (door.style === 'plank') {
      const hw = door.width / 2;
      const lw = door.lintelWidth / 2;
      let th = 0; // alçada del llindar
      if (door.steps) {
        const s = door.steps;
        th = s.count * s.riseEach;
        for (let k = 0; k < s.count; k++) {
          addBox(g, mats.wallStone, {
            xMin: -s.width / 2, xMax: s.width / 2,
            yMin: 0, yMax: s.riseEach * (s.count - k),
            zMin: k * s.depth, zMax: (k + 1) * s.depth,
          }, `${door.id}-step${k + 1}`);
        }
      }
      const top = th + door.height;
      addBox(g, mats.darkWood, { xMin: -hw, xMax: hw, yMin: th, yMax: top, zMin: 0, zMax: DOOR_SLAB }, `${door.id}-leaf`);
      addBox(g, mats.frameStone, { xMin: -lw, xMax: -hw, yMin: th, yMax: top, zMin: 0, zMax: DOOR_JAMB }, `${door.id}-jamb-l`);
      addBox(g, mats.frameStone, { xMin: hw, xMax: lw, yMin: th, yMax: top, zMin: 0, zMax: DOOR_JAMB }, `${door.id}-jamb-r`);
      addBox(g, mats.frameStone, { xMin: -lw, xMax: lw, yMin: top, yMax: top + 0.2, zMin: 0, zMax: DOOR_JAMB + 0.02 }, `${door.id}-lintel`);
      // Dues platines de ferro sobre la fulla
      for (const y of [th + 0.4, th + door.height - 0.5]) {
        addBox(g, mats.iron, { xMin: -hw, xMax: hw, yMin: y, yMax: y + 0.08, zMin: DOOR_SLAB, zMax: DOOR_SLAB + 0.02 }, `${door.id}-strap`);
      }
    } else {
      fail(`${door.id}: estil de porta desconegut '${door.style}'`);
    }
    group.add(g);
  }
  parent.add(group);
}

// ---------------------------------------------------------------------
// ATREZZO
// ---------------------------------------------------------------------
function buildFountain(mats, p) {
  const { center, acrossFlats, height, basinHeight } = p.visual;
  if (p.visual.shape !== 'octagon') fail(`${p.id}: només s'admet shape 'octagon'`);
  const g = makeGroup(p.id, p.id);
  g.position.set(center.x, 0, center.z);

  // Radi circumscrit d'un octàgon regular a partir de la distància pla a pla.
  const R = (acrossFlats / 2) / Math.cos(Math.PI / 8);
  const align = Math.PI / 8; // posa els PLANS (no els vèrtexs) sobre els eixos
  const F = FOUNTAIN;

  // Pica: perfil de revolució amb 8 costats.
  const inner = R - F.rimThickness;
  const basin = new THREE.LatheGeometry([
    new THREE.Vector2(R, 0),
    new THREE.Vector2(R, basinHeight),
    new THREE.Vector2(inner, basinHeight),
    new THREE.Vector2(inner, F.floorY),
    new THREE.Vector2(0, F.floorY),
  ], 8);
  basin.rotateY(align);
  addMesh(g, basin, mats.fountainStone, 0, 0, 0, `${p.id}-basin`);

  const bowlTop = height - F.finialHeight;
  const colH = bowlTop - F.floorY;
  const column = new THREE.CylinderGeometry(F.columnRadius, F.columnRadius, colH, 8);
  column.rotateY(align);
  addMesh(g, column, mats.fountainStone, 0, F.floorY + colH / 2, 0, `${p.id}-column`);

  const bowl = new THREE.CylinderGeometry(F.bowlRadius, F.columnRadius + 0.1, F.bowlHeight, 8);
  bowl.rotateY(align);
  addMesh(g, bowl, mats.fountainStone, 0, bowlTop - F.bowlHeight / 2, 0, `${p.id}-bowl`);

  const finial = new THREE.ConeGeometry(F.columnRadius, F.finialHeight, 8);
  finial.rotateY(align);
  addMesh(g, finial, mats.fountainStone, 0, bowlTop + F.finialHeight / 2, 0, `${p.id}-finial`);
  return g;
}

function buildTree(mats, p) {
  const { center, trunkRadius, height } = p.visual;
  const g = makeGroup(p.id, p.id);
  g.position.set(center.x, 0, center.z);

  const trunkH = height * 0.5;
  addMesh(g, new THREE.CylinderGeometry(trunkRadius * 0.75, trunkRadius, trunkH, 7),
    mats.trunk, 0, trunkH / 2, 0, `${p.id}-trunk`);

  // Capçada: tres icosaedres. El principal es col·loca perquè el seu punt
  // més alt coincideixi EXACTAMENT amb `height`.
  const crownGeo = new THREE.IcosahedronGeometry(2.0, 0);
  crownGeo.computeBoundingBox();
  const crownY = height - crownGeo.boundingBox.max.y;
  addMesh(g, crownGeo, mats.foliage, 0, crownY, 0, `${p.id}-crown`);
  addMesh(g, new THREE.IcosahedronGeometry(1.1, 0), mats.foliage, 1.0, crownY - 0.6, 0.5, `${p.id}-crown-b`);
  addMesh(g, new THREE.IcosahedronGeometry(1.1, 0), mats.foliage, -0.9, crownY - 0.7, -0.6, `${p.id}-crown-c`);
  return g;
}

function buildBench(mats, p) {
  const { footprint: fp, height: H, seatHeight: S, facing } = p.visual;
  requireRect(fp, `${p.id}.visual.footprint`);
  const g = makeGroup(p.id, p.id);
  const depthAlongX = facing === 'east' || facing === 'west';
  if (!depthAlongX && facing !== 'north' && facing !== 'south') fail(`${p.id}: facing desconegut '${facing}'`);
  const B = BENCH;
  const width = depthAlongX ? fp.zMax - fp.zMin : fp.xMax - fp.xMin;
  const depth = depthAlongX ? fp.xMax - fp.xMin : fp.zMax - fp.zMin;

  // (u, v) → caixa del món. u = al llarg de l'amplada; v = del DAVANT (0) al
  // DARRERE (depth) del banc (el darrere és el costat oposat a `facing`).
  const box = (u0, u1, v0, v1, y0, y1, mat, name) => {
    let xMin; let xMax; let zMin; let zMax;
    if (depthAlongX) {
      zMin = fp.zMin + u0; zMax = fp.zMin + u1;
      if (facing === 'west') { xMin = fp.xMin + v0; xMax = fp.xMin + v1; }
      else { xMin = fp.xMax - v1; xMax = fp.xMax - v0; }
    } else {
      xMin = fp.xMin + u0; xMax = fp.xMin + u1;
      if (facing === 'north') { zMin = fp.zMin + v0; zMax = fp.zMin + v1; }
      else { zMin = fp.zMax - v1; zMax = fp.zMax - v0; }
    }
    addBox(g, mat, { xMin, xMax, yMin: y0, yMax: y1, zMin, zMax }, `${p.id}-${name}`);
  };

  box(0, width, 0, depth, S - B.slab, S, mats.wood, 'seat');                    // seient
  box(0, B.slab, 0, depth, 0, S - B.slab, mats.wallStone, 'side-a');            // costats
  box(width - B.slab, width, 0, depth, 0, S - B.slab, mats.wallStone, 'side-b');
  box(0, width, depth - B.slab, depth, S + B.backGap, H, mats.wood, 'back');    // respatller
  box(0, B.slab, depth - B.slab, depth, S - B.slab, S + B.backGap, mats.wood, 'post-a'); // muntants
  box(width - B.slab, width, depth - B.slab, depth, S - B.slab, S + B.backGap, mats.wood, 'post-b');
  return g;
}

// Barril: perfil de revolució (panxa al mig) + dos cèrcols de ferro.
function makeBarrel(mats, id, cx, cz, radius, height) {
  const g = makeGroup(id, id);
  g.position.set(cx, 0, cz);
  const prof = [[0, 0], [0.8, 0], [0.93, 0.22], [1, 0.5], [0.93, 0.78], [0.8, 1], [0, 1]];
  const body = new THREE.LatheGeometry(
    prof.map(([r, y]) => new THREE.Vector2(r * radius, y * height)), 12);
  addMesh(g, body, mats.barrel, 0, 0, 0, `${id}-body`);
  for (const y of [0.22, 0.78]) {
    const hoop = new THREE.CylinderGeometry(0.935 * radius, 0.935 * radius, 0.04, 12, 1, true);
    addMesh(g, hoop, mats.iron, 0, y * height, 0, `${id}-hoop`);
  }
  return g;
}

function buildCrate(mats, p) {
  const fp = requireRect(p.visual.footprint, `${p.id}.visual.footprint`);
  const g = makeGroup(p.id, p.id);
  addBox(g, mats.crate, { ...fp, yMin: 0, yMax: p.visual.height }, `${p.id}-box`);
  return g;
}

function buildSign(mats, p) {
  const { center, postRadius, height } = p.visual;
  const g = makeGroup(p.id, p.id);
  g.position.set(center.x, 0, center.z);
  addMesh(g, new THREE.CylinderGeometry(postRadius, postRadius, height, 8),
    mats.darkWood, 0, height / 2, 0, `${p.id}-post`);
  // Taulell: de la vora del pal cap al carrer (−X) fins a `boardWidth`.
  addBox(g, mats.wood, {
    xMin: postRadius - SIGN.boardWidth, xMax: postRadius,
    yMin: SIGN.boardBottom, yMax: height,
    zMin: -SIGN.boardThick / 2, zMax: SIGN.boardThick / 2,
  }, `${p.id}-board`);
  return g;
}

function buildProps(mats, parent) {
  const group = makeGroup('Props');
  for (const p of PROPS) {
    switch (p.type) {
      case 'fountain': group.add(buildFountain(mats, p)); break;
      case 'tree': group.add(buildTree(mats, p)); break;
      case 'bench': group.add(buildBench(mats, p)); break;
      case 'barrelPair': {
        const g = makeGroup(p.id, p.id);
        for (const b of p.visual.barrels) {
          g.add(makeBarrel(mats, b.id, b.center.x, b.center.z, b.radius, b.height));
        }
        group.add(g);
        break;
      }
      case 'barrel': {
        const v = p.visual;
        group.add(makeBarrel(mats, p.id, v.center.x, v.center.z, v.radius, v.height));
        break;
      }
      case 'crate': group.add(buildCrate(mats, p)); break;
      case 'sign': group.add(buildSign(mats, p)); break;
      default: fail(`${p.id}: tipus d'atrezzo desconegut '${p.type}'`);
    }
  }
  parent.add(group);
}

// ---------------------------------------------------------------------
// FANALS
// ---------------------------------------------------------------------
function buildLanterns(mats, parent, options) {
  const group = makeGroup('Lanterns');
  const lights = [];
  const L = LANTERN;
  for (const lt of LIGHTS) {
    if (lt.type !== 'lantern') fail(`${lt.id}: tipus de llum desconegut '${lt.type}'`);
    const g = makeGroup(lt.id, lt.id);
    const M = lt.mountHeight;
    const { wallPoint: wp, glassPoint: gp } = lt;

    // Braç de ferro: de la paret al fanal, a l'alçada `mountHeight`.
    const dx = gp.x - wp.x;
    const dz = gp.z - wp.z;
    const len = Math.hypot(dx, dz);
    if (Math.abs(len - lt.armLength) > 1e-6) fail(`${lt.id}: armLength no coincideix amb wallPoint→glassPoint`);
    const arm = addMesh(g, new THREE.BoxGeometry(len, L.armThick, L.armThick), mats.iron,
      (wp.x + gp.x) / 2, M - L.armThick / 2, (wp.z + gp.z) / 2, `${lt.id}-arm`);
    arm.rotation.y = Math.atan2(-dz, dx); // X local → direcció del braç

    // Cos del fanal (penja del braç), centrat a glassPoint.
    const body = makeGroup(`${lt.id}-body`);
    body.position.set(gp.x, 0, gp.z);
    const yLink0 = M - L.link;
    const yCap0 = yLink0 - L.capHeight;
    const yRing0 = yCap0 - L.ring;
    const yGlass1 = yRing0;
    const yGlass0 = yGlass1 - L.glassHeight;
    const yBase0 = yGlass0 - L.base;
    addBox(body, mats.iron, { xMin: -0.01, xMax: 0.01, yMin: yLink0, yMax: M, zMin: -0.01, zMax: 0.01 }, `${lt.id}-link`);
    const cap = new THREE.ConeGeometry(L.capRadius, L.capHeight, 4);
    cap.rotateY(Math.PI / 4);
    addMesh(body, cap, mats.iron, 0, yCap0 + L.capHeight / 2, 0, `${lt.id}-cap`);
    const h = L.glass / 2 + 0.02;
    addBox(body, mats.iron, { xMin: -h, xMax: h, yMin: yRing0, yMax: yCap0, zMin: -h, zMax: h }, `${lt.id}-ring`);
    const gl = L.glass / 2;
    // El color del vidre surt del layout (glassColor); material propi per fanal.
    const glassMat = new THREE.MeshBasicMaterial({ color: lt.glassColor });
    const glass = addBox(body, glassMat, { xMin: -gl, xMax: gl, yMin: yGlass0, yMax: yGlass1, zMin: -gl, zMax: gl }, `${lt.id}-glass`);
    glass.castShadow = false;
    glass.receiveShadow = false;
    addBox(body, mats.iron, { xMin: -h, xMax: h, yMin: yBase0, yMax: yGlass0, zMin: -h, zMax: h }, `${lt.id}-base`);
    g.add(body);

    if (options.pointLights && lt.pointLight) {
      const pl = new THREE.PointLight(lt.glassColor, options.lightIntensity, options.lightDistance, 2);
      pl.name = `${lt.id}-light`;
      pl.position.set(gp.x, (yGlass0 + yGlass1) / 2, gp.z);
      g.add(pl);
      lights.push(pl);
    }
    group.add(g);
  }
  parent.add(group);
  return lights;
}

// ---------------------------------------------------------------------
// FUNCIÓ PÚBLICA
// ---------------------------------------------------------------------
export function buildVillage(scene, options = {}) {
  if (!scene || typeof scene.add !== 'function') fail('buildVillage(scene): cal una escena Three.js');
  const opts = {
    includeGround: false,
    pointLights: false,
    lightIntensity: 20,
    lightDistance: 12,
    ...options,
  };

  const mats = createMaterials();
  const root = new THREE.Group();
  root.name = 'Village';
  root.userData.layout = { name: LAYOUT_META.name, version: LAYOUT_META.version };

  if (opts.includeGround) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mats.ground);
    ground.name = 'Ground';
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = LAYOUT_META.groundY;
    ground.receiveShadow = true;
    root.add(ground);
  }

  buildBuildings(mats, root);
  buildWalls(mats, root);
  buildDoors(mats, root);
  buildProps(mats, root);
  const lanternLights = buildLanterns(mats, root, opts);

  scene.add(root);

  // Tot és estàtic: calculem les matrius una vegada i deixem d'actualitzar-les.
  root.updateMatrixWorld(true);
  let meshes = 0;
  root.traverse((o) => {
    o.matrixAutoUpdate = false;
    if (o.isMesh) meshes += 1;
  });

  const stats = {
    buildings: BUILDINGS.length, walls: WALLS.length, props: PROPS.length,
    doors: DOORS.length, lanterns: LIGHTS.length, meshes, pointLights: lanternLights.length,
  };

  function dispose() {
    root.removeFromParent();
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isMesh && o.material !== undefined && !Object.values(mats).includes(o.material)) {
        o.material.dispose();
      }
    });
    Object.values(mats).forEach((m) => m.dispose());
  }

  return { root, lanternLights, stats, dispose };
}
