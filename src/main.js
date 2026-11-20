
import * as THREE from 'three';
import { buildVillage, createGroundGeometry } from './world/village.js';
import { buildColliders, movePlayer, createMoveResult } from './player/collisions.js';
import { createSwingDoor } from './player/doors.js';
import { createGameplay, KEY_DESCRIPTIONS } from './player/puzzle.js';
import { createHouseDoor } from './player/houseDoors.js';
import { createFloors, smoothHeight } from './player/floors.js';
import { BUILDINGS, WALLS, PROPS, DOORS, FURNITURE, STAIRS, FLOORS, SECRET_DOOR, KEYS, CEM_WALLS, CEM_PROPS, CRYPT, CRYPT_WALLS, CRYPT_PROPS, CRYPT_FLOORS } from './world/layout.js';
import { createCryptAccess, undergroundView } from './player/crypt.js';
import { createNoteView } from './ui/noteView.js';
import { createCryptSounds } from './audio/cryptSounds.js';
// Fase D.3.1: menú de pausa, desar/carregar, documents i mapa (cada cosa al seu mòdul; aquí només es connecten)
import { createPauseController } from './game/pauseState.js';
import { captureState, canSave, applyState, readSave, writeSave, formatSavedAt } from './game/saveGame.js';
import { createDocuments, documentDefs, DOCUMENT_IDS } from './player/documents.js';
import { buildMapData, createMapProgress, buildMapModel } from './world/mapData.js';
import { drawMap } from './ui/mapView.js';
import { createPauseMenu } from './ui/pauseMenu.js';
import { inventoryEntries, documentEntries, NO_SAVE_TEXT } from './ui/menuModel.js';
import * as LAYOUT_ALL from './world/layout.js';

// -----------------------------------------------------
// 1. CONFIGURACIÓ (valors que pots retocar fàcilment)
// -----------------------------------------------------
const EYE_HEIGHT = 1.7;        // Alçada dels ulls en metres
const WALK_SPEED = 4.0;        // Velocitat de caminar (metres per segon)
const ACCELERATION = 10.0;     // Com de ràpid s'arriba a la velocitat màxima (més alt = més àgil)
const MOUSE_SENSITIVITY = 0.002; // Sensibilitat del ratolí
const MAP_LIMIT = 95;          // Límit del terra (el terra fa 200x200, de -100 a 100)
const PLAYER_RADIUS = 0.35;    // Radi de col·lisió del jugador (cercle en el pla XZ)

// -----------------------------------------------------
// 2. RENDERER (el que dibuixa l'escena a la pantalla)
// -----------------------------------------------------
// antialias desactivat: va millor en targetes gràfiques antigues
// i encaixa amb l'estil pixel-art.
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
// Limitem la densitat de píxels a 1 per no sobrecarregar la GPU.
renderer.setPixelRatio(1);

// Treiem els marges de la pàgina i afegim el canvas.
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#000';
document.body.appendChild(renderer.domElement);

// -----------------------------------------------------
// 3. ESCENA, BOIRA I ATMOSFERA NOCTURNA
// -----------------------------------------------------
const scene = new THREE.Scene();
// La boira i l'horitzó del cel comparteixen EXACTAMENT el mateix color: així el terra
// llunyà (esvaït per la boira) es fon amb el cel sense cap línia d'horitzó visible.
const SKY_ZENITH = 0x050a1a;            // Blau marí molt fosc (part alta del cel)
const SKY_HORIZON = 0x142038;           // Blau fred una mica més clar (horitzó i boira)
scene.background = new THREE.Color(SKY_HORIZON); // només és el color de reserva: el cel el tapa
scene.fog = new THREE.Fog(SKY_HORIZON, 8, 60);   // Boira: comença a 8 m i és total a 60 m

// -----------------------------------------------------
// 4. CÀMERA (els ulls del jugador)
// -----------------------------------------------------
const camera = new THREE.PerspectiveCamera(
  70,                                    // Camp de visió
  window.innerWidth / window.innerHeight,
  0.1,                                   // Distància mínima de dibuix
  100                                    // Distància màxima de dibuix
);
camera.position.set(0, EYE_HEIGHT, 27);  // Comencem a l'entrada del carrer (mirant cap al nord)
// L'ordre 'YXZ' evita que la càmera es "decanti" al girar i mirar amunt/avall.
camera.rotation.order = 'YXZ';

// -----------------------------------------------------
// 5. LLUMS
// -----------------------------------------------------

// Llum ambiental: permet veure el poble sense eliminar la nit.
const hemiLight = new THREE.HemisphereLight(0x9aafd0, 0x303040, 1.5);
scene.add(hemiLight);

// Llum de lluna: il·luminació freda i més intensa.
const moonLight = new THREE.DirectionalLight(0xb5c9ff, 1.2);
moonLight.position.set(-20, 40, 10);
scene.add(moonLight);

// -----------------------------------------------------
// 5b. CEL NOCTURN (degradat, lluna, estrelles i núvols)
// -----------------------------------------------------
// Tot el cel penja d'UN SOL grup que se situa a la posició de la càmera a cada
// fotograma (però MAI gira amb ella): el jugador no pot apropar-se a la geometria
// del cel i les estrelles/lluna queden fixes respecte al món. Cap peça del cel
// escriu al buffer de profunditat, així que el poble sempre es dibuixa per davant.
// Ordre de dibuix (renderOrder): cúpula → estrelles → núvols → halo → lluna.
// El cel no existeix per a les col·lisions ni per al pointer lock (no hi ha cap
// raycast ni llistat d'obstacles que el vegi).
const SKY = {
  domeRadius: 90,      // la càmera dibuixa fins a 100: tot el cel hi queda dins
  starRadius: 88,
  cloudRadius: 86,
  moonRadius: 80,
  moonDir: new THREE.Vector3(-0.5, 0.5, -0.7).normalize(), // ~30° d'alçada, al nord-oest
  moonSize: 10,        // costat del quad de la lluna (≈ 7° de diàmetre aparent)
  haloSize: 50,
  cloudSpeed: 0.003,   // rad/s: una volta completa cada ~35 min (gairebé imperceptible)
  starCount: 1000,
};

function skyRandom(seed) { // generador pseudoaleatori determinista (el cel és igual a cada partida)
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function skyClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function skySmooth(e0, e1, x) { const t = skyClamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

// Textura de canvas petita. `pixel` = filtre Nearest (píxel visible, estil pixel-art).
function skyCanvasTexture(w, h, pixel, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  paint(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.magFilter = pixel ? THREE.NearestFilter : THREE.LinearFilter;
  tex.minFilter = pixel ? THREE.NearestFilter : THREE.LinearFilter;
  return tex;
}

// Lluna 64×64: disc blanc trencat amb to blavós, mars i cràters, llum des de dalt-esquerra,
// enfosquiment a la vora i colors quantitzats (bandes de píxel visibles).
function paintMoon(ctx, w, h) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const rnd = skyRandom(1907);
  const c = (w - 1) / 2;
  const R = w / 2 - 1.5;
  const maria = []; const craters = [];
  for (let i = 0; i < 5; i++) { // mars: taques grans i fosques
    const a = rnd() * Math.PI * 2; const rr = rnd() * R * 0.55;
    maria.push({ x: c + Math.cos(a) * rr, y: c + Math.sin(a) * rr, r: 7 + rnd() * 7 });
  }
  for (let i = 0; i < 16; i++) { // cràters: forats petits amb vora il·luminada
    const a = rnd() * Math.PI * 2; const rr = Math.sqrt(rnd()) * R * 0.82;
    craters.push({ x: c + Math.cos(a) * rr, y: c + Math.sin(a) * rr, r: 2 + rnd() * 4 });
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - c; const dy = y - c;
      const dist = Math.hypot(dx, dy);
      if (dist > R) continue; // fora del disc: transparent
      let lum = 0.72 + 0.3 * skyClamp(0.5 - (dx + dy) / (R * 2.8), 0, 1); // llum cap a dalt-esquerra
      lum *= 1 - 0.24 * Math.pow(dist / R, 3);                               // vora més fosca
      for (const m of maria) {
        const md = Math.hypot(x - m.x, y - m.y) + Math.sin((x + y) * 0.9) * 0.9; // vora irregular
        if (md < m.r) lum *= 0.84;
      }
      for (const k of craters) {
        const kd = Math.hypot(x - k.x, y - k.y);
        if (kd < k.r - 0.6) lum *= 0.86;
        else if (kd < k.r + 0.7) lum *= ((x - k.x) + (y - k.y)) < 0 ? 1.07 : 0.93; // vora clara/ombra
      }
      lum *= 0.97 + rnd() * 0.05;
      lum = Math.round(skyClamp(lum, 0, 1.08) * 16) / 16; // paleta curta: aspecte pixel-art
      const i = (y * w + x) * 4;
      d[i] = Math.min(255, 226 * lum);
      d[i + 1] = Math.min(255, 233 * lum);
      d[i + 2] = Math.min(255, 247 * lum); // lleuger to blavós
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Halo: degradat radial suau (s'usarà en additiu, per tant només suma una mica de llum al cel).
function paintHalo(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0.00, 'rgba(185,205,255,0.55)');
  g.addColorStop(0.18, 'rgba(160,185,240,0.30)');
  g.addColorStop(0.40, 'rgba(120,150,215,0.12)');
  g.addColorStop(0.70, 'rgba(90,115,180,0.04)');
  g.addColorStop(1.00, 'rgba(70,95,160,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Núvols: soroll de valors que ENVOLTA horitzontalment (sense costura), 3 nivells d'alfa.
// Fila 0 = zenit, última fila = horitzó. Es desvaeixen als dos extrems.
function paintClouds(ctx, w, h) {
  const rnd = skyRandom(4242);
  const octaves = [{ gx: 8, gy: 4, amp: 0.55 }, { gx: 16, gy: 8, amp: 0.3 }, { gx: 32, gy: 16, amp: 0.15 }];
  for (const o of octaves) { // reixeta de valors aleatoris (la columna 0 es repeteix al final)
    o.lat = [];
    for (let j = 0; j <= o.gy; j++) {
      const row = [];
      for (let i = 0; i < o.gx; i++) row.push(rnd());
      o.lat.push(row);
    }
  }
  const sample = (o, u, v) => { // u, v en [0,1)
    const x = u * o.gx; const y = v * o.gy;
    const x0 = Math.floor(x); const y0 = Math.min(Math.floor(y), o.gy - 1);
    const fx = x - x0; const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
    const a = o.lat[y0][x0 % o.gx]; const b = o.lat[y0][(x0 + 1) % o.gx];
    const c = o.lat[y0 + 1][x0 % o.gx]; const e = o.lat[y0 + 1][(x0 + 1) % o.gx];
    return (a + (b - a) * sx) * (1 - sy) + (c + (e - c) * sx) * sy;
  };
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const levels = [ // [llindar, r, g, b, alfa]: blaus foscos i freds, molt subtils
    [0.56, 38, 56, 92, 46],
    [0.64, 32, 48, 82, 66],
    [0.72, 24, 38, 68, 84],
  ];
  for (let y = 0; y < h; y++) {
    const f = y / (h - 1);
    const fade = skySmooth(0.04, 0.16, f) * (1 - skySmooth(0.78, 0.96, f)); // sense núvols al zenit ni a l'horitzó
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (const o of octaves) v += sample(o, x / w, f * 0.999) * o.amp;
      v = v * fade + (1 - fade) * 0; // fora de la franja, no hi ha núvol
      let level = null;
      for (const l of levels) if (v >= l[0]) level = l;
      if (!level) continue;
      const i = (y * w + x) * 4;
      d[i] = level[1]; d[i + 1] = level[2]; d[i + 2] = level[3]; d[i + 3] = level[4];
    }
  }
  ctx.putImageData(img, 0, 0);
}

function createSky() {
  const group = new THREE.Group();
  group.name = 'Sky';
  const geometries = []; const materials = []; const textures = [];
  const track = (list, item) => { list.push(item); return item; };

  // --- Cúpula amb degradat (colors als vèrtexs + dithering: transició sense bandes) ---
  const domeGeo = track(geometries, new THREE.SphereGeometry(SKY.domeRadius, 24, 40));
  {
    const pos = domeGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cz = new THREE.Color(SKY_ZENITH); const ch = new THREE.Color(SKY_HORIZON); const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = skyClamp(pos.getY(i) / SKY.domeRadius, 0, 1); // 0 = horitzó, 1 = zenit
      tmp.lerpColors(ch, cz, Math.pow(t, 0.65));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    domeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const domeMat = track(materials, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, dithering: true,
  }));
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.name = 'SkyDome'; dome.renderOrder = -100; dome.frustumCulled = false;
  group.add(dome);

  // --- Estrelles: distribució no uniforme (banda més densa), evitant la zona de la lluna ---
  const rnd = skyRandom(777);
  const bandNormal = new THREE.Vector3(0.35, 0.8, -0.5).normalize(); // "camí de llet" molt subtil
  const dim = []; const bright = []; const twinkle = [[], [], []];
  const palette = [0xdfe8ff, 0xcdd9ff, 0xfff1d6, 0xffffff, 0xb8c8ff].map((h) => new THREE.Color(h));
  const dir = new THREE.Vector3();
  let placed = 0;
  for (let tries = 0; placed < SKY.starCount && tries < 60000; tries++) {
    const u = rnd() * 2 - 1; const a = rnd() * Math.PI * 2; const s = Math.sqrt(1 - u * u);
    dir.set(s * Math.cos(a), u, s * Math.sin(a));
    if (dir.y < 0.03) continue;                                   // només per sobre de l'horitzó
    if (dir.dot(SKY.moonDir) > Math.cos(0.17)) continue;          // la lluna i el seu halo queden nets
    const band = Math.abs(dir.dot(bandNormal));
    if (rnd() > 0.3 + 0.7 * Math.exp(-Math.pow(band / 0.22, 2))) continue; // més estrelles a la banda
    const kind = rnd();
    const base = palette[Math.floor(rnd() * palette.length)];
    const horizonFade = 0.35 + 0.65 * skySmooth(0.03, 0.3, dir.y); // més tènues a prop de l'horitzó
    let target; let lum;
    if (kind < 0.06) { target = bright; lum = 0.9 + rnd() * 0.1; }
    else if (kind < 0.14) { target = twinkle[Math.floor(rnd() * 3)]; lum = 0.8 + rnd() * 0.2; }
    else { target = dim; lum = 0.3 + rnd() * 0.45; }
    lum *= horizonFade;
    target.push(dir.x * SKY.starRadius, dir.y * SKY.starRadius, dir.z * SKY.starRadius, base.r * lum, base.g * lum, base.b * lum);
    placed += 1;
  }
  const starLayer = (data, size, order, animated) => {
    const n = data.length / 6;
    const p = new Float32Array(n * 3); const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = data[i * 6]; p[i * 3 + 1] = data[i * 6 + 1]; p[i * 3 + 2] = data[i * 6 + 2];
      c[i * 3] = data[i * 6 + 3]; c[i * 3 + 1] = data[i * 6 + 4]; c[i * 3 + 2] = data[i * 6 + 5];
    }
    const geo = track(geometries, new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    // Punts quadrats d'amplada fixa en píxels (sense atenuació): estrelles de píxel net.
    const mat = track(materials, new THREE.PointsMaterial({
      size, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false,
      transparent: animated, opacity: 1,
    }));
    const pts = new THREE.Points(geo, mat);
    pts.renderOrder = order; pts.frustumCulled = false;
    group.add(pts);
    return mat;
  };
  starLayer(dim, 2, -90, false);
  starLayer(bright, 3, -89, false);
  const twinkleMats = twinkle.map((data, i) => starLayer(data, i === 0 ? 3 : 2, -85 + i, true));
  const twinkleSpeed = [0.55, 0.8, 0.4];  // rad/s: períodes de 8 a 16 s
  const twinklePhase = [0, 2.1, 4.2];

  // --- Núvols: mitja cúpula amb textura transparent que gira molt lentament ---
  const cloudTex = track(textures, skyCanvasTexture(256, 64, true, paintClouds));
  const cloudGeo = track(geometries, new THREE.SphereGeometry(SKY.cloudRadius, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2));
  const cloudMat = track(materials, new THREE.MeshBasicMaterial({
    map: cloudTex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  clouds.name = 'SkyClouds'; clouds.renderOrder = -70; clouds.frustumCulled = false;
  group.add(clouds);

  // --- Halo i lluna: dos quads orientats cap a la càmera (el grup no gira, per tant fixos al món) ---
  const quad = track(geometries, new THREE.PlaneGeometry(1, 1));
  const haloTex = track(textures, skyCanvasTexture(128, 128, false, paintHalo));
  const haloMat = track(materials, new THREE.MeshBasicMaterial({
    map: haloTex, transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false,
  }));
  const halo = new THREE.Mesh(quad, haloMat);
  halo.name = 'MoonHalo'; halo.renderOrder = -60; halo.frustumCulled = false;
  halo.scale.set(SKY.haloSize, SKY.haloSize, 1);
  halo.position.copy(SKY.moonDir).multiplyScalar(SKY.moonRadius + 0.5);
  halo.lookAt(0, 0, 0); // el grup encara és a l'origen: la orientació és local i correcta
  group.add(halo);

  const moonTex = track(textures, skyCanvasTexture(64, 64, true, paintMoon));
  const moonMat = track(materials, new THREE.MeshBasicMaterial({
    map: moonTex, transparent: true, alphaTest: 0.5, fog: false, depthWrite: false,
  }));
  const moon = new THREE.Mesh(quad, moonMat);
  moon.name = 'Moon'; moon.renderOrder = -50; moon.frustumCulled = false;
  moon.scale.set(SKY.moonSize, SKY.moonSize, 1);
  moon.position.copy(SKY.moonDir).multiplyScalar(SKY.moonRadius);
  moon.lookAt(0, 0, 0);
  group.add(moon);

  scene.add(group);

  return {
    group,
    // Es crida a cada fotograma: segueix la càmera (només posició), anima núvols i parpelleig.
    update(dt, cam, seconds) {
      group.position.copy(cam.position);
      clouds.rotation.y += SKY.cloudSpeed * dt;
      for (let i = 0; i < twinkleMats.length; i++) {
        twinkleMats[i].opacity = 0.7 + 0.3 * Math.sin(seconds * twinkleSpeed[i] + twinklePhase[i]); // 0.4–1.0, lent
      }
    },
    dispose() {
      scene.remove(group);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

const sky = createSky();
// Alliberem els recursos GPU del cel en tancar/descarregar la pàgina.
window.addEventListener('pagehide', () => sky.dispose());

// -----------------------------------------------------
// 6. TERRA PROVISIONAL I POBLE
// -----------------------------------------------------
// MeshLambertMaterial és més lleuger que MeshStandardMaterial:
// ideal per a la teva AMD Radeon HD 6770M.
const ground = new THREE.Mesh(
  createGroundGeometry(200, [CRYPT.shaft.hole]), // Fase D.3: mateix terra 200×200, amb el forat de l'escala de la cripta
  new THREE.MeshLambertMaterial({ color: 0x2b2f38 })
);
ground.rotation.x = -Math.PI / 2; // El plànol és vertical per defecte; el posem horitzontal
scene.add(ground);

// Poble greybox (edificis, murs, font, arbre, atrezzo i fanals), construït
// a partir de les dades de src/world/layout.js.
const village = buildVillage(scene);

// Col·lidors: es construeixen UNA sola vegada a partir del mateix layout.
// FURNITURE: bancs, altar i mobles (Fase B); STAIRS: escala de la casa C (Fase C); CEM_WALLS / CEM_PROPS: cementiri, inaccessible (Fase D.2)
const colliders = buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS });
// Fase D.2: el cementiri és visible però inaccessible. Els seus murs i atrezzo (CEM_WALLS, CEM_PROPS) afegeixen només obstacles.
colliders.push(...buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CEM_WALLS, CEM_PROPS }));
// Fase D.3: cripta secreta (nivell −1), escala i tauleta de la caixa-pista. L'accés per la paret de l'altar només s'obre quan SD és 'open'
// (CH-N-B es parteix en dues peces; amb SD tancada tot és idèntic a abans).
colliders.push(...buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CRYPT_WALLS, CRYPT_PROPS }));
const cryptAccess = createCryptAccess(colliders, CRYPT);

// Porta física de l'església (D1): dues fulles que giren. Les seves col·lisions (segments)
// s'afegeixen a la mateixa llista i es MOUEN amb les fulles; doors.js en calcula l'estat.
const churchDoor = createSwingDoor(DOORS.find((d) => d.id === 'D1'));
colliders.push(...churchDoor.colliders);
const churchDoorVisual = village.doors.D1;
const syncDoorVisual = () => churchDoorVisual.setAngles(churchDoor.leaves[0].angle, churchDoor.leaves[1].angle);
syncDoorVisual();

// Primer puzle (Fase B): inventari, calaix/arca, dues claus i porta secreta. Tota la lògica és a src/player/puzzle.js;
// aquí només es connecten la mirada, la tecla E, el HUD i el que es dibuixa (village.puzzle).
// Portes de les cases A, B i C (Fase C): comencen TANCADES; E les obre i les tanca. El seu obstacle de pas és a la mateixa llista.
const houseDoors = DOORS.filter((d) => d.house).map((d) => createHouseDoor(d));
for (const hd of houseDoors) colliders.push(hd.collider);
const houseDoorVisuals = village.doors;
const shownDoor = {};
function syncHouseDoors() { // només toca la geometria quan l'angle ha canviat
  for (const hd of houseDoors) {
    const a = hd.signedAngle;
    if (shownDoor[hd.id] !== a) { shownDoor[hd.id] = a; houseDoorVisuals[hd.id].setAngle(a); }
  }
}
syncHouseDoors();

// Terra i escala de la casa C (Fase C): l'alçada dels peus depèn de la posició i del nivell (src/player/floors.js).
const floors = createFloors({ ...FLOORS, slabs: [...FLOORS.slabs, ...CRYPT_FLOORS.slabs], stairs: [...FLOORS.stairs, ...CRYPT_FLOORS.stairs], levelSplitDown: CRYPT_FLOORS.levelSplitDown });
let playerLevel = 0;      // 0 = planta baixa, 1 = pis superior, −1 = cripta (Fase D.3)
let feetY = 0;            // alçada dels peus (la càmera és a feetY + EYE_HEIGHT, suavitzada)
let eyeY = EYE_HEIGHT;

// Línia de visió de les portes de casa: només obstacles massissos (parets, escales), no els mobles baixos.
const doorOccluders = buildColliders({ BUILDINGS, WALLS, PROPS: [], FURNITURE: [], STAIRS });
const cryptOccluders = buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CRYPT_WALLS }).filter((c) => !c.id.startsWith('CH-N-B-')); // les peces de CH-N-B no són obstacles de visió
const gameplay = createGameplay({ KEYS, SECRET_DOOR, churchDoor, houseDoors, occluders: doorOccluders, playerRadius: PLAYER_RADIUS, crypt: { def: CRYPT, occluders: cryptOccluders } });
const cryptVisual = village.crypt;            // geometria i animacions de la cripta (grup propi, fora del poble)
const cryptSounds = createCryptSounds();
const noteView = createNoteView(CRYPT);
const baseFogNear = scene.fog.near; const baseFogFar = scene.fog.far;
const baseFogColor = scene.fog.color.clone(); const deepFogColor = new THREE.Color(CRYPT.ambient.fogColorDeep);
let cryptLightTarget = 0; let cryptLightX = CRYPT.lights[0].x; let cryptLightY = CRYPT.lights[0].y; let cryptLightZ = CRYPT.lights[0].z;
const puzzleVisual = village.puzzle;
const shown = { door: -1, drawer: -1, lid: -1, keys: {}, inserted: {} };
function syncPuzzleVisual() { // només toca la geometria quan l'estat ha canviat
  const sd = gameplay.secretDoor.progress();
  if (sd !== shown.door) { shown.door = sd; puzzleVisual.setSecretDoorProgress(sd); }
  for (const [id, key] of [['A-DRS', 'drawer'], ['B-CHS', 'lid']]) {
    const p = gameplay.containers[id].progress();
    if (p !== shown[key]) { shown[key] = p; puzzleVisual.setContainerProgress(id, p); }
  }
  for (const k of KEYS) {
    const vis = gameplay.containers[k.container].isOpen() && !gameplay.hasKeyTaken(k.id);
    if (vis !== shown.keys[k.id]) { shown.keys[k.id] = vis; puzzleVisual.setKeyVisible(k.id, vis); }
    const ins = gameplay.secretDoor.isInserted(k.id);
    if (ins !== shown.inserted[k.id]) { shown.inserted[k.id] = ins; puzzleVisual.setKeyInserted(k.id, ins); }
  }
}
const cryptShown = { disc: [NaN, NaN, NaN], seal: -1, unlock: -1, lid: -1, key: null, sel: -2 };
function syncCryptVisual(px, pz, dirX, dirZ, t) { // només toca la geometria quan l'estat ha canviat
  const cg = gameplay.crypt; const h = cryptVisual.handles;
  for (let i = 0; i < 3; i++) { const a = cg.puzzle.discAngle(i); if (a !== cryptShown.disc[i]) { cryptShown.disc[i] = a; h.setDiscAngle(i, a); } }
  const seal = cg.puzzle.sealProgress(); if (seal !== cryptShown.seal) { cryptShown.seal = seal; h.setSeal(seal); }
  const un = cg.sarcophagus.unlockProgress(); if (un !== cryptShown.unlock) { cryptShown.unlock = un; h.setSarcUnlock(un); }
  const lid = cg.sarcophagus.lidProgress(); if (lid !== cryptShown.lid) { cryptShown.lid = lid; h.setLid(lid); }
  const kv = cg.sarcophagus.keyVisible() && !cg.sarcophagus.keyTaken(); if (kv !== cryptShown.key) { cryptShown.key = kv; h.setKeyVisible(kv); }
  const sel = !cg.puzzle.solved() && gameplay.target && gameplay.target.id === 'CR-DISCS' ? cg.puzzle.aimedDisc(px, pz, dirX, dirZ) : -1;
  if (sel !== cryptShown.sel) { cryptShown.sel = sel; h.setSelectedDisc(sel); }
}
const CRYPT_SOUND = { disc: 'disc', solved: 'solved', mechanism: 'mechanism', lid: 'lid', key: 'key', note: 'note' };
function cryptFrame(dt, seconds) { // arbres d'accés, llum, visibilitat i sons de la cripta
  const px = camera.position.x; const pz = camera.position.z;
  cryptAccess.sync(gameplay.secretDoor.state);
  const view = undergroundView(feetY, px, pz, CRYPT);
  village.root.visible = view.villageVisible;
  cryptVisual.interior.visible = view.interiorVisible;
  hemiLight.intensity = view.hemi; moonLight.intensity = view.moon;
  scene.fog.near = baseFogNear + (view.fogNearDeep - baseFogNear) * view.fogT;
  scene.fog.far = baseFogFar + (view.fogFarDeep - baseFogFar) * view.fogT;
  scene.fog.color.copy(baseFogColor).lerp(deepFogColor, view.fogT);
  // Una sola llum puntual: s'apropa al racó d'espelmes més proper (suau) i parpelleja.
  let best = CRYPT.lights[0]; let bd = Infinity;
  for (const l of CRYPT.lights) { const d = Math.hypot(l.x - px, l.z - pz); if (d < bd) { bd = d; best = l; } }
  const k = 1 - Math.exp(-3 * dt);
  cryptLightX += (best.x - cryptLightX) * k; cryptLightY += (best.y - cryptLightY) * k; cryptLightZ += (best.z - cryptLightZ) * k;
  cryptVisual.light.position.set(cryptLightX, cryptLightY, cryptLightZ);
  const want = view.lightOn ? CRYPT.light.intensity * (0.93 + 0.04 * Math.sin(seconds * 9.1) + 0.03 * Math.sin(seconds * 23.7)) : 0;
  cryptLightTarget += (want - cryptLightTarget) * Math.min(1, 6 * dt);
  cryptVisual.light.intensity = cryptLightTarget;
  for (const ev of gameplay.crypt.drainEvents()) if (CRYPT_SOUND[ev.type]) cryptSounds.play(CRYPT_SOUND[ev.type]);
  noteView.setVisible(gameplay.crypt.note.isOpen());
}
const moveResult = createMoveResult(); // objecte reutilitzat cada fotograma (sense crear brossa)

// -----------------------------------------------------
// 7. CAPA D'INSTRUCCIONS (overlay)
// -----------------------------------------------------
const overlay = document.createElement('div');
overlay.style.cssText = `
  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  color: #d8dcea;
  font-family: Georgia, serif;
  text-align: center;
  cursor: pointer;
  user-select: none;
`;
overlay.innerHTML = `
  <div style="font-size: 32px; margin-bottom: 16px;">The Forgotten Village</div>
  <div style="font-size: 20px; margin-bottom: 24px;">Clica per començar</div>
  <div style="font-size: 16px; line-height: 1.8; opacity: 0.85;">
    W A S D — moure's<br>
    Ratolí — mirar al voltant<br>
    E — interactuar (portes, calaixos, claus)<br>
    Esc — menú de pausa (inventari, documents, mapa, guardar i carregar)
  </div>
`;
document.body.appendChild(overlay);

// Indicador de la porta (només visible a prop de la porta de l'església, amb el ratolí capturat).
// pointer-events: none → no intercepta clics ni afecta el pointer lock.
const doorHint = document.createElement('div'); // indicació de la tecla E (només amb un objecte interactuable davant)
doorHint.style.cssText = `
  position: fixed; left: 50%; bottom: 12%; transform: translateX(-50%);
  padding: 6px 14px; display: none; pointer-events: none; user-select: none;
  background: rgba(0, 0, 0, 0.45); color: #d8dcea; border-radius: 4px;
  font-family: Georgia, serif; font-size: 16px;
`;
document.body.appendChild(doorHint);
// Missatges (examinar la porta, recollir una clau...) i inventari mínim. Tots amb pointer-events: none.
const messageBox = document.createElement('div');
messageBox.style.cssText = `
  position: fixed; left: 50%; bottom: 20%; transform: translateX(-50%); max-width: 70%;
  padding: 10px 18px; display: none; pointer-events: none; user-select: none; text-align: center;
  background: rgba(0, 0, 0, 0.6); color: #e6dcc0; border-radius: 4px;
  font-family: Georgia, serif; font-size: 18px; line-height: 1.4;
`;
document.body.appendChild(messageBox);
const inventoryBox = document.createElement('div');
inventoryBox.style.cssText = `
  position: fixed; left: 16px; top: 16px; padding: 8px 12px; display: none; pointer-events: none; user-select: none;
  background: rgba(0, 0, 0, 0.45); color: #d8dcea; border-radius: 4px;
  font-family: Georgia, serif; font-size: 15px; line-height: 1.5;
`;
document.body.appendChild(inventoryBox);

// -----------------------------------------------------
// 8. POINTER LOCK (captura del ratolí)
// -----------------------------------------------------
// Només es pot activar com a resposta a un clic de l'usuari.
function requestLock() {
  const r = renderer.domElement.requestPointerLock();
  if (r && typeof r.catch === 'function') r.catch(() => { pause.onLockError(); pauseMenu.setHint('El navegador no ha deixat recuperar el ratolí. Torna a fer clic a «Tornar al joc».'); });
}
overlay.addEventListener('click', () => { requestLock(); });

// Aquest esdeveniment salta quan el ratolí es captura o s'allibera. ESC amb el ratolí capturat NOMÉS el desactiva (el navegador no
// envia cap `keydown`): per això la pausa neix aquí (Fase D.3.1). Mentre hi ha pausa, el joc no avança (vegeu animate()).
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  pause.onLockChange(locked);
  if (locked) {
    overlay.style.display = 'none'; pauseMenu.hide();
  } else {
    // Si sortim, esborrem les tecles premudes i la velocitat perquè el jugador no segueixi caminant sol.
    for (const key in keys) keys[key] = false;
    velocity.set(0, 0, 0);
    if (pause.started) { overlay.style.display = 'none'; pauseMenu.show(); } else overlay.style.display = 'flex';
  }
});

document.addEventListener('pointerlockerror', () => {
  console.warn('No s\'ha pogut capturar el ratolí.');
  pause.onLockError();
  if (pause.started) pauseMenu.setHint('No s\'ha pogut recuperar el ratolí. Torna a fer clic a «Tornar al joc».');
});

// -----------------------------------------------------
// 9. ENTRADA: TECLAT I RATOLÍ
// -----------------------------------------------------
const keys = { forward: false, back: false, left: false, right: false };

// Fem servir event.code (posició física de la tecla), així WASD funciona
// igual amb qualsevol disposició de teclat.
function setKey(code, pressed) {
  if (code === 'KeyW') keys.forward = pressed;
  if (code === 'KeyS') keys.back = pressed;
  if (code === 'KeyA') keys.left = pressed;
  if (code === 'KeyD') keys.right = pressed;
}
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') { // només arriba amb el ratolí lliure (menú de pausa obert): reprèn la partida
    if (pause.paused && !e.repeat) pause.onEscape();
    return;
  }
  if (document.pointerLockElement === renderer.domElement) setKey(e.code, true); // en pausa no s'acumulen tecles
  // E: interacciona amb UN SOL objecte (el més proper i davant dels ulls): porta de l'església, calaix, arca, clau
  // o porta secreta. Només amb el ratolí capturat i sense repetició de tecla.
  if (e.code === 'KeyE' && !e.repeat && document.pointerLockElement === renderer.domElement) {
    gameplay.pressE(camera.position.x, camera.position.z, -Math.sin(yaw), -Math.cos(yaw), { level: playerLevel, feetY });
  }
});
document.addEventListener('keyup', (e) => setKey(e.code, false));

// Rotació de la càmera:
// yaw = girar a esquerra/dreta, pitch = mirar amunt/avall (en radians).
let yaw = 0;
let pitch = 0;
const MAX_PITCH = Math.PI / 2 - 0.05; // Gairebé 90°, sense arribar a girar el cap del revés

document.addEventListener('mousemove', (e) => {
  // Només girem si el ratolí està capturat i el moviment és fiable (sense el salt que alguns navegadors fan en recuperar el ratolí).
  if (document.pointerLockElement !== renderer.domElement) return;
  if (!pause.acceptMouse(e.movementX, e.movementY)) return;
  yaw -= e.movementX * MOUSE_SENSITIVITY;
  pitch -= e.movementY * MOUSE_SENSITIVITY;
  // Limitem el pitch perquè no es pugui fer una volta completa.
  pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
});

// -----------------------------------------------------
// 10. MOVIMENT
// -----------------------------------------------------
let gameTime = 0;                            // segons de joc (no avança en pausa)
const velocity = new THREE.Vector3();        // Velocitat actual (suavitzada)
const targetVelocity = new THREE.Vector3();  // Velocitat que volem aconseguir
const forwardDir = new THREE.Vector3();
const rightDir = new THREE.Vector3();

function updateHud() { // indicació d'E, missatge i inventari
  const locked = document.pointerLockElement === renderer.domElement;
  const hintText = locked ? (gameplay.prompt || gameplay.hint(camera.position.x, camera.position.z)) : ''; // sense objectiu: indicació discreta de l'altar (D.3)
  if (doorHint.textContent !== hintText) { doorHint.textContent = hintText; doorHint.style.display = hintText ? 'block' : 'none'; }
  const msgText = gameplay.message;
  if (messageBox.textContent !== msgText) { messageBox.textContent = msgText; messageBox.style.display = msgText ? 'block' : 'none'; }
  const inv = gameplay.inventory.list();
  const invText = inv.length ? `Inventari — ${inv.map((i) => i.name).join(' · ')}   (${inv.length}/${KEYS.length + 1} claus)` : '';
  if (inventoryBox.textContent !== invText) { inventoryBox.textContent = invText; inventoryBox.style.display = invText ? 'block' : 'none'; }
}

function updatePlayer(dt) {
  gameTime += dt;   // rellotge de joc: s'atura en pausa (efectes dependents del temps: parpelleig de la llum, cel, etc.)
  // Direccions "endavant" i "dreta" segons cap a on mira el jugador (només horitzontal).
  forwardDir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  rightDir.set(Math.cos(yaw), 0, -Math.sin(yaw));

  // Sumem les direccions segons les tecles premudes.
  targetVelocity.set(0, 0, 0);
  if (keys.forward) targetVelocity.add(forwardDir);
  if (keys.back) targetVelocity.sub(forwardDir);
  if (keys.right) targetVelocity.add(rightDir);
  if (keys.left) targetVelocity.sub(rightDir);

  // Normalitzem perquè caminar en diagonal no sigui més ràpid.
  if (targetVelocity.lengthSq() > 0) {
    targetVelocity.normalize().multiplyScalar(WALK_SPEED);
  }

  // Apropem la velocitat actual a la desitjada: arrencada i frenada suaus però àgils.
  const blend = Math.min(1, ACCELERATION * dt);
  velocity.lerp(targetVelocity, blend);

  // Apliquem el moviment amb col·lisions: movePlayer() empeny el jugador fora
  // de parets i objectes i el deixa lliscar al llarg d'ells.
  // Primer la porta (les fulles cedeixen si el jugador les empeny o s'animen amb E) i després el moviment:
  // així movePlayer() ja veu les fulles a la seva posició real d'aquest fotograma.
  const doorStep = churchDoor.update(dt, camera.position.x, camera.position.z, velocity.x * dt, velocity.z * dt, PLAYER_RADIUS, colliders);
  if (doorStep.nudged) { // una fulla animada amb E ha empès el jugador cap enrere (de forma segura)
    camera.position.x = doorStep.x;
    camera.position.z = doorStep.z;
  }
  movePlayer(
    camera.position.x, camera.position.z,   // posició actual
    velocity.x * dt, velocity.z * dt,       // desplaçament d'aquest fotograma
    PLAYER_RADIUS, colliders, moveResult, playerLevel
  );
  camera.position.x = moveResult.x;
  camera.position.z = moveResult.z;

  // Límits del mapa (seguretat: el poble ja queda tancat pels murs).
  camera.position.x = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, camera.position.x));
  camera.position.z = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, camera.position.z));

  // Terra: pla a y = 0 excepte a la casa C (escala i pis superior). L'alçada dels peus surt de la posició i el nivell;
  // els ulls hi van darrere, suavitzats (sense salts a cada graó).
  const fl = floors.resolve(camera.position.x, camera.position.z, playerLevel);
  feetY = fl.y; playerLevel = fl.level;
  eyeY = smoothHeight(eyeY, feetY + EYE_HEIGHT, dt);
  camera.position.y = eyeY;

  syncDoorVisual(); // la fulla dibuixada segueix la de la física (no toca res si no s'ha mogut)

  // Puzle: l'estat avança i el que es veu el segueix; després el HUD (indicació d'E, missatge i inventari).
  gameplay.update(dt, camera.position.x, camera.position.z, -Math.sin(yaw), -Math.cos(yaw), { level: playerLevel, feetY });
  syncPuzzleVisual();
  syncHouseDoors();
  cryptFrame(dt, gameTime);
  syncCryptVisual(camera.position.x, camera.position.z, -Math.sin(yaw), -Math.cos(yaw));
  trackProgress();
  updateHud();

  // Apliquem la rotació a la càmera.
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

// -----------------------------------------------------
// 10b. PAUSA, DOCUMENTS, MAPA, DESAR I CARREGAR (Fase D.3.1)
// -----------------------------------------------------
// La lògica és als mòduls: game/pauseState.js (pausa i pointer lock), game/saveGame.js (desar/validar/carregar), player/documents.js,
// world/mapData.js i ui/pauseMenu.js. Aquí només es connecten amb el joc.
const pause = createPauseController({ requestLock: () => requestLock() });
const documents = createDocuments(documentDefs(CRYPT));
const mapData = buildMapData(LAYOUT_ALL);
const mapProgress = createMapProgress(mapData);
const houseDoorIds = DOORS.filter((d) => d.house).map((d) => d.id);
const churchSwing = DOORS.find((d) => d.id === 'D1').swing;
const saveDefs = {
  KEYS, CRYPT, SECRET_DOOR, houseDoorIds,
  churchLimits: { min: (churchSwing.minAngleDeg * Math.PI) / 180, max: (churchSwing.maxAngleDeg * Math.PI) / 180 },
  documentIds: documents.knownIds(), noteDocumentId: DOCUMENT_IDS.symbolNote, zoneIds: mapData.zones.map((z) => z.id),
  levelSplit: FLOORS.levelSplit, levelSplitDown: CRYPT_FLOORS.levelSplitDown, mapLimit: MAP_LIMIT,
};
let storage = null;
try { storage = window.localStorage; } catch (e) { storage = null; }

function getPose() { return { x: camera.position.x, z: camera.position.z, yaw, pitch, level: playerLevel, feetY }; }
function setPose(p) {
  camera.position.x = p.x; camera.position.z = p.z; yaw = p.yaw; pitch = p.pitch;
  const fl = floors.resolve(p.x, p.z, p.level); feetY = fl.y; playerLevel = fl.level;   // l'alçada surt del terra, no de la dada desada
  eyeY = feetY + EYE_HEIGHT; camera.position.y = eyeY;
  velocity.set(0, 0, 0);
  camera.rotation.y = yaw; camera.rotation.x = pitch;
}
const mapFlags = () => ({ sdOpen: gameplay.secretDoor.state === 'open', cemeteryOpen: false }); // el cementiri no s'obre fins a la Fase D.4
function trackProgress() { // documents descoberts i zones del mapa (cada fotograma de joc; molt barat)
  if (gameplay.crypt && gameplay.crypt.note.seen()) documents.discover(DOCUMENT_IDS.symbolNote);
  mapProgress.update(camera.position.x, camera.position.z, playerLevel, mapFlags());
}
const saveCtx = () => ({ gameplay, getPose, setPose, documents, mapProgress, colliders, radius: PLAYER_RADIUS, mapLimit: MAP_LIMIT, afterRestore: () => cryptAccess.sync(gameplay.secretDoor.state) });

// Després de carregar: la geometria, la llum i el HUD es posen al dia sense fer avançar el temps de joc.
function refreshWorld() {
  syncDoorVisual(); syncPuzzleVisual(); syncHouseDoors();
  cryptFrame(0, gameTime);
  syncCryptVisual(camera.position.x, camera.position.z, -Math.sin(yaw), -Math.cos(yaw));
  trackProgress(); updateHud();
}
function doSave() {
  if (!storage) return { ok: false, message: 'El navegador no permet desar (emmagatzematge no disponible).' };
  trackProgress();
  const c = canSave(saveCtx());
  if (!c.ok) return { ok: false, message: c.reason };
  const data = captureState(saveCtx());
  const w = writeSave(storage, data);
  return w.ok ? { ok: true, message: `Partida guardada (${formatSavedAt(data.savedAt)}).` } : { ok: false, message: w.error };
}
function doLoad() {
  if (!storage) return { ok: false, message: 'El navegador no permet carregar (emmagatzematge no disponible).' };
  const r = readSave(storage);
  if (r.status === 'none') return { ok: false, message: NO_SAVE_TEXT };
  if (r.status !== 'ok') return { ok: false, message: 'La partida desada està malmesa i no es pot carregar.' };
  const res = applyState(saveCtx(), r.data, saveDefs);
  if (!res.ok) { console.warn('Càrrega refusada:', res.errors); return { ok: false, message: res.error }; }
  refreshWorld();
  return { ok: true, message: 'Partida carregada. Prem «Tornar al joc» per continuar.' };
}
const pauseMenu = createPauseMenu({
  drawMap,
  model: {
    getInventory: () => inventoryEntries({ KEYS, CRYPT, keyDescription: (k) => KEY_DESCRIPTIONS[k.material] }, gameplay.inventory.list().map((i) => i.id)),
    getDocuments: () => documentEntries(documents.list()),
    getMap: () => { trackProgress(); return buildMapModel(mapData, mapProgress, getPose(), mapFlags()); },
    getSaveInfo: () => { const r = readSave(storage || { getItem: () => { throw new Error('sense emmagatzematge'); } }); return { status: r.status, savedAt: r.data && r.data.savedAt }; },
  },
  actions: { resume: () => pause.resume(), save: doSave, load: doLoad },
});
// Eina de depuració per a proves en navegador (consola: window.__forgottenVillage); el joc no la fa servir
window.__forgottenVillage = { pause, documents, getPose, setPose, refreshWorld, doSave, doLoad, gameplay, mapProgress, get gameTime() { return gameTime; } };

// -----------------------------------------------------
// 11. REDIMENSIONAT DE LA FINESTRA
// -----------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -----------------------------------------------------
// 12. BUCLE PRINCIPAL
// -----------------------------------------------------
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  // dt = segons des de l'últim fotograma. El limitem a 0,05 s
  // per evitar salts grans si la pestanya queda en segon pla.
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // En pausa (ratolí alliberat després d'haver començat) el temps de joc NO avança: ni moviment, ni interaccions, ni portes, ni cel.
  const gdt = pause.started ? pause.gameDt(dt) : dt; // abans del primer clic el món «respira» (el jugador no es pot moure)
  if (gdt > 0) {
    updatePlayer(gdt);
    sky.update(gdt, camera, gameTime); // el cel segueix la càmera (després de moure-la)
  }
  renderer.render(scene, camera);
}

animate();
