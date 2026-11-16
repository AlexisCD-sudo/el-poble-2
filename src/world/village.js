// =====================================================================
// THE FORGOTTEN VILLAGE — POBLE 3D DE LA PLAÇA CENTRAL (Fase 6 + Fase A: església)
// =====================================================================
// Converteix les dades de `layout.js` en geometria Three.js amb estil
// low-poly i textures pixel-art generades per codi (sense fitxers externs,
// sense models, sense dependències noves).
//
//   - NO duplica coordenades del layout: edificis, murs, portes, atrezzo i
//     fanals surten de layout.js. Aquí només hi ha disseny visual.
//   - NO toca les col·lisions (això és `src/player/collisions.js`). Els detalls
//     decoratius sobresurten com a molt 0,25 m (ràfecs a >5 m d'alçada) i
//     la resta ≤ 0,15 m; tots són purament visuals.
//   - Rendiment: tota la decoració d'un objecte es FUSIONA en poques malles
//     (una per material). Les textures són minúscules (16–64 px) amb
//     filtre Nearest, perquè el píxel es vegi i la GPU antiga ho aguanti.
//
// ÚS:
//   import { buildVillage } from './world/village.js';
//   const village = buildVillage(scene);   // afegeix el poble a l'escena
//   village.dispose();                     // el treu i allibera memòria
//
// OPCIONS de buildVillage(scene, options):
//   includeGround  (false)  terra pla propi (main.js ja en té un).
//   pointLights    (false)  PointLight als fanals F1 i F3 (valors PROVISIONALS).
//   lightIntensity (20)     intensitat provisional (candeles, Three r155+).
//   lightDistance  (12)     abast provisional en metres.
//   textures       (true)   false = només colors plans (útil per depurar).
//   decor          (true)   false = sense empedrat, molsa, heura, herba ni terra als marges.
//   glow           (true)   halo suau al voltant dels fanals (un sprite per fanal).
//
// RETORNA { root, lanternLights, stats, dispose }.
//
// DECISIONS DE DISSENY (el layout no les defineix; només visuals):
//   - Carener paral·lel al costat LLARG de l'empremta. Teulades amb ràfec de
//     0,25 m i hastial de 0,18 m. Façanes de pedra amb sòcol, bigues i finestres.
//   - Finestres/bigues només a la façana i a les dues cares laterals de cada
//     casa (no a la cara de darrere). Les finestres s'eviten al costat de
//     portes i fanals. Totes les finestres són fosques (ART_GUIDE 5.1).
//   - Xemeneies: a la carena de les tres cases, posició al llarg de la carena
//     decidida aquí (el layout no la defineix).
//   - Campanar: `height` = alçada TOTAL fins a la punta de la creu
//     (cos 10,4 + piràmide 2,8 + creu 0,8 = 14,0 m). La cara sud del campanar
//     sobresurt 2 cm del pla z = −9 per evitar parpelleig amb la nau (visual).
//   - Portes: l'alçada 2,0 m es mesura des del llindar (damunt dels esglaons);
//     cada esglaó fa `depth` de fons (2 esglaons = 1,2 m, sense col·lisió).
//   - Arbre ARB: tronc tortuós amb escorça, 5 arrels a ras de terra, 3 branques
//     principals, branquetes seques i capçada de cartes de fulles (alpha-test).
//     Posició i alçada total (6 m, exacta) del layout; l'eixamplament de la base
//     i les arrels (≤ 1,5 m, ≤ 0,2 m d'alçada) són només visuals, sense col·lisió.
//   - Església, nau CH-N (FASE A): ja NO és un prisma massís sinó parets BUIDES:
//     façana sud (0,6 m, amb l'arc de D1 tallat), paret del fons (0,6 m) i parets
//     E/W (1,0 m, amb 3 finestres d'arc apuntat cada una). Els gruixos i l'interior
//     surten de `visual.interior.footprint` del layout (res de coordenades noves).
//     L'interior és il·luminat només per l'ambient (cap llum nova): les cares
//     interiors es pinten més fosques (to als vèrtexs) i hi ha uns petits ramals
//     de llum de lluna blavosa al terra (calcomanies additives, sense llum real).
//     Sostre: forjat de fusta inclinat + encavallades (tirants, cabirons, pal
//     central, tornapuntes), carener i dues corretges. Cap banc, altar ni vitrall.
//   - Porta D1: marc de pedra per fora, bastiment de fusta per dins i DUES FULLES MÒBILS
//     de roure fosc (peces `D1-leaf-W` i `D1-leaf-E`, pivots amb matriu viva) que giren
//     sobre les frontisses cap a dins de la nau. `buildVillage` retorna `doors.D1.setAngles()`
//     perquè main.js hi posi els angles calculats per src/player/doors.js (física i col·lisió).
//     L'obertura de 2,2 m és la mateixa que el buit de col·lisió entre CH-N-FW i CH-N-FE.
//   - Campanar: el cos és una sola caixa fins al límit de la col·lisió (x = −4); el
//     tros que queda dins la paret de la nau només es dibuixa per sobre del ràfec
//     (7 m), perquè la cara est del campanar no coincideixi amb la paret interior.
//   - Cartell CT: taulell a y 1,85–2,2, cap al costat del carrer.
//   - Heura, molsa i herba: posicions decidides aquí (decoració).
// =====================================================================

import * as THREE from 'three';
import { houseDoorGeometry } from '../player/houseDoors.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LAYOUT_META, PLAZA, BUILDINGS, WALLS, PROPS, DOORS, LIGHTS, FURNITURE, SECRET_DOOR, KEYS, CANDLES, COBWEBS, INTERIOR_LIGHTS, FLOORS, STAIRS, GATE, FOREST } from './layout.js';

const EPS = 1e-9;
const TILE = { stone: 4, roof: 4, wood: 2 }; // metres per rajola de textura (≈16 px/m)

function fail(msg) {
  throw new Error(`[village.js] ${msg}`);
}

// Generador pseudo-aleatori determinista: el poble és idèntic a cada càrrega.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Multiplica els canals d'un color 0xRRGGBB (variació subtil de to).
function shade(hex, f) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c((hex >> 16) & 255) << 16) | (c((hex >> 8) & 255) << 8) | c(hex & 255);
}

// Variació aleatòria de to: ±amount (p. ex. 0.1 = ±10 %).
function jit(hex, amount, rnd) {
  return shade(hex, 1 + (rnd() * 2 - 1) * amount);
}

// ---------------------------------------------------------------------
// TEXTURES PIXEL-ART (generades per codi, mides petites, filtre Nearest)
// ---------------------------------------------------------------------
// `painter(px, w, h)` dibuixa amb px(x, y, 0xRRGGBB, alfa). Les coordenades
// donen la volta (textura repetible). Sense <canvas> (p. ex. en Node) retorna
// null i el poble es fa amb colors plans.
function makeTexture(w, h, painter) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx || typeof ctx.createImageData !== 'function') return null;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const px = (x, y, hex, a = 255) => {
    const xx = ((Math.floor(x) % w) + w) % w;
    const yy = ((Math.floor(y) % h) + h) % h;
    const i = (yy * w + xx) * 4;
    d[i] = (hex >> 16) & 255;
    d[i + 1] = (hex >> 8) & 255;
    d[i + 2] = hex & 255;
    d[i + 3] = a;
  };
  painter(px, w, h);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;              // píxel visible
  t.minFilter = THREE.NearestMipmapNearestFilter; // píxel dur, sense parpelleig lluny
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function paintStone(px, w, h) {
  const rnd = mulberry32(11);
  const tones = [0x9c8f76, 0xb0a283, 0xa59878, 0x8a7f6a, 0xbaac8c, 0x7a7566];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, 0x9c8f76);
  for (let i = 0; i < 150; i++) { // clústers de 2–4 píxels (ART_GUIDE 3.1)
    const cx = Math.floor(rnd() * w); const cy = Math.floor(rnd() * h);
    const cw = 2 + Math.floor(rnd() * 3); const ch = 2 + Math.floor(rnd() * 2);
    const c = tones[Math.floor(rnd() * tones.length)];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) px(cx + x, cy + y, c);
  }
  for (let i = 0; i < 80; i++) px(rnd() * w, rnd() * h, 0x5b5648);
  for (let i = 0; i < 40; i++) px(rnd() * w, rnd() * h, 0xcdbf9e);
}

function paintRoof(px, w, h) {
  const rnd = mulberry32(23);
  const tones = [0x7a4332, 0x8a5038, 0x6d3a2b, 0x93573c, 0x5f3328];
  const rowH = 8; const tileW = 8;
  for (let r = 0; r < h / rowH; r++) {
    const off = (r % 2) * (tileW / 2);
    for (let t = 0; t < w / tileW; t++) {
      const base = tones[Math.floor(rnd() * tones.length)];
      const moss = rnd() < 0.07;
      for (let y = 0; y < rowH; y++) {
        for (let x = 0; x < tileW; x++) {
          let c = base;
          if (y < 2) c = shade(base, 1.15);       // vora alta, clara
          else if (y >= rowH - 2) c = shade(base, 0.55); // ombra sota la teula
          if (x === 0) c = shade(c, 0.75);        // junta lateral
          if (moss && y > 2 && y < 6 && x > 1 && x < 6 && rnd() < 0.5) c = 0x4f5a2e;
          px(t * tileW + x + off, r * rowH + y, c);
        }
      }
    }
  }
}

function paintWood(px, w, h) {
  const rnd = mulberry32(37);
  const tones = [0x5a3d26, 0x634329, 0x4e3420, 0x5d4029];
  const plank = 8;
  for (let p = 0; p < w / plank; p++) {
    const tone = tones[p % tones.length];
    for (let x = 0; x < plank; x++) {
      const streak = x === 0 ? 0.45 : x === 1 ? 1.25 : 0.88 + rnd() * 0.22; // junta fosca i vora clara
      for (let y = 0; y < h; y++) px(p * plank + x, y, shade(tone, streak * (0.95 + ((y * 7 + p * 13) % 5) * 0.02)));
    }
  }
  for (let i = 0; i < 3; i++) { // nusos
    const x = Math.floor(rnd() * w); const y = Math.floor(rnd() * h);
    px(x, y, 0x2a1c10); px(x + 1, y, 0x2a1c10); px(x, y + 1, 0x3b2818);
  }
}

function paintDoorOak(px, w, h) { // taulo vertical de roure fosc envellit (8 × 32 px; 1 taulo ≈ 0,3 × 1,2 m)
  const rnd = mulberry32(211);
  const tones = [0x4a3322, 0x3f2b1c, 0x54392a, 0x38261a, 0x4d3624];
  const col = [];
  for (let x = 0; x < w; x++) col.push(tones[Math.floor(rnd() * tones.length)]);
  for (let x = 0; x < w; x++) {
    const streak = x === 0 ? 0.45 : x === 1 ? 1.18 : x === w - 1 ? 0.78 : 0.88 + rnd() * 0.22; // junta fosca i vora clara
    for (let y = 0; y < h; y++) {
      const grain = 0.94 + ((y * 5 + x * 11) % 7) * 0.02 + (rnd() - 0.5) * 0.06; // veta vertical amb petites variacions
      px(x, y, shade(col[x], streak * grain));
    }
  }
  for (let i = 0; i < 2; i++) { // nusos: un forat fosc amb la seva corona
    const x = 2 + Math.floor(rnd() * (w - 4)); const y = 3 + Math.floor(rnd() * (h - 7));
    px(x, y, 0x1c120a); px(x, y + 1, 0x22160c); px(x + 1, y + 1, 0x2a1c10);
    px(x - 1, y, 0x5a4230); px(x, y - 1, 0x5a4230); px(x + 1, y + 2, 0x5a4230);
  }
  for (let i = 0; i < 9; i++) px(2 + rnd() * (w - 3), rnd() * h, rnd() < 0.5 ? 0x6a5038 : 0x241810); // desgast: lascades clares i fosques
  for (let y = 24; y < h; y++) for (let x = 1; x < w; x++) if (rnd() < 0.18) px(x, y, 0x2c2a20);     // humitat/molsa fosca a la base
}

function paintCobble(px, w, h) {
  // Empedrat antic: pedres irregulars de 4–6 texels, tons grisos, grisos càlids i
  // marrons apagats; vora arrodonida, esquerdes, ratllades de desgast i petites
  // juntes amb molsa. Tot amb variacions subtils i sense grans taques de color.
  const rnd = mulberry32(51);
  const g = 24; const cw = w / g; const ch = h / g; // ~5,3 texels per pedra
  const pts = []; const tone = []; const crack = [];
  const greys = [0x8f8a80, 0x9a948a, 0x857f76, 0xa39c8f, 0x8a8174, 0x7d7468, 0x94897a, 0xa8a090, 0x7a7165];
  const browns = [0x7d6e5a, 0x6f6252, 0x887861];
  for (let gy = 0; gy < g; gy++) {
    for (let gx = 0; gx < g; gx++) {
      pts.push([(gx + 0.15 + 0.7 * rnd()) * cw, (gy + 0.15 + 0.7 * rnd()) * ch]);
      const base = rnd() < 0.2 ? browns[Math.floor(rnd() * browns.length)] : greys[Math.floor(rnd() * greys.length)];
      tone.push(shade(base, 0.9 + rnd() * 0.2));
      crack.push(rnd() < 0.3);
    }
  }
  const buf = new Int32Array(w * h); const own = new Int16Array(w * h).fill(-1);
  const at = (x, y) => ((y + h) % h) * w + ((x + w) % w);
  const tau = Math.PI * 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let d1 = 1e9; let d2 = 1e9; let k = 0; let kx = 0; let ky = 0;
      const gx0 = Math.floor(x / cw); const gy0 = Math.floor(y / ch);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = gx0 + ox; const cy = gy0 + oy;
          const idx = (((cy % g) + g) % g) * g + (((cx % g) + g) % g);
          const ptx = pts[idx][0] + Math.floor(cx / g) * w;
          const pty = pts[idx][1] + Math.floor(cy / g) * h;
          const d = Math.hypot(x + 0.5 - ptx, y + 0.5 - pty);
          if (d < d1) { d2 = d1; d1 = d; k = idx; kx = ptx; ky = pty; } else if (d < d2) d2 = d;
        }
      }
      const edge = d2 - d1;
      const i = y * w + x;
      // variació suau i repetible a gran escala (±3 %), sense blocs de color
      const lf = 1 + 0.03 * (Math.sin((tau * x) / w * 2 + 1) + Math.sin((tau * y) / h * 3 + 2) + Math.sin((tau * (x + y)) / w));
      if (edge < 1.2) { buf[i] = shade(((x * 5 + y * 3) % 7 === 0) ? 0x3a362e : 0x2b2924, lf); continue; } // junta fosca
      own[i] = k;
      let c = tone[k];
      const nx = (x + 0.5 - kx) / (d1 + 1e-6); const ny = (y + 0.5 - ky) / (d1 + 1e-6);
      c = shade(c, 1 - 0.1 * (nx + ny) * Math.min(1, d1 / 3));      // llum des de dalt-esquerra
      if (edge < 2.3) c = shade(c, 0.8);                              // vora arrodonida
      c = shade(c, 0.94 + ((x * 7 + y * 13 + k * 3) % 5) * 0.03);     // gra fi
      buf[i] = shade(c, lf);
    }
  }
  // Esquerdes: línies fines dins de la pedra (no creuen les juntes).
  for (let k = 0; k < pts.length; k++) {
    if (!crack[k]) continue;
    let x = pts[k][0] + (rnd() - 0.5) * 2; let y = pts[k][1] + (rnd() - 0.5) * 2;
    let a = rnd() * tau; const len = 4 + Math.floor(rnd() * 5);
    for (let s = 0; s < len; s++) {
      const xi = Math.floor(x); const yi = Math.floor(y); const j = at(xi, yi);
      if (own[j] !== k) break;
      buf[j] = shade(tone[k], 0.55);
      a += (rnd() - 0.5) * 0.9; x += Math.cos(a); y += Math.sin(a);
    }
  }
  // Desgast: petites lascades clares i fosques sobre les pedres.
  for (let i = 0; i < 420; i++) {
    const x = Math.floor(rnd() * w); const y = Math.floor(rnd() * h); const j = at(x, y);
    if (own[j] >= 0) buf[j] = shade(buf[j], rnd() < 0.5 ? 1.18 : 0.72);
  }
  // Molsa molt escassa i apagada, només a les juntes.
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rnd() * w); const y = Math.floor(rnd() * h); const j = at(x, y);
    if (own[j] < 0) buf[j] = 0x4a5230;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, buf[y * w + x]);
}

function paintIvy(px, w, h) { // alfa: només fulles, més denses cap a baix
  const rnd = mulberry32(61);
  const tones = [0x5c6e2a, 0x7a8a30, 0x3f5220, 0x1f2a1a];
  for (let y = 0; y < h; y++) {
    const cx = w / 2 + Math.round(4 * Math.sin(y / 6) + 3 * Math.sin(y / 3.1));
    const density = 0.3 + 0.6 * (y / h);
    const spread = 2 + Math.round(5 * (y / h));
    for (let x = -spread; x <= spread; x++) {
      if (rnd() < density * (1 - Math.abs(x) / (spread + 2))) {
        const c = tones[Math.floor(rnd() * tones.length)];
        px(cx + x, y, c); if (rnd() < 0.5) px(cx + x + 1, y, c);
      }
    }
  }
}

function paintMoss(px, w, h) { // alfa: taques a la part baixa
  const rnd = mulberry32(71);
  const tones = [0x4a5a2c, 0x5c6e2a, 0x3a4a22];
  for (let x = 0; x < w; x++) {
    const top = h - (3 + Math.floor(rnd() * (h * 0.55)));
    for (let y = top; y < h; y++) if (rnd() < 0.88) px(x, y, tones[Math.floor(rnd() * tones.length)]);
  }
}

function paintGrass(px, w, h) { // alfa: pues d'herba
  const rnd = mulberry32(83);
  const tones = [0x4a5a2c, 0x5c6e2a, 0x3a4a22, 0x6a7a34];
  for (let b = 0; b < 7; b++) {
    const x0 = 1 + b * 2; const hh = 5 + Math.floor(rnd() * 10); const lean = (rnd() - 0.5) * 0.35;
    const c = tones[Math.floor(rnd() * tones.length)];
    for (let y = 0; y < hh; y++) px(x0 + Math.round(lean * y), h - 1 - y, c);
  }
}

function paintPatch(px, w, h) { // alfa: taca irregular (el color el dona el vèrtex)
  const rnd = mulberry32(97);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - w / 2 + 0.5, y - h / 2 + 0.5) / (w / 2);
      if (d + (rnd() - 0.5) * 0.45 < 0.85) px(x, y, shade(0xffffff, 0.8 + rnd() * 0.2));
    }
  }
}

function paintMoonPatch(px, w, h) { // alfa: silueta d'una finestra d'arc projectada pel terra (la llum la dona el material)
  const hw = w / 2;
  for (let y = 0; y < h; y++) {
    // Part alta arrodonida: l'amplada es redueix com un arc cap a dalt (fila 0 = punta).
    const t = y / h; const arch = t < 0.3 ? Math.sqrt(Math.max(0, 1 - Math.pow((0.3 - t) / 0.3, 2))) : 1;
    const half = Math.max(1, Math.round((hw - 1) * arch));
    for (let x = Math.floor(hw - half); x < Math.ceil(hw + half); x++) {
      const edge = x === Math.floor(hw - half) || x === Math.ceil(hw + half) - 1;
      const bar = x === hw - 1 || x === hw || Math.abs(y - h * 0.55) < 1; // barrots de la finestra: ombra
      px(x, y, 0xffffff, bar ? 70 : (edge ? 150 : 255));
    }
  }
}

function paintBark(px, w, h) { // escorça: osques verticals, grisos i marrons foscos
  const rnd = mulberry32(131);
  const tones = [0x3b2e22, 0x4a3a2c, 0x5a4a3a, 0x2e241b, 0x544a40, 0x6a6358];
  for (let x = 0; x < w; x++) {
    let tone = tones[Math.floor(rnd() * tones.length)];
    for (let y = 0; y < h; y++) {
      if (rnd() < 0.18) tone = tones[Math.floor(rnd() * tones.length)]; // canvi de to dins de l'osca
      let c = shade(tone, 0.85 + rnd() * 0.3);
      if (x % 5 === 0) c = shade(c, 0.6);                              // solc fosc
      px(x, y, c);
    }
  }
  for (let i = 0; i < 12; i++) { // esquerdes horitzontals
    const x = Math.floor(rnd() * w); const y = Math.floor(rnd() * h); const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) px(x + k, y, 0x1e1812);
  }
  for (let i = 0; i < 16; i++) px(rnd() * w, rnd() * h, rnd() < 0.5 ? 0x7a766c : 0x4a5a30); // líquen gris / molsa
}

function paintPine(px, w, h) { // agulles de pi: verds molt foscos amb clústers una mica més clars
  const rnd = mulberry32(77);
  const tones = [0x1a2a26, 0x16231f, 0x203630, 0x12201c, 0x24392f];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, tones[Math.floor(rnd() * tones.length)]);
  for (let i = 0; i < 18; i++) { const x = Math.floor(rnd() * w); const y = Math.floor(rnd() * h); px(x, y, 0x0b1411); px(x + 1, y, 0x0b1411); }
}

function paintLeaf(px, w, h) { // alfa: grup irregular de fulles, amb forats i alguna fulla seca
  const rnd = mulberry32(151);
  const tones = [0x2f4a2c, 0x3d5a30, 0x4a6a34, 0x55663f, 0x22381f, 0x3a5238];
  const blobs = [];
  for (let i = 0; i < 9; i++) {
    const r = 4 + rnd() * 4;
    blobs.push([r + 1 + rnd() * (w - 2 * r - 2), r + 1 + rnd() * (h - 2 * r - 2), r]);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = false;
      for (const [bx, by, br] of blobs) if (Math.hypot(x - bx, y - by) / br + (rnd() - 0.5) * 0.4 < 1) { inside = true; break; }
      if (!inside || rnd() < 0.08) continue; // fora del grup o forat
      let c = tones[((x >> 1) * 31 + (y >> 1) * 17 + Math.floor(rnd() * 2)) % tones.length];
      if (y < h * 0.45) c = shade(c, 1.12);  // dalt, una mica més clar
      if (rnd() < 0.035) c = 0x6b5a34;       // fulla seca
      px(x, y, c);
    }
  }
}

function paintGlow(px, w, h) { // halo radial per als fanals
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - w / 2 + 0.5, y - h / 2 + 0.5) / (w / 2);
      const a = Math.max(0, 1 - d);
      px(x, y, 0xffd9a0, Math.round(255 * a * a));
    }
  }
}


// ---------------------------------------------------------------------
// CATIFES ANTIGUES (Fase C.2): pixel art de lli i llana molt gastats. Tons terrosos i apagats (cap rosa ni magenta).
// `alfa` 0 = forat o vora esfilagarsada (alpha-test); el color ja és a la textura (el vèrtex és blanc).
// ---------------------------------------------------------------------
export const RUG_PALETTES = {
  // sota la taula: bordeus molt fosc i descolorit, gairebé marró
  A: { base: 0x36241f, base2: 0x2d1d19, border: 0x201412, motif: 0x5f4636, worn: 0x504439, stain: 0x160f0c, fringe: 0x6a5e4c },
  // damunt de l'anterior: verd oliva apagat
  B: { base: 0x393a22, base2: 0x2f2f1b, border: 0x20200f, motif: 0x61583a, worn: 0x524f3e, stain: 0x181610, fringe: 0x6c6650 },
  // dormitori: marró grisenc brut (la llum freda de la lluna el fa semblar gris)
  C: { base: 0x3a3126, base2: 0x30281e, border: 0x211a13, motif: 0x5a4832, worn: 0x56493a, stain: 0x15110d, fringe: 0x6a5e4a },
};
export const RUG_SIZES = { A: [32, 38], B: [28, 34], C: [16, 26] }; // px (≈ 16 px/m, igual que la resta del terra)
const mixHex = (a, b, t) => {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
};
export function paintRug(px, w, h, pal, seed, centerWear) {
  const rnd = mulberry32(seed);
  const fr = 2; const bw = 3;
  const zones = [];
  const nz = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < nz; i++) zones.push({ x: rnd() * w, y: rnd() * h, r: 3 + rnd() * Math.min(w, h) * 0.22, k: 0.55 + rnd() * 0.45 });
  if (centerWear) zones.push({ x: w / 2, y: h / 2, r: Math.min(w, h) * 0.38, k: 0.7 }); // pas de la gent: el centre, més gastat
  const stains = [{ x: rnd() * w, y: rnd() * h, r: 2 + rnd() * 3 }, { x: rnd() * w, y: rnd() * h, r: 1.5 + rnd() * 2 }];
  const cx = (w - 1) / 2; const cy = (h - 1) / 2; const med = Math.max(3, Math.round(Math.min(w, h) * 0.2));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < fr || y >= h - fr) { // serrells als dos caps (alguns trencats)
        if (x % 2 === 0 && rnd() < (y === 0 || y === h - 1 ? 0.55 : 0.85)) px(x, y, mixHex(pal.fringe, pal.worn, rnd() * 0.5));
        continue;
      }
      if ((x === 0 || x === w - 1) && rnd() < 0.24) continue;        // vora esfilagarsada
      if ((x === 1 || x === w - 2) && rnd() < 0.05) continue;
      if ((y === fr || y === h - fr - 1) && rnd() < 0.12) continue;
      const edge = x < bw || x >= w - bw || y < fr + bw || y >= h - fr - bw;
      let c;
      if (edge) c = ((x + y) % 4 === 0) ? pal.motif : pal.border;       // vora: ziga-zaga subtil
      else {
        const d1 = (x + y) % 8; const d2 = (((x - y) % 8) + 8) % 8;
        c = (d1 === 0 || d2 === 0) ? pal.base2 : pal.base;               // retícula de rombes
        const m = Math.abs(x - cx) + Math.abs(y - cy);
        if (m <= med && m >= med - 1) c = pal.motif;                     // medalló
        else if (m < med - 1) c = (x + y) % 2 === 0 ? pal.base2 : mixHex(pal.base2, pal.motif, 0.25);
      }
      c = shade(c, 0.9 + rnd() * 0.2);
      let hole = false;
      for (const z of zones) { // zones descolorides i foradades
        const t = 1 - Math.hypot(x - z.x, y - z.y) / z.r;
        if (t > 0 && rnd() < t * z.k) { c = mixHex(c, pal.worn, 0.45 + 0.3 * t); if (t > 0.75 && rnd() < 0.1) hole = true; }
      }
      for (const st of stains) { const t = 1 - Math.hypot(x - st.x, y - st.y) / st.r; if (t > 0 && rnd() < 0.8 * t + 0.1) c = mixHex(c, pal.stain, 0.55); }
      if (hole) continue;
      px(x, y, c);
    }
  }
}
// Teranyines: atles de 3 dibuixos de 24×24 px (72×24). L'àpex és a la cantonada inferior esquerra (UV 0,0) de cada cel·la.
// Els dos eixos (les vores que toquen les superfícies) són fils llargs; els radis no neixen a l'àpex (no fan un nus) i els
// anells són segments rectes amb algun tall: línies d'1 píxel, irregulars i molt tènues.
export const WEB_CELL = 24;
export function paintWeb(px, w, h) {
  const rnd = mulberry32(61);
  const P = (x, y, a) => px(x, h - 1 - y, 0xe2e0d6, a);
  const line = (x0, y0, x1, y1, a, gap) => {
    const dx = Math.abs(x1 - x0); const dy = Math.abs(y1 - y0); const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy; let x = x0; let y = y0;
    for (let n = 0; n < 96; n++) {
      if (!(gap && rnd() < gap)) P(x, y, a);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dx; y += sy; }
    }
  };
  const cells = [{ rays: 6, rings: 4, len: 21, s0: 4 }, { rays: 5, rings: 4, len: 20, s0: 3 }, { rays: 4, rings: 3, len: 13, s0: 3 }];
  cells.forEach((c, i) => {
    const ox = i * WEB_CELL + 1;
    const rays = [];
    for (let k = 0; k < c.rays; k++) {
      const edge = k === 0 || k === c.rays - 1;
      const th = edge ? (k === 0 ? 0.02 : Math.PI / 2 - 0.02) : (Math.PI / 2) * (k / (c.rays - 1)) + (rnd() - 0.5) * 0.12;
      const len = c.len * (edge ? 1 : 0.7 + rnd() * 0.3);
      const r0 = edge ? 0 : c.s0;
      rays.push({ th, len });
      line(ox + Math.round(Math.cos(th) * r0), 1 + Math.round(Math.sin(th) * r0), ox + Math.round(Math.cos(th) * len), 1 + Math.round(Math.sin(th) * len), edge ? 235 : 215, 0.07);
    }
    for (let r = 1; r <= c.rings; r++) {
      const f = (r + 0.4) / (c.rings + 0.4);
      for (let k = 0; k + 1 < rays.length; k++) {
        if (rnd() < 0.18) continue; // fil trencat
        const A = rays[k]; const B = rays[k + 1];
        const x0 = ox + Math.round(Math.cos(A.th) * A.len * f); const y0 = 1 + Math.round(Math.sin(A.th) * A.len * f);
        const x1 = ox + Math.round(Math.cos(B.th) * B.len * f); const y1 = 1 + Math.round(Math.sin(B.th) * B.len * f);
        const sag = 0.82 + rnd() * 0.08; // la catenària s'enfonsa cap a l'àpex
        const mx = Math.round(ox + ((x0 + x1) / 2 - ox) * sag); const my = Math.round(1 + ((y0 + y1) / 2 - 1) * sag);
        line(x0, y0, mx, my, 170, 0.1); line(mx, my, x1, y1, 170, 0.1);
      }
    }
  });
}

function createTextures(enabled) {
  const t = { stone: null, roof: null, wood: null, cobble: null, ivy: null, moss: null, grass: null, patch: null, glow: null, bark: null, leaf: null, moonPatch: null, door: null, pine: null, rugA: null, rugB: null, rugC: null, web: null };
  if (!enabled) return t;
  t.stone = makeTexture(64, 64, paintStone);
  t.roof = makeTexture(64, 64, paintRoof);
  t.wood = makeTexture(32, 32, paintWood);
  t.cobble = makeTexture(128, 128, paintCobble); // 8 m per rajola (16 px/m)
  t.ivy = makeTexture(32, 64, paintIvy);
  t.moss = makeTexture(32, 16, paintMoss);
  t.grass = makeTexture(16, 16, paintGrass);
  t.patch = makeTexture(16, 16, paintPatch);
  t.glow = makeTexture(32, 32, paintGlow);
  t.bark = makeTexture(32, 32, paintBark);
  t.leaf = makeTexture(32, 32, paintLeaf);
  t.moonPatch = makeTexture(16, 32, paintMoonPatch);
  t.door = makeTexture(8, 32, paintDoorOak);
  t.pine = makeTexture(16, 16, paintPine);
  t.rugA = makeTexture(RUG_SIZES.A[0], RUG_SIZES.A[1], (px, w, h) => paintRug(px, w, h, RUG_PALETTES.A, 5101, true));
  t.rugB = makeTexture(RUG_SIZES.B[0], RUG_SIZES.B[1], (px, w, h) => paintRug(px, w, h, RUG_PALETTES.B, 5102, false));
  t.rugC = makeTexture(RUG_SIZES.C[0], RUG_SIZES.C[1], (px, w, h) => paintRug(px, w, h, RUG_PALETTES.C, 5103, true));
  t.web = makeTexture(WEB_CELL * 3, WEB_CELL, paintWeb);
  return t;
}

// ---------------------------------------------------------------------
// MATERIALS
// ---------------------------------------------------------------------
// Tots els materials de les malles fusionades usen vertexColors: el color de
// cada peça (variació de to) viatja als vèrtexs i es multiplica per la textura.
function createMaterials(tex) {
  const lam = (extra) => new THREE.MeshLambertMaterial({ flatShading: true, vertexColors: true, ...extra });
  const alpha = (map) => lam({ map, alphaTest: 0.5, side: THREE.DoubleSide, flatShading: false });
  return {
    stone: lam({ map: tex.stone }),
    stoneD: lam({ map: tex.stone, side: THREE.DoubleSide }), // peces de revolució (pica de la font)
    roof: lam({ map: tex.roof }),
    wood: lam({ map: tex.wood }),
    // Fulles de la porta de l'església: roure fosc (sense textura: color pla marró fosc).
    doorOak: lam({ map: tex.door, color: tex.door ? 0xffffff : 0x4a3322 }),
    // Fase C.2: catifes gastades (alpha-test: vores esfilagarsades i forats) i teranyines (translúcides, sense escriure profunditat)
    rugA: lam({ map: tex.rugA, alphaTest: 0.5, flatShading: false, color: tex.rugA ? 0xffffff : 0x36241f }),
    rugB: lam({ map: tex.rugB, alphaTest: 0.5, flatShading: false, color: tex.rugB ? 0xffffff : 0x393a22 }),
    rugC: lam({ map: tex.rugC, alphaTest: 0.5, flatShading: false, color: tex.rugC ? 0xffffff : 0x3a3126 }),
    web: lam({ map: tex.web, transparent: true, opacity: tex.web ? 0.6 : 0.2, alphaTest: 0.1, depthWrite: false, side: THREE.DoubleSide, flatShading: false }),
    plain: lam({}),                               // pedra llisa, fusta fosca, vegetació…
    plainD: lam({ side: THREE.DoubleSide }),       // ferro i peces buides (dues cares)
    glass: lam({}),                                // vidres de finestra: sempre foscos
    // Vidre de les finestres reals (Fase C): translúcid (12 %), sense escriure profunditat: es veu l'exterior a través seu.
    pane: lam({ transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, flatShading: false }),
    pine: lam({ map: tex.pine }),                  // capçades dels pins del bosc (agulles pixel-art fosques)
    bark: lam({ map: tex.bark }),                  // escorça de l'arbre
    leaves: alpha(tex.leaf),                       // cartes de fulles (alpha-test)
    ivy: alpha(tex.ivy),
    moss: alpha(tex.moss),
    grass: alpha(tex.grass),
    patch: alpha(tex.patch),
    // Vidre del fanal: emissiu (no depèn de la llum) i sense boira (es veu de lluny).
    lanternGlass: new THREE.MeshBasicMaterial({ color: 0xe8c98a, fog: false }),
    // Terra empedrat: calcomania sota els peus (sense vertexColors).
    cobble: new THREE.MeshLambertMaterial({
      map: tex.cobble, color: tex.cobble ? 0xffffff : 0x6c675b,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    // Terra de l'església: la mateixa textura d'empedrat, fosca (el to ve dels vèrtexs).
    floor: new THREE.MeshLambertMaterial({
      map: tex.cobble, vertexColors: true, flatShading: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    // Llum de lluna a l'interior: calcomania additiva blavosa (no il·lumina res de debò).
    moonPatch: new THREE.MeshBasicMaterial({
      map: tex.moonPatch, color: 0x7f9fe0, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }),
    // Flames d'espelma i llumeneta de les ranures: emissius (no depenen de la llum).
    flame: new THREE.MeshBasicMaterial({ color: 0xffc870 }),
    // Espurna de les claus un cop el calaix / l'arca s'han obert (perquè siguin descobribles).
    // Boira baixa del bosc: sprite gris-blavós molt translúcid (sense additiu: no il·lumina res).
    mist: new THREE.SpriteMaterial({ map: tex.glow, color: 0x56688a, transparent: true, opacity: 0.16, depthWrite: false }),
    keyGlow: new THREE.SpriteMaterial({
      map: tex.glow, color: 0xffe0a0, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }),
    ground: new THREE.MeshLambertMaterial({ color: 0x2b2f38 }),
    glow: new THREE.SpriteMaterial({
      map: tex.glow, color: 0xffd9a0, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }),
    // Halo de les espelmes de les cases (Fase C.1): més tènue que el dels fanals i del cirial de l'església.
    glowSoft: new THREE.SpriteMaterial({
      map: tex.glow, color: 0xffcf90, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }),
  };
}

// ---------------------------------------------------------------------
// GEOMETRIA: utilitats
// ---------------------------------------------------------------------
// Escala les UV (p. ex. de metres a unitats de textura).
function scaleUV(geo, ku, kv = ku) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ku, uv.getY(i) * kv);
  return geo;
}

// Caixa amb UV en espai de món (1 rajola = `tile` m) i un desplaçament aleatori
// perquè dues peces veïnes no repeteixin exactament el mateix dibuix.
function texBox(w, h, d, tile, rnd) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (!tile) return g;
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px, nx, py, ny, pz, nz
  const ou = rnd(); const ov = rnd();
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile + ou, (uv.getY(k) * dims[f][1]) / tile + ov);
    }
  }
  return g;
}

// Arc de mig punt: base a y = 0, costats rectes fins a `straight` i semicercle.
function archGeometry(width, straight, depth) {
  const r = width / 2;
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, straight);
  s.absarc(0, straight, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
}

// Anell d'arc de mig punt (marc d'una obertura que arriba a terra): una sola
// silueta en forma d'U, sense forat, perquè la base toca y = 0.
function archRingGeometry(innerR, outerR, straight, depth) {
  const s = new THREE.Shape();
  s.moveTo(-outerR, 0);
  s.lineTo(-outerR, straight);
  s.absarc(0, straight, outerR, Math.PI, 0, true);
  s.lineTo(outerR, 0);
  s.lineTo(innerR, 0);
  s.lineTo(innerR, straight);
  s.absarc(0, straight, innerR, 0, Math.PI, false);
  s.lineTo(-innerR, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
}

// Contorn d'una finestra gòtica com a FORAT d'una paret (centrat a cx, base a y0).
function gothicHole(cx, width, y0, straight, apex) {
  const hw = width / 2;
  const p = new THREE.Path();
  p.moveTo(cx - hw, y0);
  p.lineTo(cx + hw, y0);
  p.lineTo(cx + hw, y0 + straight);
  p.quadraticCurveTo(cx + hw, y0 + straight + apex * 0.75, cx, y0 + straight + apex);
  p.quadraticCurveTo(cx - hw, y0 + straight + apex * 0.75, cx - hw, y0 + straight);
  return p;
}

// Finestra gòtica (lanceta): costats rectes + punta ogival.
function gothicGeometry(width, straight, apex, depth) {
  const hw = width / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, straight);
  s.quadraticCurveTo(hw, straight + apex * 0.75, 0, straight + apex);
  s.quadraticCurveTo(-hw, straight + apex * 0.75, -hw, straight);
  s.lineTo(-hw, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
}

// Referència local d'una cara: +Z local = normal cap a l'EXTERIOR, +X local = al
// llarg de la cara. `along` és la coordenada absoluta del punt d'origen.
function faceFrame(rect, face, along) {
  switch (face) {
    case 'south': return { x: along, z: rect.zMax, rotY: 0 };
    case 'north': return { x: along, z: rect.zMin, rotY: Math.PI };
    case 'east': return { x: rect.xMax, z: along, rotY: Math.PI / 2 };
    case 'west': return { x: rect.xMin, z: along, rotY: -Math.PI / 2 };
    default: return fail(`Cara desconeguda '${face}'`);
  }
}

// Sentit del X local d'una cara respecte de l'eix absolut (+1 o −1).
function alongSign(face) {
  return face === 'south' || face === 'west' ? 1 : -1;
}

function faceInfo(fp, face) {
  const horiz = face === 'south' || face === 'north';
  const len = horiz ? fp.xMax - fp.xMin : fp.zMax - fp.zMin;
  const c = horiz ? (fp.xMin + fp.xMax) / 2 : (fp.zMin + fp.zMax) / 2;
  return { len, center: c, frame: faceFrame(fp, face, c), sign: alongSign(face) };
}

function requireRect(shape, what) {
  if (!shape || shape.type !== 'rect') fail(`${what}: s'esperava una forma 'rect'`);
  return shape;
}

function makeGroup(name, layoutId) {
  const g = new THREE.Group();
  g.name = name;
  if (layoutId) g.userData.layoutId = layoutId;
  return g;
}

// ---------------------------------------------------------------------
// BUILDER: acumula peces i les FUSIONA en una malla per material
// ---------------------------------------------------------------------
const _dummy = new THREE.Object3D();

class Builder {
  constructor(group, mats, seed) {
    this.group = group;
    this.mats = mats;
    this.parts = new Map(); // clau de material → [geometries]
    this.frame = null;      // {x, y, z, rotY}: sistema local actiu
    this.rnd = mulberry32(seed);
  }

  setFrame(f) { this.frame = f; return this; }

  // Afegeix una geometria en coordenades locals (del frame actiu).
  add(key, geo, x = 0, y = 0, z = 0, o = {}) {
    if (!this.mats[key]) fail(`Material desconegut '${key}'`);
    const f = this.frame;
    let wx = x; let wy = y; let wz = z; let ry = o.rotY || 0;
    if (f) {
      const c = Math.cos(f.rotY); const s = Math.sin(f.rotY);
      wx = f.x + c * x + s * z;
      wz = f.z - s * x + c * z;
      wy = (f.y || 0) + y;
      ry += f.rotY;
    }
    _dummy.position.set(wx, wy, wz);
    _dummy.rotation.set(0, ry, 0);
    _dummy.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
    _dummy.updateMatrix();
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    const n = g.getAttribute('position').count;
    const col = new THREE.Color(o.tint === undefined ? 0xffffff : o.tint);
    const arr = new Float32Array(n * 3);
    if (o.colorFn) {
      // Color per vèrtex a partir de la posició LOCAL (abans d'aplicar la transformació):
      // colorFn(x, y, z, color) modifica `color` (p. ex. degradat cara exterior → interior).
      const pos = g.attributes.position; const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        c.copy(col);
        o.colorFn(pos.getX(i), pos.getY(i), pos.getZ(i), c);
        arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
      }
    } else {
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    }
    g.applyMatrix4(_dummy.matrix);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return this;
  }

  // Caixa per límits (coordenades locals del frame actiu).
  box(key, b, tint) {
    const w = b.xMax - b.xMin; const h = b.yMax - b.yMin; const d = b.zMax - b.zMin;
    if (!(w > 0 && h > 0 && d > 0)) fail(`Caixa amb mides no positives (${this.group.name}/${key})`);
    const g = texBox(w, h, d, TILE[key], this.rnd);
    return this.add(key, g, (b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2, (b.zMin + b.zMax) / 2, { tint });
  }

  // Crea una malla per material i les afegeix al grup.
  finish() {
    let meshes = 0;
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) fail(`No s'han pogut fusionar les peces de ${this.group.name}/${key}`);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, this.mats[key]);
      mesh.name = `${this.group.name}-${key}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      meshes += 1;
    }
    this.parts.clear();
    return meshes;
  }
}

// ---------------------------------------------------------------------
// EDIFICIS
// ---------------------------------------------------------------------
const OVERHANG = { eave: 0.25, gable: 0.18, slab: 0.10 };
const TIMBER = 0x9a8c84;      // multiplica la textura de fusta → bigues fosques
const WINDOW = { w: 0.9, h: 1.1, groundY: 1.55, upperY: 4.1, storeyY: 2.75 };
const TOWER = { roofHeight: 2.8, crossHeight: 0.8, belfryY: 8.0, southBump: 0.02 };

const BUILDING_STYLE = {
  'CH-N': { wall: 0xd4d8e0, roof: 0xb4bcc8 },
  'CH-T': { wall: 0xd4d8e0, roof: 0xb4bcc8 },
  HA: { wall: 0xffffff, roof: 0xffffff, chimney: 0.28 },
  HB: { wall: 0xf0e6d2, roof: 0xf4e4dc, chimney: 0.7 },
  HC: { wall: 0xe8e2d8, roof: 0xfaeee6, chimney: 0.35 },
};
const DEFAULT_STYLE = { wall: 0xffffff, roof: 0xffffff, chimney: 0.5 };

const ALL_FACES = ['north', 'south', 'east', 'west'];

function perpendicularFaces(face) {
  return face === 'east' || face === 'west' ? ['north', 'south'] : ['east', 'west'];
}

function insideRect(x, z, r) {
  return x > r.xMin && x < r.xMax && z > r.zMin && z < r.zMax;
}

// Rectangles SÒLIDS d'un edifici o mur per a les comprovacions de decoració.
// Edifici → la seva empremta visual sencera (l'interior de la nau també és "dins":
// no hi ha de posar molsa ni herba). Mur → la seva col·lisió (una forma o una llista).
function solidRects(item) {
  if (item.faces !== undefined) return [item.visual.footprint];
  return Array.isArray(item.collision) ? item.collision : [item.collision];
}

// Una cara està "tapada" si 1 m més enllà hi ha un altre edifici o mur.
function faceBlocked(self, info) {
  const f = info.frame;
  const px = f.x + Math.sin(f.rotY);
  const pz = f.z + Math.cos(f.rotY);
  for (const b of BUILDINGS) if (b.id !== self.id && solidRects(b).some((r) => insideRect(px, pz, r))) return true;
  for (const w of WALLS) if (solidRects(w).some((r) => insideRect(px, pz, r))) return true;
  return false;
}

function onFacePlane(p, fp, face) {
  if (face === 'south') return Math.abs(p.z - fp.zMax) < EPS;
  if (face === 'north') return Math.abs(p.z - fp.zMin) < EPS;
  if (face === 'east') return Math.abs(p.x - fp.xMax) < EPS;
  return Math.abs(p.x - fp.xMin) < EPS;
}

// Coordenades absolutes (al llarg de la cara) de portes i fanals d'aquesta cara.
function obstaclesAlong(building, face) {
  const fp = building.visual.footprint;
  const horiz = face === 'south' || face === 'north';
  const out = { doors: [], lights: [] };
  for (const d of DOORS) {
    if (d.buildingId === building.id && d.face === face) out.doors.push(horiz ? d.center.x : d.center.z);
  }
  for (const l of LIGHTS) {
    if (l.mountedOn === building.id && onFacePlane(l.wallPoint, fp, face)) {
      out.lights.push(horiz ? l.wallPoint.x : l.wallPoint.z);
    }
  }
  return out;
}

// --- Teulada: dues lloses inclinades amb ràfec, nervis de teula i carener ---
function addRoof(b, span, length, eave, rise, tint) {
  const half = span / 2;
  const tanA = rise / half;
  const A = Math.atan(tanA);
  const cosA = Math.cos(A); const sinA = Math.sin(A);
  const t = OVERHANG.slab; const o = OVERHANG.eave; const og = OVERHANG.gable;
  const len = length + 2 * og;
  for (const side of [-1, 1]) {
    const p0 = [side * (half + o), eave - o * tanA]; // vora exterior del ràfec
    const pr = [0, eave + rise];                     // carener
    const run = Math.hypot(pr[0] - p0[0], pr[1] - p0[1]);
    const dir = [-side * cosA, sinA];
    const nrm = [side * sinA, cosA];
    const cx = (p0[0] + pr[0]) / 2 + dir[0] * 0.015 + nrm[0] * (t / 2);
    const cy = (p0[1] + pr[1]) / 2 + dir[1] * 0.015 + nrm[1] * (t / 2);
    const slab = texBox(run + 0.03, t, len, TILE.roof, b.rnd);
    slab.rotateZ(-side * A);
    b.add('roof', slab, cx, cy, length / 2, { tint: jit(tint, 0.06, b.rnd) });
    for (let k = 1; k <= 4; k++) { // nervis: relleu de fileres de teules
      const f = k / 5;
      const rx = p0[0] + (pr[0] - p0[0]) * f + nrm[0] * (t + 0.02);
      const ry = p0[1] + (pr[1] - p0[1]) * f + nrm[1] * (t + 0.02);
      const rib = texBox(0.07, 0.05, len - 0.12, TILE.roof, b.rnd);
      rib.rotateZ(-side * A);
      b.add('roof', rib, rx, ry, length / 2, { tint: jit(shade(tint, 0.82), 0.08, b.rnd) });
    }
  }
  b.add('plain', new THREE.BoxGeometry(0.32, 0.1, len + 0.02), 0, eave + rise + 0.04, length / 2, { tint: 0x5a3a30 });
}

// --- Cos de pedra (secció de casa: rectangle + hastial) ---
function addPrism(b, span, length, eave, ridge, tint) {
  const h = span / 2;
  const s = new THREE.Shape();
  s.moveTo(-h, 0);
  s.lineTo(h, 0);
  s.lineTo(h, eave);
  s.lineTo(0, ridge);
  s.lineTo(-h, eave);
  s.lineTo(-h, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  scaleUV(g, 1 / TILE.stone);
  b.add('stone', g, 0, 0, 0, { tint });
}

// Frame local de l'edifici: X = a través del carener, Z = al llarg del carener.
function buildingFrame(fp) {
  const w = fp.xMax - fp.xMin; const d = fp.zMax - fp.zMin;
  const alongZ = d >= w;
  return {
    span: alongZ ? w : d,
    length: alongZ ? d : w,
    frame: alongZ
      ? { x: (fp.xMin + fp.xMax) / 2, y: 0, z: fp.zMin, rotY: 0 }
      : { x: fp.xMin, y: 0, z: (fp.zMin + fp.zMax) / 2, rotY: Math.PI / 2 },
  };
}

function addChimney(b, eave, rise, length, frac) {
  const z = length * frac;
  const top = eave + rise + 0.9;
  b.box('stone', { xMin: -0.3, xMax: 0.3, yMin: eave + rise * 0.35, yMax: top, zMin: z - 0.3, zMax: z + 0.3 }, 0xb8b4aa);
  b.box('stone', { xMin: -0.4, xMax: 0.4, yMin: top, yMax: top + 0.12, zMin: z - 0.4, zMax: z + 0.4 }, 0xa29e94);
  b.box('glass', { xMin: -0.2, xMax: 0.2, yMin: top + 0.12, yMax: top + 0.13, zMin: z - 0.2, zMax: z + 0.2 }, 0x14161f);
}

// --- Finestra amb marc, ampit, vidre fosc, reixa i porticons (frame de cara) ---
// `avoid` = intervals [x0, x1] (X local de la cara) ocupats per un bastiment de porta: cap porticó hi pot entrar
// (Fase C: abans un porticó obert se solapava amb el muntant de pedra de la porta, amb les cares frontals
// coplanars a 0,12 m, i feia z-fighting entre fusta i pedra segons l'angle: era el "marc que es torna marró").
function addWindow(b, x, yc, avoid = []) {
  const { w, h } = WINDOW;
  const r = b.rnd;
  const hw = w / 2 + 0.08; const hh = h / 2 + 0.08;
  b.box('wood', { xMin: x - hw, xMax: x + hw, yMin: yc - hh, yMax: yc + hh, zMin: 0, zMax: 0.07 }, TIMBER);
  const mode = r(); // 0..0.5 porticons oberts, 0.5..0.75 tancats, 0.75.. un de sol
  const closed = mode >= 0.5 && mode < 0.75;
  if (!closed) {
    b.box('glass', { xMin: x - w / 2, xMax: x + w / 2, yMin: yc - h / 2, yMax: yc + h / 2, zMin: 0.07, zMax: 0.085 }, jit(0x14161f, 0.15, r));
    b.box('wood', { xMin: x - 0.025, xMax: x + 0.025, yMin: yc - h / 2, yMax: yc + h / 2, zMin: 0.085, zMax: 0.1 }, TIMBER);
    b.box('wood', { xMin: x - w / 2, xMax: x + w / 2, yMin: yc - 0.025, yMax: yc + 0.025, zMin: 0.085, zMax: 0.1 }, TIMBER);
  }
  b.box('wood', { xMin: x - (w / 2 + 0.16), xMax: x + (w / 2 + 0.16), yMin: yc - hh - 0.08, yMax: yc - hh + 0.04, zMin: 0, zMax: 0.14 }, jit(TIMBER, 0.1, r));
  const leaf = (x0, x1) => {
    const lo = Math.min(x0, x1); const hi = Math.max(x0, x1);
    if (avoid.some(([a, c]) => hi > a - 0.02 && lo < c + 0.02)) return; // ocuparia el bastiment d'una porta
    b.box('wood', { xMin: lo, xMax: hi, yMin: yc - h / 2, yMax: yc + h / 2, zMin: 0.07, zMax: 0.12 }, jit(0xb0a094, 0.12, r));
  };
  if (closed) { leaf(x - hw, x); leaf(x, x + hw); return; }
  if (mode < 0.5) { leaf(x - hw - 0.4, x - hw); leaf(x + hw, x + hw + 0.4); } // oberts, plans a la paret
  else leaf(x + hw, x + hw + 0.4);
}

// --- Finestres REALS (Fase C): l'obertura està TALLADA a la paret (forat a l'extrusió), no hi ha cap vidre opac ---
// Posicions de les finestres d'una cara (X local), amb la mateixa regla que sempre: dues per cara a 1/4 i 3/4,
// sense finestra de planta baixa al costat d'una porta o d'un fanal.
function windowSlots(building, face) {
  const info = faceInfo(building.visual.footprint, face);
  const main = [building.faces, ...perpendicularFaces(building.faces)];
  if (!main.includes(face) || faceBlocked(building, info)) return [];
  const obs = obstaclesAlong(building, face);
  const out = [];
  for (const f of [0.25, 0.75]) {
    const xl = (f - 0.5) * info.len;
    const abs = info.center + info.sign * xl;
    const nearDoor = obs.doors.some((d) => Math.abs(abs - d) < 1.0);
    const nearLight = obs.lights.some((l) => Math.abs(abs - l) < 1.05);
    out.push({ xl, ground: !nearDoor && !nearLight, upper: true });
  }
  return out;
}
// Finestres que són forats reals a la paret d'una casa accessible: totes les de planta baixa i, si té pis superior,
// també les de dalt. (Les de dalt d'una casa d'una sola planta són cegues: no hi ha res a veure darrere.)
export function openWindowList(building, face) {
  const hasUpper = !!(building.visual.interior && building.visual.interior.upper);
  const out = [];
  for (const s of windowSlots(building, face)) {
    if (s.ground) out.push({ xl: s.xl, yc: WINDOW.groundY });
    if (s.upper && hasUpper) out.push({ xl: s.xl, yc: WINDOW.upperY });
  }
  return out;
}
// Posicions de món de totes les finestres obertes d'un edifici (per a les proves): { x, z, y, nx, nz } (n = normal cap a fora).
export function openWindowWorldList(building) {
  const fp = building.visual.footprint;
  const out = [];
  for (const face of ['north', 'south', 'east', 'west']) {
    const info = faceInfo(fp, face);
    const horiz = face === 'south' || face === 'north';
    const n = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[face];
    const plane = { north: fp.zMin, south: fp.zMax, east: fp.xMax, west: fp.xMin }[face];
    for (const { xl, yc } of openWindowList(building, face)) {
      const abs = info.center + info.sign * xl;
      out.push({ face, x: horiz ? abs : plane, z: horiz ? plane : abs, y: yc, nx: n[0], nz: n[1] });
    }
  }
  return out;
}
// Forats rectangulars (Path) per afegir a la silueta d'una paret.
function windowHoles(shape, list) {
  const { w, h } = WINDOW;
  for (const { xl, yc } of list) {
    const p = new THREE.Path();
    p.moveTo(xl - w / 2, yc - h / 2); p.lineTo(xl + w / 2, yc - h / 2); p.lineTo(xl + w / 2, yc + h / 2); p.lineTo(xl - w / 2, yc + h / 2); p.closePath();
    shape.holes.push(p);
  }
  return shape;
}
// Marc exterior (4 llistons), ampit, creueta de fusta, vidre molt subtil (translúcid) i marc interior de fusta amb ampit.
// `t` = gruix de la paret. Tots els llistons són peces separades que no se solapen (cap cara coplanar).
function addOpenWindow(b, x, yc, t, avoid = [], rnd = b.rnd) {
  const { w, h } = WINDOW;
  const hw = w / 2 + 0.08; const hh = h / 2 + 0.08;
  // marc exterior
  b.box('wood', { xMin: x - hw, xMax: x - w / 2, yMin: yc - hh, yMax: yc + hh, zMin: 0, zMax: 0.07 }, TIMBER);
  b.box('wood', { xMin: x + w / 2, xMax: x + hw, yMin: yc - hh, yMax: yc + hh, zMin: 0, zMax: 0.07 }, TIMBER);
  b.box('wood', { xMin: x - w / 2, xMax: x + w / 2, yMin: yc + h / 2, yMax: yc + hh, zMin: 0, zMax: 0.07 }, TIMBER);
  b.box('wood', { xMin: x - w / 2, xMax: x + w / 2, yMin: yc - hh, yMax: yc - h / 2, zMin: 0, zMax: 0.07 }, TIMBER);
  // ampit exterior (sobresurt 14 cm)
  b.box('wood', { xMin: x - (w / 2 + 0.16), xMax: x + (w / 2 + 0.16), yMin: yc - hh - 0.08, yMax: yc - hh + 0.04, zMin: 0, zMax: 0.14 }, jit(TIMBER, 0.1, rnd));
  // creueta dins del gruix de la paret (només dos llistons prims: l'obertura queda lliure)
  const zm = -t / 2;
  b.box('wood', { xMin: x - 0.022, xMax: x + 0.022, yMin: yc - h / 2, yMax: yc + h / 2, zMin: zm - 0.02, zMax: zm + 0.02 }, TIMBER);
  b.box('wood', { xMin: x - w / 2, xMax: x - 0.022, yMin: yc - 0.022, yMax: yc + 0.022, zMin: zm - 0.015, zMax: zm + 0.015 }, TIMBER);
  b.box('wood', { xMin: x + 0.022, xMax: x + w / 2, yMin: yc - 0.022, yMax: yc + 0.022, zMin: zm - 0.015, zMax: zm + 0.015 }, TIMBER);
  // vidre: un sol pla translúcid (opacitat 0,12), mai opac
  b.add('pane', new THREE.PlaneGeometry(w, h), x, yc, zm, { tint: 0x9fb4d8 });
  // marc interior de fusta: muntants, llinda i ampit que sobresurt cap a l'estança
  const zi0 = -t - 0.06; const zi1 = -t;
  b.box('wood', { xMin: x - w / 2 - 0.07, xMax: x - w / 2, yMin: yc - h / 2, yMax: yc + h / 2, zMin: zi0, zMax: zi1 }, TIMBER);
  b.box('wood', { xMin: x + w / 2, xMax: x + w / 2 + 0.07, yMin: yc - h / 2, yMax: yc + h / 2, zMin: zi0, zMax: zi1 }, TIMBER);
  b.box('wood', { xMin: x - w / 2 - 0.07, xMax: x + w / 2 + 0.07, yMin: yc + h / 2, yMax: yc + h / 2 + 0.07, zMin: zi0, zMax: zi1 }, TIMBER);
  b.box('wood', { xMin: x - w / 2 - 0.12, xMax: x + w / 2 + 0.12, yMin: yc - h / 2 - 0.05, yMax: yc - h / 2 + 0.03, zMin: zi0 - 0.08, zMax: zi1 - 0.0 }, jit(TIMBER, 0.08, rnd));
  // porticons exteriors oberts, plans contra la façana (mai sobre el bastiment d'una porta)
  const leaf = (x0, x1) => {
    const lo = Math.min(x0, x1); const hi = Math.max(x0, x1);
    if (avoid.some(([a, c]) => hi > a - 0.02 && lo < c + 0.02)) return;
    b.box('wood', { xMin: lo, xMax: hi, yMin: yc - h / 2, yMax: yc + h / 2, zMin: 0.07, zMax: 0.12 }, jit(0xb0a094, 0.12, rnd));
  };
  const m = rnd();
  if (m < 0.6) { leaf(x - hw - 0.4, x - hw); leaf(x + hw, x + hw + 0.4); } else if (m < 0.8) leaf(x + hw, x + hw + 0.4);
}

// --- Detalls d'una cara de casa: sòcol, biga de planta, muntants, travessers, finestres ---
function addHouseFace(b, building, face, withWindows) {
  const fp = building.visual.footprint;
  const info = faceInfo(fp, face);
  const len = info.len;
  b.setFrame(info.frame);
  const openDoors = DOORS.filter((d) => d.buildingId === building.id && d.face === face && d.enterable);
  if (openDoors.length) { // el sòcol s'obre al pas de la porta (casa accessible)
    const xl = (openDoors[0].center[face === 'east' || face === 'west' ? 'z' : 'x'] - info.center) * info.sign;
    const gap = openDoors[0].width / 2 + 0.1;
    b.box('stone', { xMin: -len / 2 - 0.07, xMax: xl - gap, yMin: 0, yMax: 0.55, zMin: 0, zMax: 0.07 }, 0x8f9482);
    b.box('stone', { xMin: xl + gap, xMax: len / 2 + 0.07, yMin: 0, yMax: 0.55, zMin: 0, zMax: 0.07 }, 0x8f9482);
  } else {
    b.box('stone', { xMin: -len / 2 - 0.07, xMax: len / 2 + 0.07, yMin: 0, yMax: 0.55, zMin: 0, zMax: 0.07 }, 0x8f9482); // sòcol amb molsa
  }
  if (!withWindows || faceBlocked(building, info)) { b.setFrame(null); return; }
  b.box('wood', { xMin: -len / 2, xMax: len / 2, yMin: WINDOW.storeyY, yMax: WINDOW.storeyY + 0.2, zMin: 0, zMax: 0.07 }, TIMBER);
  b.box('wood', { xMin: -0.09, xMax: 0.09, yMin: WINDOW.storeyY + 0.2, yMax: building.visual.eaveHeight, zMin: 0, zMax: 0.06 }, TIMBER);
  for (const s of [-1, 1]) { // travessers en diagonal entre la biga i el muntant central
    const brace = texBox(1.0, 0.12, 0.05, TILE.wood, b.rnd);
    brace.rotateZ(s * Math.PI / 4);
    b.add('wood', brace, s * 0.45, 3.4, 0.025, { tint: TIMBER });
  }
  // intervals de bastiment de porta en X local (+0,04 m de marge): els porticons no els poden envair
  const avoid = DOORS.filter((d) => d.buildingId === building.id && d.face === face).map((d) => {
    const c = ((face === 'east' || face === 'west' ? d.center.z : d.center.x) - info.center) * info.sign;
    return [c - d.lintelWidth / 2, c + d.lintelWidth / 2];
  });
  const hollow = !!building.visual.interior;
  const hasUpper = hollow && !!building.visual.interior.upper;
  const t = hollow ? wallThickness(building, face) : 0;
  for (const s of windowSlots(building, face)) {
    if (s.ground) { if (hollow) addOpenWindow(b, s.xl, WINDOW.groundY, t, avoid); else addWindow(b, s.xl, WINDOW.groundY, avoid); }
    if (hasUpper) addOpenWindow(b, s.xl, WINDOW.upperY, t, avoid); else addWindow(b, s.xl, WINDOW.upperY, avoid);
  }
  b.setFrame(null);
}

function buildHouse(group, mats, building, seed) {
  const v = building.visual;
  const fp = requireRect(v.footprint, `${building.id}.visual.footprint`);
  if (!(v.ridgeHeight > v.eaveHeight)) fail(`${building.id}: ridgeHeight ha de ser > eaveHeight`);
  const st = BUILDING_STYLE[building.id] || DEFAULT_STYLE;
  const b = new Builder(group, mats, seed);
  const { span, length, frame } = buildingFrame(fp);
  const rise = v.ridgeHeight - v.eaveHeight;

  b.setFrame(frame);
  addPrism(b, span, length, v.eaveHeight, v.ridgeHeight, st.wall);
  addRoof(b, span, length, v.eaveHeight, rise, st.roof);
  addChimney(b, v.eaveHeight, rise, length, st.chimney ?? 0.5);
  b.setFrame(null);

  for (const cx of [fp.xMin, fp.xMax]) { // muntants de cantonada (fusta)
    for (const cz of [fp.zMin, fp.zMax]) {
      b.box('wood', {
        xMin: cx === fp.xMin ? cx - 0.04 : cx - 0.16, xMax: cx === fp.xMin ? cx + 0.16 : cx + 0.04,
        yMin: 0.5, yMax: v.eaveHeight,
        zMin: cz === fp.zMin ? cz - 0.04 : cz - 0.16, zMax: cz === fp.zMin ? cz + 0.16 : cz + 0.04,
      }, TIMBER);
    }
  }
  const main = [building.faces, ...perpendicularFaces(building.faces)];
  for (const face of ALL_FACES) addHouseFace(b, building, face, main.includes(face));
  b.finish();
  if (v.balcony) group.add(buildBalcony(mats, v.balcony, building, seed + 1));
}

// ---------------------------------------------------------------------
// CASES ACCESSIBLES (Fase B): parets buides, terra i sostre de fusta
// ---------------------------------------------------------------------
const HOUSE = { inner: 0x7c8092, floor: 0x6c5a4a, ceiling: 0x4e3f34, beam: 0x5a4636 };

// Paret lateral (E/W) d'una casa: rectangle de x0 a x1 i alçada `eave`, amb el pas de la porta tallat des de terra.
function houseSideShape(x0, x1, eave, door, windows = []) {
  const s = new THREE.Shape();
  s.moveTo(x0, 0);
  if (door) {
    const a = door.x - door.width / 2; const c = door.x + door.width / 2;
    s.lineTo(a, 0); s.lineTo(a, door.height); s.lineTo(c, door.height); s.lineTo(c, 0);
  }
  s.lineTo(x1, 0);
  s.lineTo(x1, eave);
  s.lineTo(x0, eave);
  return windowHoles(s, windows);
}

function buildHollowHouse(group, mats, building, seed) {
  const v = building.visual;
  const fp = requireRect(v.footprint, `${building.id}.visual.footprint`);
  const it = requireRect(v.interior && v.interior.footprint, `${building.id}.visual.interior.footprint`);
  if (!(v.ridgeHeight > v.eaveHeight)) fail(`${building.id}: ridgeHeight ha de ser > eaveHeight`);
  const st = BUILDING_STYLE[building.id] || DEFAULT_STYLE;
  const door = DOORS.find((d) => d.buildingId === building.id && d.enterable);
  const b = new Builder(group, mats, seed);
  const { span, length, frame } = buildingFrame(fp);
  if (!(length > span)) fail(`${building.id}: la casa accessible ha de tenir el carener al llarg de Z`);
  const eave = v.eaveHeight; const ridge = v.ridgeHeight;
  const rise = ridge - eave;
  const slope = rise / (span / 2);
  const inner = HOUSE.inner;

  b.setFrame(frame);
  addRoof(b, span, length, eave, rise, st.roof);
  addChimney(b, eave, rise, length, st.chimney ?? 0.5);
  b.setFrame(null);

  // Hastials (N i S): rectangle + frontó, sense porta (la porta és a una paret lateral).
  if (door && (door.face === 'north' || door.face === 'south')) fail(`${building.id}: la porta enterable ha de ser a una paret lateral (E/W)`);
  for (const face of ['south', 'north']) {
    const info = faceInfo(fp, face);
    const t = wallThickness(building, face);
    b.setFrame(info.frame);
    b.add('stone', extrudeWall(gableShape(info.len / 2, eave, ridge, null, openWindowList(building, face)), t), 0, 0, 0, { tint: st.wall, colorFn: depthShade(t, inner) });
    b.setFrame(null);
  }
  // Parets laterals (E i W) amb el pas de la porta, i la cunya sota el pendent de la teulada.
  const tS = wallThickness(building, 'south'); const tN = wallThickness(building, 'north');
  for (const face of ['east', 'west']) {
    const fi = faceInfo(fp, face);
    const t = wallThickness(building, face);
    const zS = fp.zMax - tS; const zN = fp.zMin + tN;
    const xa = (zS - fi.center) * fi.sign; const xb = (zN - fi.center) * fi.sign;
    const x0 = Math.min(xa, xb); const x1 = Math.max(xa, xb);
    const doorLocal = door && door.face === face ? { x: (door.center.z - fi.center) * fi.sign, width: door.width, height: door.height } : null;
    b.setFrame(fi.frame);
    b.add('stone', extrudeWall(houseSideShape(x0, x1, eave, doorLocal, openWindowList(building, face)), t), 0, 0, 0, { tint: st.wall, colorFn: depthShade(t, inner) });
    b.add('stone', naveWedge(x0, x1, t, eave, slope), 0, 0, 0, { tint: st.wall, colorFn: depthShade(t, inner) });
    b.setFrame(null);
  }

  for (const cx of [fp.xMin, fp.xMax]) { // muntants de cantonada (fusta)
    for (const cz of [fp.zMin, fp.zMax]) {
      b.box('wood', {
        xMin: cx === fp.xMin ? cx - 0.04 : cx - 0.16, xMax: cx === fp.xMin ? cx + 0.16 : cx + 0.04,
        yMin: 0.5, yMax: eave,
        zMin: cz === fp.zMin ? cz - 0.04 : cz - 0.16, zMax: cz === fp.zMin ? cz + 0.04 + 0.12 : cz + 0.04,
      }, TIMBER);
    }
  }
  const main = [building.faces, ...perpendicularFaces(building.faces)];
  for (const face of ALL_FACES) addHouseFace(b, building, face, main.includes(face));

  // Interior: terra de taulons, sostre de fusta amb tres bigues.
  const ceilY = v.interior.ceilingY;
  const upper = v.interior.upper || null;
  const cx = (it.xMin + it.xMax) / 2; const cz = (it.zMin + it.zMax) / 2;
  const w = it.xMax - it.xMin; const d = it.zMax - it.zMin;
  const floor = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  scaleUV(floor, w / TILE.wood, d / TILE.wood);
  b.add('wood', floor, cx, NAVE.floorY, cz, { tint: HOUSE.floor });
  if (!upper) {
    const ceil = new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2);
    scaleUV(ceil, w / TILE.wood, d / TILE.wood);
    b.add('wood', ceil, cx, ceilY, cz, { tint: HOUSE.ceiling });
    for (let k = 1; k <= 3; k++) { // bigues a través de la nau (X), repartides al llarg de Z
      const z = it.zMin + (d * k) / 4;
      b.box('wood', { xMin: it.xMin, xMax: it.xMax, yMin: ceilY - 0.16, yMax: ceilY, zMin: z - 0.09, zMax: z + 0.09 }, HOUSE.beam);
    }
  } else {
    addUpperFloor(b, building, it, ceilY, upper);
  }
  b.finish();
}

// --- Pis superior de la casa C (Fase C): forjat amb el forat de l'escala, escala massissa de graons reals, barana i sostre ---
const SLAB_TINT = 0x5c4b3c;
function addUpperFloor(b, building, it, ceilY, upper) {
  const slab = FLOORS.slabs.find((q) => q.buildingId === building.id);
  const stair = FLOORS.stairs.find((q) => q.buildingId === building.id);
  if (!slab || !stair) fail(`${building.id}: l'interior té pis superior però falten FLOORS.slabs/stairs`);
  const hole = slab.holes[0];
  const r = slab.rect;
  // Forjat = interior − forat. Dues peces: la franja nord (sobre el cim de l'escala) i la resta fins al forat.
  const rects = [
    { xMin: r.xMin, xMax: r.xMax, zMin: r.zMin, zMax: hole.zMin },
    { xMin: r.xMin, xMax: hole.xMin, zMin: hole.zMin, zMax: r.zMax },
  ];
  for (const q of rects) b.box('wood', { ...q, yMin: ceilY, yMax: slab.y }, SLAB_TINT);
  // bigues sota el forjat (només on hi ha forjat)
  const d = it.zMax - it.zMin;
  for (let k = 1; k <= 3; k++) {
    const z = it.zMin + (d * k) / 4;
    if (z < hole.zMin + 0.12) continue;
    b.box('wood', { xMin: it.xMin, xMax: hole.xMin, yMin: ceilY - 0.16, yMax: ceilY - 0.0001, zMin: z - 0.09, zMax: z + 0.09 }, HOUSE.beam);
  }
  // sostre del pis superior (pla + 3 bigues)
  const w = it.xMax - it.xMin;
  const ceil = new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2);
  scaleUV(ceil, w / TILE.wood, d / TILE.wood);
  b.add('wood', ceil, (it.xMin + it.xMax) / 2, upper.ceilingY, (it.zMin + it.zMax) / 2, { tint: HOUSE.ceiling });
  for (let k = 1; k <= 3; k++) {
    const z = it.zMin + (d * k) / 4;
    b.box('wood', { xMin: it.xMin, xMax: it.xMax, yMin: upper.ceilingY - 0.16, yMax: upper.ceilingY, zMin: z - 0.09, zMax: z + 0.09 }, HOUSE.beam);
  }
  // Escala: cada graó és un bloc massís de fusta des de terra (res de buits per on es vegi el sota).
  const sr = stair.rect;
  for (let k = 1; k <= stair.treads; k++) {
    const zFar = stair.start + stair.dir * k * stair.tread;
    const zNear = stair.start + stair.dir * (k - 1) * stair.tread;
    b.box('wood', {
      xMin: sr.xMin, xMax: sr.xMax, yMin: NAVE.floorY, yMax: k * stair.rise,
      zMin: Math.min(zFar, zNear), zMax: Math.max(zFar, zNear),
    }, k % 2 ? 0x7e6a58 : 0x74604f);
  }
  // últim contrahuell: del cim de l'última petjada fins sota el forjat
  const zTop = stair.start + stair.dir * stair.run;
  b.box('wood', { xMin: sr.xMin, xMax: sr.xMax, yMin: stair.treads * stair.rise, yMax: ceilY, zMin: zTop - 0.1, zMax: zTop }, 0x6a5646);
  // Barana de l'escala i del forat (costat oest, x ≈ 5,37): pals cada graó, passamà inclinat i barana plana al pis superior.
  const rx = sr.xMin - 0.05; // centre de la barana
  const W = 0.07;
  const postH = 0.95;
  for (let k = 1; k <= stair.treads; k += 1) {
    const zc = stair.start + stair.dir * (k - 0.5) * stair.tread;
    const y0 = k * stair.rise;
    b.box('wood', { xMin: rx - 0.025, xMax: rx + 0.025, yMin: y0, yMax: y0 + postH, zMin: zc - 0.025, zMax: zc + 0.025 }, 0x6a5646);
  }
  const yA = stair.rise + postH; const yB = stair.floorY + postH;
  const run = Math.abs(stair.run);
  const L = Math.hypot(run, yB - yA);
  const ang = Math.atan2(yB - yA, run);
  const rail = new THREE.BoxGeometry(W, W, L);
  rail.rotateX(ang * -stair.dir); // el passamà puja cap al cim (dir = −1 → puja cap a −Z)
  texUVBox(rail);
  b.add('wood', rail, rx, (yA + yB) / 2, stair.start + stair.dir * run / 2, { tint: 0x7e6a58 });
  // barana plana del forat (cim → paret sud): pals i dos travessers
  const zA = hole.zMin + 0.7; const zB = hole.zMax;
  for (let z = zA; z <= zB + 1e-6; z += 0.9) {
    const zz = Math.min(z, zB - 0.04);
    b.box('wood', { xMin: rx - 0.035, xMax: rx + 0.035, yMin: slab.y, yMax: slab.y + 1.05, zMin: zz - 0.035, zMax: zz + 0.035 }, 0x6a5646);
  }
  for (const [y0, y1] of [[slab.y + 0.95, slab.y + 1.03], [slab.y + 0.5, slab.y + 0.55]]) {
    b.box('wood', { xMin: rx - 0.03, xMax: rx + 0.03, yMin: y0, yMax: y1, zMin: zA - 0.03, zMax: zB }, 0x7e6a58);
  }
}
// UV d'una caixa girada: el tros és prim; la textura de fusta repeteix prou bé amb les UV originals (0..1) escalades.
function texUVBox(geo) { scaleUV(geo, 1 / 0.6, 1 / 0.6); return geo; }

// --- Església: nau amb façana gòtica, hastial amb rosetó i creu ---
function addFaceQuoins(b, len, height, tint) {
  for (const s of [-1, 1]) {
    for (let i = 0, y = 0.6; y < height; i++, y += 0.7) {
      const w = i % 2 ? 0.35 : 0.55;
      b.box('stone', { xMin: s > 0 ? len / 2 - w : -len / 2 - 0.05, xMax: s > 0 ? len / 2 + 0.05 : -len / 2 + w, yMin: y, yMax: y + 0.62, zMin: 0, zMax: 0.06 }, jit(tint, 0.06, b.rnd));
    }
  }
}

// --- Nau (Fase A): parets buides + interior accessible ---------------------
// Decisions visuals (el layout només dona empremta, interior i porta):
const NAVE = {
  window: { w: 1.0, sill: 1.8, straight: 2.1, apex: 0.6 }, // forat gòtic: base a 1,8 m, costats de 2,1 m, punta de 0,6 m
  bays: [1.6, 3.9, 6.2],   // eix de cada finestra, en m des de la cara interior de la paret del fons (a E i W)
  trusses: 5,              // encavallades repartides per tot el llarg de la nau
  floorY: 0.03,            // el terra interior queda 3 cm per sobre del terra del poble
  patch: { dist: 3.0, len: 2.4, w: 1.0, y: 0.05 }, // taques de llum de lluna al terra
  // Tons (es multipliquen per la textura i per la llum ambiental: com més fosc, més nit).
  tint: { inner: 0x5c6678, floor: 0x565c66, aisle: 0x6e747e, beam: 0x7a6c60, plank: 0x5a4e46, bar: 0x4a3f38 },
};
// Direcció horitzontal cap a la lluna del cel (main.js: SKY.moonDir = −0,5 · 0,5 · −0,7).
// La llum de lluna entra per les finestres del costat oposat i cau cap al terra.
const MOON_FROM = { x: -0.5, z: -0.7 };

// Gruix d'una paret = distància entre la cara exterior de l'empremta i la de l'interior.
function wallThickness(building, face) {
  const fp = building.visual.footprint;
  const it = building.visual.interior && building.visual.interior.footprint;
  if (!it) fail(`${building.id}: falta visual.interior.footprint`);
  const t = face === 'south' ? fp.zMax - it.zMax
    : face === 'north' ? it.zMin - fp.zMin
      : face === 'east' ? fp.xMax - it.xMax
        : it.xMin - fp.xMin;
  if (!(t > 0)) fail(`${building.id}: l'interior no cap dins l'empremta (cara ${face})`);
  return t;
}

// Degradat de to per vèrtex dins d'una paret de gruix `thick` (z local: 0 = cara exterior,
// −thick = cara interior): exterior = to normal de la pedra, interior = `innerHex` (fosc).
function depthShade(thick, innerHex) {
  const inner = new THREE.Color(innerHex);
  return (x, y, z, c) => {
    const k = 1 - Math.min(1, Math.max(0, (z + thick) / thick));
    c.lerp(inner, k);
  };
}

// Extrusió d'una paret cap a l'INTERIOR de l'edifici (cara exterior a z local = 0).
function extrudeWall(shape, thick) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -thick);
  scaleUV(g, 1 / TILE.stone);
  return g;
}

// Silueta d'una paret d'hastial (façana o fons): rectangle + frontó, amb l'arc de la porta
// tallat des de terra (sense forat tancat perquè la porta toca y = 0).
function gableShape(halfW, eave, ridge, door, windows = []) {
  const s = new THREE.Shape();
  s.moveTo(-halfW, 0);
  if (door) {
    const r = door.width / 2; const straight = door.height - r;
    s.lineTo(door.x - r, 0);
    s.lineTo(door.x - r, straight);
    s.absarc(door.x, straight, r, Math.PI, 0, true);
    s.lineTo(door.x + r, 0);
  }
  s.lineTo(halfW, 0);
  s.lineTo(halfW, eave);
  s.lineTo(0, ridge);
  s.lineTo(-halfW, eave);
  return windowHoles(s, windows);
}

// Paret lateral (E/W): rectangle de x0 a x1 i alçada `eave`, amb forats de finestra gòtica.
function sideWallShape(x0, x1, eave, windowXs) {
  const s = new THREE.Shape();
  s.moveTo(x0, 0);
  s.lineTo(x1, 0);
  s.lineTo(x1, eave);
  s.lineTo(x0, eave);
  const W = NAVE.window;
  for (const cx of windowXs) s.holes.push(gothicHole(cx, W.w, W.sill, W.straight, W.apex));
  return s;
}

// Cunya de pedra sobre la paret lateral: omple el triangle entre la part alta de la paret
// (y = eave) i el pendent de la teulada a la cara interior. Prisma al llarg de x (x0 → x1).
function naveWedge(x0, x1, thick, eave, slope) {
  const s = new THREE.Shape();
  s.moveTo(0, eave);
  s.lineTo(-thick, eave);
  s.lineTo(-thick, eave + slope * thick);
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); // forma X → z local; extrusió → −x local
  g.translate(x1, 0, 0);
  scaleUV(g, 1 / TILE.stone);
  return g;
}

// Franja de terra amb UV en coordenades de món (l'empedrat continua de franja a franja).
function addFloorStrip(b, xMin, xMax, zMin, zMax, y, tint) {
  if (!(xMax > xMin && zMax > zMin)) fail('Franja de terra invàlida');
  const cx = (xMin + xMax) / 2; const cz = (zMin + zMax) / 2;
  const geo = new THREE.PlaneGeometry(xMax - xMin, zMax - zMin).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + pos.getX(i)) / COBBLE_TILE, (cz + pos.getZ(i)) / COBBLE_TILE);
  b.add('floor', geo, cx, y, cz, { tint });
}

// Estructura de fusta del sostre: forjat inclinat, encavallades, carener i corretges.
function addNaveTimber(b, fp, it, eave, ridge) {
  const xc = (fp.xMin + fp.xMax) / 2;
  const tanA = (ridge - eave) / ((fp.xMax - fp.xMin) / 2);
  const A = Math.atan(tanA); const sinA = Math.sin(A); const cosA = Math.cos(A);
  const yLine = (dx) => ridge - tanA * Math.abs(dx);   // cara inferior de la teulada
  const halfIn = (it.xMax - it.xMin) / 2;
  const zlen = it.zMax - it.zMin; const zc = (it.zMax + it.zMin) / 2;
  const T = NAVE.tint;
  const L = Math.hypot(halfIn, ridge - yLine(halfIn));  // llargada del pendent dins de la nau
  const my = (ridge + yLine(halfIn)) / 2;

  for (const side of [-1, 1]) {
    const mx = xc + (side * halfIn) / 2;
    // Forjat de taulons just sota la teulada.
    const plank = texBox(L + 0.02, 0.05, zlen + 0.04, TILE.wood, b.rnd);
    plank.rotateZ(-side * A);
    b.add('wood', plank, mx - side * sinA * 0.03, my - cosA * 0.03, zc, { tint: T.plank });
    // Corretja (biga longitudinal) a mitja alçada del pendent.
    const purlin = texBox(0.2, 0.2, zlen + 0.04, TILE.wood, b.rnd);
    purlin.rotateZ(-side * A);
    b.add('wood', purlin, xc + side * 1.7 - side * sinA * 0.27, yLine(1.7) - cosA * 0.27, zc, { tint: T.beam });
  }
  b.box('wood', { xMin: xc - 0.12, xMax: xc + 0.12, yMin: ridge - 0.45, yMax: ridge - 0.12, zMin: it.zMin - 0.02, zMax: it.zMax + 0.02 }, T.beam); // carener

  const tieY0 = eave + 0.15; const tieY1 = eave + 0.45;
  const strutFrom = [0, eave + 0.7]; const strutX = 1.45;
  const strutTo = [strutX, yLine(strutX) - 0.25];
  const strutL = Math.hypot(strutTo[0] - strutFrom[0], strutTo[1] - strutFrom[1]);
  const strutA = Math.atan2(strutTo[1] - strutFrom[1], strutTo[0] - strutFrom[0]);
  for (let k = 0; k < NAVE.trusses; k++) {
    const z = it.zMax - ((k + 0.5) * zlen) / NAVE.trusses;
    b.box('wood', { xMin: it.xMin - 0.05, xMax: it.xMax + 0.05, yMin: tieY0, yMax: tieY1, zMin: z - 0.11, zMax: z + 0.11 }, T.beam);   // tirant
    b.box('wood', { xMin: xc - 0.1, xMax: xc + 0.1, yMin: tieY1, yMax: ridge - 0.4, zMin: z - 0.1, zMax: z + 0.1 }, T.beam);          // pal central
    for (const side of [-1, 1]) {
      const rafter = texBox(L, 0.16, 0.2, TILE.wood, b.rnd);                                                                        // cabiró
      rafter.rotateZ(-side * A);
      b.add('wood', rafter, xc + (side * halfIn) / 2 - side * sinA * 0.135, my - cosA * 0.135, z, { tint: T.beam });
      const strut = texBox(strutL, 0.14, 0.18, TILE.wood, b.rnd);                                                                    // tornapunta
      strut.rotateZ(side * strutA);
      b.add('wood', strut, xc + (side * (strutFrom[0] + strutTo[0])) / 2, (strutFrom[1] + strutTo[1]) / 2, z, { tint: T.beam });
    }
  }
}

function buildNave(group, mats, building, seed) {
  const v = building.visual;
  const fp = requireRect(v.footprint, `${building.id}.visual.footprint`);
  const it = requireRect(v.interior && v.interior.footprint, `${building.id}.visual.interior.footprint`);
  const st = BUILDING_STYLE[building.id];
  const door = DOORS.find((d) => d.buildingId === building.id && d.enterable);
  if (door && door.face !== building.faces) fail(`${building.id}: la porta enterable ha de ser a la façana ('${building.faces}')`);
  const b = new Builder(group, mats, seed);
  const { span, length, frame } = buildingFrame(fp);
  if (!(length > span)) fail(`${building.id}: la nau ha de ser més llarga en Z que ampla (carener al llarg de Z)`);
  const eave = v.eaveHeight; const ridge = v.ridgeHeight;
  const slope = (ridge - eave) / (span / 2);
  const tS = wallThickness(building, 'south'); const tN = wallThickness(building, 'north');
  const tE = wallThickness(building, 'east'); const tW = wallThickness(building, 'west');
  const inner = NAVE.tint.inner;

  // Teulada (igual que abans: els carenats i el ràfec no canvien).
  b.setFrame(frame);
  addRoof(b, span, length, eave, ridge - eave, st.roof);
  b.setFrame(null);

  // --- Parets buides (la silueta exterior és idèntica a la del prisma massís anterior) ---
  const info = faceInfo(fp, building.faces); // façana sud
  const len = info.len;
  const doorLocal = door ? { x: (door.center.x - info.center) * info.sign, width: door.width, height: door.height } : null;
  b.setFrame(info.frame);
  b.add('stone', extrudeWall(gableShape(len / 2, eave, ridge, doorLocal), tS), 0, 0, 0, { tint: st.wall, colorFn: depthShade(tS, inner) });
  b.setFrame(null);
  const nInfo = faceInfo(fp, 'north');
  b.setFrame(nInfo.frame);
  b.add('stone', extrudeWall(gableShape(nInfo.len / 2, eave, ridge, null), tN), 0, 0, 0, { tint: st.wall, colorFn: depthShade(tN, inner) });
  b.setFrame(null);

  const sideInfo = {};
  for (const face of ['east', 'west']) {
    const fi = faceInfo(fp, face); sideInfo[face] = fi;
    const t = face === 'east' ? tE : tW;
    const half = fi.len / 2;
    // Extrem sud / nord de la paret lateral en coordenades locals (X local = sentit `sign` respecte a Z).
    const zS = fp.zMax - tS; const zN = fp.zMin + tN;
    const xa = (zS - fi.center) * fi.sign; const xb = (zN - fi.center) * fi.sign;
    const x0 = Math.min(xa, xb); const x1 = Math.max(xa, xb);
    if (!(x0 >= -half - EPS && x1 <= half + EPS)) fail(`${building.id}: paret ${face} fora de l'empremta`);
    const windowXs = NAVE.bays.map((bay) => (it.zMin + bay - fi.center) * fi.sign);
    b.setFrame(fi.frame);
    b.add('stone', extrudeWall(sideWallShape(x0, x1, eave, windowXs), t), 0, 0, 0, { tint: st.wall, colorFn: depthShade(t, inner) });
    b.add('stone', naveWedge(x0, x1, t, eave, slope), 0, 0, 0, { tint: st.wall, colorFn: depthShade(t, inner) });
    const W = NAVE.window;
    for (const cx of windowXs) { // creu de fusta al mig del gruix de la paret
      b.box('wood', { xMin: cx - 0.025, xMax: cx + 0.025, yMin: W.sill - 0.02, yMax: W.sill + W.straight + 0.3, zMin: -t / 2 - 0.025, zMax: -t / 2 + 0.025 }, NAVE.tint.bar);
      b.box('wood', { xMin: cx - W.w / 2 - 0.02, xMax: cx + W.w / 2 + 0.02, yMin: W.sill + W.straight * 0.55 - 0.025, yMax: W.sill + W.straight * 0.55 + 0.025, zMin: -t / 2 - 0.025, zMax: -t / 2 + 0.025 }, NAVE.tint.bar);
    }
    b.setFrame(null);
  }

  // --- Detalls exteriors de la façana (com abans, però el sòcol s'obre al pas de la porta) ---
  b.setFrame(info.frame);
  const socL = -len / 2 - 0.06; const socR = len / 2 + 0.06;
  if (doorLocal) {
    const gap = doorLocal.width / 2 + DOOR.archMargin;
    b.box('stone', { xMin: socL, xMax: doorLocal.x - gap, yMin: 0, yMax: 0.6, zMin: 0, zMax: 0.07 }, 0x8f9482);
    b.box('stone', { xMin: doorLocal.x + gap, xMax: socR, yMin: 0, yMax: 0.6, zMin: 0, zMax: 0.07 }, 0x8f9482);
  } else {
    b.box('stone', { xMin: socL, xMax: socR, yMin: 0, yMax: 0.6, zMin: 0, zMax: 0.07 }, 0x8f9482); // sòcol
  }
  b.box('stone', { xMin: -len / 2, xMax: len / 2, yMin: eave - 0.35, yMax: eave - 0.05, zMin: 0, zMax: 0.08 }, 0xe6e6ee); // cornisa
  addFaceQuoins(b, len, eave - 0.4, 0xe2e4ea);
  for (const s of [-1, 1]) { // lancetes de la façana (a banda i banda de la porta; cegues)
    const x = s * 2.5;
    b.add('stone', gothicGeometry(1.1, 1.9, 0.8, 0.07), x, 2.95, 0, { tint: 0xe2e4ea });
    b.add('glass', gothicGeometry(0.8, 1.9, 0.6, 0.02), x, 3.0, 0.07, { tint: 0x14161f });
    b.box('wood', { xMin: x - 0.025, xMax: x + 0.025, yMin: 3.0, yMax: 4.9, zMin: 0.07, zMax: 0.09 }, TIMBER);
  }
  b.add('stone', new THREE.CylinderGeometry(0.66, 0.66, 0.1, 8).rotateX(Math.PI / 2), 0, 8.0, 0.05, { tint: 0xe2e4ea }); // rosetó: anell
  b.add('glass', new THREE.CylinderGeometry(0.46, 0.46, 0.04, 8).rotateX(Math.PI / 2), 0, 8.0, 0.1, { tint: 0x14161f });
  b.box('wood', { xMin: -0.03, xMax: 0.03, yMin: 7.54, yMax: 8.46, zMin: 0.1, zMax: 0.12 }, TIMBER);
  b.box('wood', { xMin: -0.46, xMax: 0.46, yMin: 7.97, yMax: 8.03, zMin: 0.1, zMax: 0.12 }, TIMBER);
  // creu de ferro al capdamunt de l'hastial
  b.box('plainD', { xMin: -0.04, xMax: 0.04, yMin: ridge - 0.1, yMax: ridge + 0.75, zMin: -0.05, zMax: 0.05 }, 0x2a282e);
  b.box('plainD', { xMin: -0.22, xMax: 0.22, yMin: ridge + 0.38, yMax: ridge + 0.47, zMin: -0.05, zMax: 0.05 }, 0x2a282e);
  b.setFrame(null);

  // --- Interior: terra, estructura de fusta i taques de llum de lluna ---
  const fy = NAVE.floorY;
  const ax = door ? door.center.x : (it.xMin + it.xMax) / 2;
  const ah = door ? door.width / 2 : 1.1;
  addFloorStrip(b, it.xMin, ax - ah, it.zMin, it.zMax, fy, NAVE.tint.floor);   // laterals de la nau
  addFloorStrip(b, ax + ah, it.xMax, it.zMin, it.zMax, fy, NAVE.tint.floor);
  addFloorStrip(b, ax - ah, ax + ah, it.zMin, fp.zMax, fy, NAVE.tint.aisle);    // passadís central fins al pas de la porta

  addNaveTimber(b, fp, it, eave, ridge);

  const mh = Math.hypot(MOON_FROM.x, MOON_FROM.z);
  const hx = -MOON_FROM.x / mh; const hz = -MOON_FROM.z / mh;                   // sentit en què viatja la llum
  const wallX = hx > 0 ? it.xMin : it.xMax;                                     // paret per on entra
  for (const bay of NAVE.bays) {
    const P = NAVE.patch;
    const geo = new THREE.PlaneGeometry(P.w, P.len).rotateX(-Math.PI / 2);
    b.add('moonPatch', geo, wallX + hx * P.dist, P.y, it.zMin + bay + hz * P.dist, { rotY: Math.atan2(-hx, -hz) });
  }
  b.finish();
}

// --- Campanar: cos, cornisa, pinacles, obertures amb campana, piràmide i creu ---
function buildTower(group, mats, building, seed) {
  const v = building.visual;
  const fp = requireRect(v.footprint, `${building.id}.visual.footprint`);
  const st = BUILDING_STYLE[building.id];
  const w = fp.xMax - fp.xMin; const d = fp.zMax - fp.zMin;
  if (Math.abs(w - d) > EPS) fail(`${building.id}: el campanar ha de tenir empremta quadrada`);
  const bodyH = v.height - TOWER.roofHeight - TOWER.crossHeight;
  const cx = (fp.xMin + fp.xMax) / 2; const cz = (fp.zMin + fp.zMax) / 2;
  const b = new Builder(group, mats, seed);

  // Si el campanar comparteix paret amb una nau amb interior, el cos arriba fins a la seva
  // paret exterior; el tros que queda dins la paret només es dibuixa per sobre del ràfec.
  const nave = BUILDINGS.find((n) => n.id !== building.id && n.visual.interior
    && n.visual.footprint.xMin > fp.xMin && n.visual.footprint.xMin < fp.xMax
    && n.visual.footprint.zMin < fp.zMax && n.visual.footprint.zMax > fp.zMin);
  const bodyXMax = nave ? nave.visual.footprint.xMin : fp.xMax;
  b.box('stone', { xMin: fp.xMin, xMax: bodyXMax, yMin: 0, yMax: bodyH, zMin: fp.zMin, zMax: fp.zMax + TOWER.southBump }, st.wall);
  if (nave) b.box('stone', { xMin: bodyXMax, xMax: fp.xMax, yMin: nave.visual.eaveHeight, yMax: bodyH, zMin: fp.zMin, zMax: fp.zMax + TOWER.southBump }, st.wall);
  b.box('stone', { xMin: fp.xMin - 0.1, xMax: fp.xMax + 0.1, yMin: bodyH - 0.25, yMax: bodyH, zMin: fp.zMin - 0.1, zMax: fp.zMax + 0.1 }, 0xe6e6ee);
  // Socle: si la nau és adossada, s'atura a la seva cara exterior (no pot sobresortir dins l'interior).
  b.box('stone', { xMin: fp.xMin - 0.07, xMax: nave ? bodyXMax : fp.xMax + 0.07, yMin: 0, yMax: 0.6, zMin: fp.zMin - 0.07, zMax: fp.zMax + 0.07 }, 0x8f9482);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // pinacles de cantonada
    const pin = new THREE.ConeGeometry(0.22, 0.55, 4).rotateY(Math.PI / 4);
    b.add('stone', pin, sx > 0 ? fp.xMax - 0.15 : fp.xMin + 0.15, bodyH + 0.275, sz > 0 ? fp.zMax - 0.15 : fp.zMin + 0.15, { tint: 0xd8dae2 });
  }
  // Pedres de cantonada (només a la banda oest: l'est és dins de la nau)
  for (const cz2 of [fp.zMin, fp.zMax]) {
    const sz = cz2 === fp.zMin ? -1 : 1;
    for (let i = 0, y = 0.6; y < bodyH - 0.5; i++, y += 0.7) {
      const l = i % 2 ? 0.35 : 0.55;
      const zA = sz > 0 ? cz2 - 0.12 : cz2 - 0.04; const zB = sz > 0 ? cz2 + 0.04 + (cz2 === fp.zMax ? TOWER.southBump : 0) : cz2 + 0.12;
      b.box('stone', { xMin: fp.xMin - 0.04, xMax: fp.xMin + l, yMin: y, yMax: y + 0.62, zMin: zA, zMax: zB }, jit(0xe2e4ea, 0.06, b.rnd));
    }
  }
  // Troneres (lancetes estretes) a S, N i O
  for (const face of ['south', 'north', 'west']) {
    const info = faceInfo(fp, face);
    b.setFrame(info.frame);
    const zOff = face === 'south' ? TOWER.southBump : 0;
    for (const y of [2.8, 5.6]) {
      b.add('stone', gothicGeometry(0.5, 0.8, 0.3, 0.05), 0, y, zOff, { tint: 0xe2e4ea });
      b.add('glass', gothicGeometry(0.26, 0.8, 0.2, 0.02), 0, y, zOff + 0.05, { tint: 0x14161f });
    }
    b.setFrame(null);
  }
  // Obertures del campanar amb campana (4 cares)
  for (const face of ALL_FACES) {
    const info = faceInfo(fp, face);
    b.setFrame(info.frame);
    const zOff = face === 'south' ? TOWER.southBump : 0;
    const y0 = TOWER.belfryY;
    b.add('stone', archGeometry(1.5, 1.4, 0.05), 0, y0 - 0.05, zOff, { tint: 0xe2e4ea });
    b.add('glass', archGeometry(1.2, 1.4, 0.05), 0, y0, zOff + 0.03, { tint: 0x0e1016 });
    b.box('wood', { xMin: -0.62, xMax: 0.62, yMin: 9.3, yMax: 9.42, zMin: zOff + 0.06, zMax: zOff + 0.2 }, TIMBER);
    b.add('plainD', new THREE.ConeGeometry(0.32, 0.55, 8), 0, 9.02, zOff + 0.13, { tint: 0x8a6a30 });
    b.box('plainD', { xMin: -0.03, xMax: 0.03, yMin: 8.65, yMax: 8.8, zMin: zOff + 0.1, zMax: zOff + 0.16 }, 0x2a282e);
    b.setFrame(null);
  }
  // Piràmide de teula (pissarra) i creu de ferro
  const roof = new THREE.ConeGeometry(w / Math.SQRT2, TOWER.roofHeight, 4, 1).rotateY(Math.PI / 4);
  scaleUV(roof, 2, 1.4);
  b.add('roof', roof, cx, bodyH + TOWER.roofHeight / 2, cz, { tint: st.roof });
  const apex = bodyH + TOWER.roofHeight;
  b.box('plainD', { xMin: cx - 0.045, xMax: cx + 0.045, yMin: apex - 0.05, yMax: apex + TOWER.crossHeight, zMin: cz - 0.045, zMax: cz + 0.045 }, 0x2a282e);
  b.box('plainD', { xMin: cx - 0.25, xMax: cx + 0.25, yMin: apex + 0.4, yMax: apex + 0.49, zMin: cz - 0.045, zMax: cz + 0.045 }, 0x2a282e);
  b.finish();
}

function buildBuildings(mats, parent) {
  const group = makeGroup('Buildings');
  BUILDINGS.forEach((building, i) => {
    const g = makeGroup(building.id, building.id);
    if (building.visual.eaveHeight !== undefined) {
      if (building.id === 'CH-N') buildNave(g, mats, building, 1000 + i);
      else if (building.visual.interior) buildHollowHouse(g, mats, building, 1000 + i);
      else buildHouse(g, mats, building, 1000 + i);
    } else if (building.visual.height !== undefined) {
      buildTower(g, mats, building, 1000 + i);
    } else {
      fail(`${building.id}: el visual no defineix ni eaveHeight ni height`);
    }
    group.add(g);
  });
  parent.add(group);
}

// ---------------------------------------------------------------------
// BALCÓ (només visual; per sota queda lliure, sense suports)
// ---------------------------------------------------------------------
const BALCONY = { slab: 0.12, railHeight: 1.0, railThick: 0.06, step: 0.22, balusterThick: 0.04 };

function buildBalcony(mats, balcony, building, seed) {
  const fp = requireRect(balcony.footprint, `${building.id}.balcony.footprint`);
  const bfp = building.visual.footprint;
  const side = Math.abs(fp.xMax - bfp.xMin) < EPS ? 'xMax' : Math.abs(fp.xMin - bfp.xMax) < EPS ? 'xMin' : null;
  if (!side) fail(`${building.id}: el balcó ha de tocar la façana E/W de l'edifici`);
  const g = makeGroup(`${building.id}-balcony`, `${building.id}-balcony`);
  const b = new Builder(g, mats, seed);
  const y0 = balcony.undersideY;
  const y1 = y0 + BALCONY.slab;
  const t = BALCONY.railThick;
  const top = y1 + BALCONY.railHeight;

  b.box('wood', { ...fp, yMin: y0, yMax: y1 }, 0xb0a090);
  const rails = [
    side === 'xMax' ? { xMin: fp.xMin, xMax: fp.xMin + t, zMin: fp.zMin, zMax: fp.zMax }
      : { xMin: fp.xMax - t, xMax: fp.xMax, zMin: fp.zMin, zMax: fp.zMax },
    { xMin: fp.xMin, xMax: fp.xMax, zMin: fp.zMin, zMax: fp.zMin + t },
    { xMin: fp.xMin, xMax: fp.xMax, zMin: fp.zMax - t, zMax: fp.zMax },
  ];
  for (const r of rails) {
    b.box('wood', { ...r, yMin: top - t, yMax: top }, 0x8a7a6e);                    // passamà
    b.box('wood', { ...r, yMin: y1 + 0.02, yMax: y1 + 0.02 + t }, 0x8a7a6e);        // travesser baix
    const alongX = (r.xMax - r.xMin) > (r.zMax - r.zMin);
    const len = alongX ? r.xMax - r.xMin : r.zMax - r.zMin;
    const n = Math.max(2, Math.round(len / BALCONY.step) + 1);
    const bt = BALCONY.balusterThick;
    for (let i = 0; i < n; i++) {                                                   // barrots
      const u = (len - bt) * (i / (n - 1));
      const box = alongX
        ? { xMin: r.xMin + u, xMax: r.xMin + u + bt, zMin: r.zMin, zMax: r.zMax }
        : { xMin: r.xMin, xMax: r.xMax, zMin: r.zMin + u, zMax: r.zMin + u + bt };
      b.box('wood', { ...box, yMin: y1, yMax: top - t }, jit(0xa09080, 0.1, b.rnd));
    }
  }
  b.finish();
  return g;
}

// ---------------------------------------------------------------------
// MURS: pedra amb relleu (blocs que sobresurten 4 cm) i coronació
// ---------------------------------------------------------------------
function buildWalls(mats, parent) {
  const group = makeGroup('Walls');
  WALLS.forEach((w, i) => {
    if (w.id === GATE.wallId) return; // el mur M-S2 el dibuixa buildGate() (porta reixada); la col·lisió és la del layout
    const fp = requireRect(w.visual.footprint, `${w.id}.visual.footprint`);
    const H = w.visual.height;
    const g = makeGroup(w.id, w.id);
    const b = new Builder(g, mats, 3000 + i);
    b.box('stone', { ...fp, yMin: 0, yMax: H }, jit(0xe0dccf, 0.08, b.rnd));
    b.box('stone', { xMin: fp.xMin - 0.04, xMax: fp.xMax + 0.04, yMin: H, yMax: H + 0.1, zMin: fp.zMin - 0.04, zMax: fp.zMax + 0.04 }, 0xb4b0a4); // coronació
    const longX = (fp.xMax - fp.xMin) > (fp.zMax - fp.zMin);
    const len = longX ? fp.xMax - fp.xMin : fp.zMax - fp.zMin;
    const count = Math.min(14, Math.max(2, Math.round(len)));
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < count; k++) {
        const bl = 0.4 + b.rnd() * 0.4; const bh = 0.25 + b.rnd() * 0.2;
        const u = b.rnd() * (len - bl); const y = 0.15 + b.rnd() * (H - 0.3 - bh);
        const tint = jit(0xe8e2d2, 0.14, b.rnd);
        if (longX) {
          const z0 = sgn > 0 ? fp.zMax : fp.zMin - 0.04;
          b.box('stone', { xMin: fp.xMin + u, xMax: fp.xMin + u + bl, yMin: y, yMax: y + bh, zMin: z0, zMax: z0 + 0.04 }, tint);
        } else {
          const x0 = sgn > 0 ? fp.xMax : fp.xMin - 0.04;
          b.box('stone', { xMin: x0, xMax: x0 + 0.04, yMin: y, yMax: y + bh, zMin: fp.zMin + u, zMax: fp.zMin + u + bl }, tint);
        }
      }
    }
    b.finish();
    group.add(g);
  });
  parent.add(group);
}


// ---------------------------------------------------------------------
// ENTRADA DEL POBLE (Fase C): porta reixada de ferro (portcullis) entre dos pilars de pedra, al final del carrer d'entrada.
// Substitueix el dibuix del mur M-S2 (la seva col·lisió, sòlida de paret a paret, no canvia: la reixa és infranquejable).
// ---------------------------------------------------------------------
function buildGate(mats, parent) {
  const W = WALLS.find((q) => q.id === GATE.wallId);
  const fp = requireRect(W.visual.footprint, `${W.id}.visual.footprint`);
  const g = makeGroup('Gate', GATE.id);
  const b = new Builder(g, mats, 8100);
  const rnd = b.rnd;
  const half = GATE.openingWidth / 2;
  const zc = (fp.zMin + fp.zMax) / 2;       // pla de la reixa (29,2)
  const z0 = fp.zMin - 0.1; const z1 = fp.zMax + 0.1; // els pilars sobresurten 10 cm per cada cara
  const H = GATE.height;
  const stoneT = (k) => jit(k, 0.07, rnd);
  // Pilars de pedra (fins a la llinda) amb capitell
  for (const sgn of [-1, 1]) {
    const x0 = sgn < 0 ? fp.xMin : half; const x1 = sgn < 0 ? -half : fp.xMax;
    b.box('stone', { xMin: x0, xMax: x1, yMin: 0, yMax: GATE.archTop, zMin: z0, zMax: z1 }, stoneT(0xb4b0a4));
    b.box('stone', { xMin: x0 - 0.06, xMax: x1 + 0.06, yMin: GATE.archTop, yMax: GATE.archTop + 0.18, zMin: z0 - 0.06, zMax: z1 + 0.06 }, 0x9c988c); // capitell
    for (const y of [0.9, 1.9, 2.8]) b.box('stone', { xMin: x0 - 0.04, xMax: x1 + 0.04, yMin: y, yMax: y + 0.08, zMin: z0 - 0.04, zMax: z1 + 0.04 }, 0xa09c90); // filades sortints
  }
  // Llinda de pedra amb dovella central i una escopidora sota (la reixa puja cap a dins)
  b.box('stone', { xMin: fp.xMin, xMax: fp.xMax, yMin: H, yMax: GATE.archTop, zMin: z0, zMax: z1 }, stoneT(0xaca89c));
  b.box('stone', { xMin: -0.3, xMax: 0.3, yMin: H - 0.18, yMax: H, zMin: z0 - 0.04, zMax: z1 + 0.04 }, 0x8c887c);         // dovella
  b.box('stone', { xMin: -half, xMax: half, yMin: 0, yMax: 0.1, zMin: fp.zMin - 0.02, zMax: fp.zMax + 0.02 }, 0x8a867a);   // llindar
  // Reixa: barrots verticals amb punxes cap avall, travessers, bastiment i reblons
  const iron = () => jit(0x24252c, 0.12, rnd);
  const n = Math.round(GATE.openingWidth / GATE.barSpacing);
  const step = GATE.openingWidth / n;
  const barX = [];
  for (let i = 0; i <= n; i++) barX.push(-half + i * step);
  const rows = [0.55, 1.2, 1.85, 2.5];
  for (const x of barX) {
    const edge = Math.abs(Math.abs(x) - half) < 1e-6;
    const hw = edge ? 0.05 : 0.025;
    b.box('plainD', { xMin: x - hw, xMax: x + hw, yMin: 0.2, yMax: H, zMin: zc - 0.045, zMax: zc + 0.045 }, iron());
    if (!edge) b.add('plainD', new THREE.ConeGeometry(0.032, 0.2, 4).rotateX(Math.PI), x, 0.1, zc, { tint: iron() }); // punxa cap avall
  }
  for (const y of rows) b.box('plainD', { xMin: -half, xMax: half, yMin: y - 0.035, yMax: y + 0.035, zMin: zc - 0.085, zMax: zc - 0.015 }, iron()); // travessers al costat del carrer
  for (const y of rows) b.box('plainD', { xMin: -half, xMax: half, yMin: y - 0.035, yMax: y + 0.035, zMin: zc + 0.015, zMax: zc + 0.085 }, iron()); // i al costat del bosc
  b.box('plainD', { xMin: -half, xMax: half, yMin: H - 0.14, yMax: H - 0.04, zMin: zc - 0.1, zMax: zc + 0.1 }, iron());   // bastiment superior
  b.box('plainD', { xMin: -half, xMax: half, yMin: 0.12, yMax: 0.24, zMin: zc - 0.1, zMax: zc + 0.1 }, iron());           // bastiment inferior
  // Reblons a les creus de barrots i travessers (cares de carrer)
  for (const x of barX) for (const y of rows) b.box('plainD', { xMin: x - 0.04, xMax: x + 0.04, yMin: y - 0.04, yMax: y + 0.04, zMin: zc - 0.105, zMax: zc - 0.085 }, 0x3a3b44);
  // Frontisses de forja al pilar oest (platines amb anella) i cadenes de contrapès als dos costats
  for (const y of [0.7, 1.6, 2.5]) {
    b.box('plainD', { xMin: -half - 0.06, xMax: -half + 0.5, yMin: y - 0.06, yMax: y + 0.06, zMin: zc - 0.115, zMax: zc - 0.095 }, iron());
    b.add('plainD', new THREE.TorusGeometry(0.07, 0.018, 5, 9), -half - 0.02, y, zc - 0.115, { tint: iron() });
  }
  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 9; k++) b.add('plainD', new THREE.TorusGeometry(0.035, 0.009, 4, 7), sgn * (half - 0.22), H + 0.12 + k * 0.06 - 0.12, z0 + 0.02, { tint: iron(), rotY: k % 2 ? Math.PI / 2 : 0 });
  }
  b.finish();
  parent.add(g);
}

// ---------------------------------------------------------------------
// BOSC NOCTURN (Fase C): visible a través de la reixa. No és accessible (cap col·lisió: el jugador no hi pot arribar).
// Només ~120 arbres en poques malles fusionades: pins (tronc + 4 cons), arbres morts amb branques, mates i petites boires.
// ---------------------------------------------------------------------
function buildForest(mats, parent) {
  const g = makeGroup('Forest', 'FOREST');
  const b = new Builder(g, mats, FOREST.seed);
  const rnd = b.rnd;
  const tint = (k) => jit(k, 0.18, rnd);
  const lens = (z) => 3 + (z - FOREST.zMin) * 0.5; // el con de visió des de la porta s'obre amb la distància
  for (let i = 0; i < FOREST.trees; i++) {
    const near = i < FOREST.trees * 0.3;
    const z = near ? FOREST.zMin + rnd() * 9 : FOREST.zMin + 4 + rnd() * (FOREST.zMax - FOREST.zMin - 4);
    const spread = Math.min(FOREST.xHalf, lens(z) + (near ? 0 : (z - FOREST.zMin) * 0.55));
    const x = (rnd() * 2 - 1) * spread;
    const kind = rnd();
    if (kind < 0.8) { // pi
      const h = 6 + rnd() * 6; const r = 0.16 + rnd() * 0.16;
      b.add('bark', new THREE.CylinderGeometry(r * 0.7, r, h * 0.55, 6), x, h * 0.275, z, { tint: tint(0x6a5a50) });
      const layers = 4;
      for (let k = 0; k < layers; k++) {
        const f = k / (layers - 1);
        const rad = (1.9 - f * 1.3) * (0.8 + rnd() * 0.4) * (h / 9);
        const ch = (h * 0.34) * (1 - f * 0.25);
        b.add('pine', new THREE.ConeGeometry(rad, ch, 7), x + (rnd() - 0.5) * 0.15, h * 0.28 + f * h * 0.55, z + (rnd() - 0.5) * 0.15, { tint: tint(0x6a7a72), rotY: rnd() * 6 });
      }
    } else { // arbre mort: tronc fosc amb 4–6 branques nues
      const h = 4 + rnd() * 3; const r = 0.12 + rnd() * 0.1;
      addLimb(b, 'bark', [x, 0, z], [x + (rnd() - 0.5) * 0.4, h, z + (rnd() - 0.5) * 0.4], r, r * 0.4, 6, tint(0x4a4038));
      const nb = 4 + Math.floor(rnd() * 3);
      for (let k = 0; k < nb; k++) {
        const y0 = h * (0.35 + 0.6 * (k / nb)); const a = rnd() * Math.PI * 2; const L = 1.0 + rnd() * 1.4;
        addLimb(b, 'bark', [x, y0, z], [x + Math.cos(a) * L, y0 + L * (0.4 + rnd() * 0.5), z + Math.sin(a) * L], r * 0.45, r * 0.12, 5, tint(0x4a4038));
      }
    }
  }
  // Mates baixes (cons aplanats) i falgueres (dues cartes creuades amb alpha-test)
  for (let i = 0; i < 40; i++) {
    const z = FOREST.zMin + rnd() * 14; const x = (rnd() * 2 - 1) * (lens(z) + 2);
    b.add('pine', new THREE.ConeGeometry(0.5 + rnd() * 0.5, 0.7 + rnd() * 0.6, 6), x, 0.4, z, { tint: tint(0x55655e) });
  }
  for (let i = 0; i < 50; i++) {
    const z = FOREST.zMin - 0.5 + rnd() * 9; const x = (rnd() * 2 - 1) * (lens(z) + 1);
    const sz = 0.7 + rnd() * 0.7;
    b.add('grass', new THREE.PlaneGeometry(sz, sz), x, sz / 2, z, { tint: tint(0x4a5a46), rotY: rnd() * 3 });
    b.add('grass', new THREE.PlaneGeometry(sz, sz), x, sz / 2, z, { tint: tint(0x4a5a46), rotY: rnd() * 3 + Math.PI / 2 });
  }
  b.finish();
  // Boires baixes: uns pocs sprites grans, grisos i molt translúcids
  const mist = [];
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Sprite(mats.mist);
    const z = FOREST.zMin + 1 + i * 3.6; const x = (i % 2 ? -1 : 1) * (1 + (i % 3) * 2.2);
    sp.scale.set(12 + (i % 3) * 3, 3.4, 1);
    sp.position.set(x, 1.4 + (i % 2) * 0.6, z);
    g.add(sp);
    mist.push(sp);
  }
  parent.add(g);
  return g;
}


// ---------------------------------------------------------------------
// TERANYINES (Fase C.2): una sola malla fusionada per a totes (COBWEBS de layout.js). Decals plans enganxats a parets, sostre i mobles.
// ---------------------------------------------------------------------
const WEB_TINTS = [0xcfcfc8, 0xbdbdb6, 0xd6d3c8, 0xc4c4bc]; // gris polsós, mai blanc
function webQuadGeometry(q, variant, flip) {
  const off = 0.012;
  const [ox, oy, oz] = q.o;
  const P = (i, j) => [
    ox + q.a[0] * q.sa * i + q.b[0] * q.sb * j + q.n[0] * off,
    oy + q.a[1] * q.sa * i + q.b[1] * q.sb * j + q.n[1] * off,
    oz + q.a[2] * q.sa * i + q.b[2] * q.sb * j + q.n[2] * off,
  ];
  const c = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
  const u0 = (variant * WEB_CELL + 0.5) / (WEB_CELL * 3); const u1 = (variant * WEB_CELL + WEB_CELL - 0.5) / (WEB_CELL * 3);
  const [ua, ub] = flip ? [u1, u0] : [u0, u1];
  const uv = [ua, 0, ub, 0, ub, 1, ua, 1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(c.flat(), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([...q.n, ...q.n, ...q.n, ...q.n], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
function buildCobwebs(mats, parent) {
  const g = makeGroup('Cobwebs');
  const b = new Builder(g, mats, 7900);
  COBWEBS.forEach((w, i) => {
    for (const q of w.quads) b.add('web', webQuadGeometry(q, w.variant, w.flip), 0, 0, 0, { tint: WEB_TINTS[i % WEB_TINTS.length] });
  });
  b.finish();
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------------
// LLUMS D'INTERIOR (Fase C): UNA llum puntual càlida per estança (4 en total) + flames emissives i halos als ciris.
// ---------------------------------------------------------------------
function buildInteriorLights(parent) {
  const lights = [];
  for (const L of INTERIOR_LIGHTS) {
    const light = new THREE.PointLight(0xffb468, L.intensity, L.distance, 2);
    light.position.set(L.x, L.y, L.z);
    light.name = L.id;
    parent.add(light);
    lights.push(light);
  }
  return lights;
}

// ---------------------------------------------------------------------
// PORTES (taula DOORS: visuals, tancades, sense obertura de col·lisió)
// ---------------------------------------------------------------------
const DOOR = { slab: 0.08, jamb: 0.12, archFrame: 0.05, archLeaf: 0.10, archMargin: 0.25 };

function assertDoorOnFace(door, fp) {
  const c = door.center; const f = door.face;
  const onFace =
    f === 'south' ? Math.abs(c.z - fp.zMax) < EPS && c.x >= fp.xMin && c.x <= fp.xMax
    : f === 'north' ? Math.abs(c.z - fp.zMin) < EPS && c.x >= fp.xMin && c.x <= fp.xMax
    : f === 'east' ? Math.abs(c.x - fp.xMax) < EPS && c.z >= fp.zMin && c.z <= fp.zMax
    : f === 'west' ? Math.abs(c.x - fp.xMin) < EPS && c.z >= fp.zMin && c.z <= fp.zMax
    : false;
  if (!onFace) fail(`${door.id}: el centre de la porta no és sobre la cara '${f}' de ${door.buildingId}`);
}

// Porta d'arc OBERTA (D1): el pas queda lliure (l'amplada exacta de la porta del layout).
// Marc de pedra per fora, bastiment de fusta per dins i les dues fulles obertes del tot,
// planes contra la cara interior de la façana, FORA del pas (de 1,1 m cap a fora a cada costat).
function addOpenArchDoor(b, door, building) {
  const r = door.width / 2;
  const straight = door.height - r;
  const t = wallThickness(building, door.face);
  const ring = archRingGeometry(r, r + DOOR.archMargin, straight, DOOR.archFrame + 0.03);
  scaleUV(ring, 1 / TILE.stone);
  b.add('stone', ring, 0, 0, 0, { tint: 0xe2e4ea });                                                       // marc de pedra
  b.box('stone', { xMin: -0.2, xMax: 0.2, yMin: straight + r + 0.02, yMax: straight + r + 0.32, zMin: 0, zMax: DOOR.archFrame + 0.06 }, 0xd8dae2); // clau de l'arc
  const arch = archRingGeometry(r, r + 0.14, straight, 0.05);
  scaleUV(arch, 1 / TILE.wood);
  b.add('wood', arch, 0, 0, -t - 0.05, { tint: 0x6a5a4e });                                                // bastiment de fusta (cara interior)
  // Les dues fulles NO es dibuixen aquí: són peces mòbils (pivots) creades per addSwingLeaves().
}

// ---------------------------------------------------------------------
// FULLES DE LA PORTA D1 (peces mòbils: cada fulla és un grup que gira sobre la seva frontissa)
// ---------------------------------------------------------------------
// Fulla de roure fosc: 5 taulons verticals retallats a la corba de l'arc, 3 frontisses de
// ferro amb la seva anella, reforç vertical al cantell que tanca, claus i una anella per
// estirar. Coordenades locals: la frontissa és a l'origen i la fulla s'estén cap a `sx`
// (+X per a l'oest, −X per a l'est); la fulla oberta lliure gira amb el pivot.
// Cost: ~620 triangles per fulla, 2 malles (fusta + ferro).
const LEAF = { planks: 5, plankGap: 0.0, strapY: [0.55, 1.45, 2.3], strapH: 0.11, nailU: [0.2, 0.42, 0.64] };

function buildDoorLeaf(mats, door, side, seed) {
  const sw = door.swing;
  const r = door.width / 2;
  const straight = door.height - r;
  const g = makeGroup(`${door.id}-leaf-${side < 0 ? 'W' : 'E'}`, door.id);
  g.userData.dynamic = true; // matriu viva: gira amb les col·lisions
  const b = new Builder(g, mats, seed);
  const rnd = b.rnd;
  const sx = -side;                 // sentit de la fulla respecte de l'eix X local (oest: +1)
  const L = sw.leafLength; const T = sw.leafThickness; const A = sw.hingeX; // A = radi de l'arc exterior de la fulla
  const topAt = (u) => straight + Math.sqrt(Math.max(0, A * A - (A - u) * (A - u))); // vora alta: segueix l'arc
  const iron = () => jit(rnd() < 0.15 ? 0x3b2c26 : 0x2c2a30, 0.14, rnd);             // ferro fosc, algun toc d'òxid
  const zf = T / 2 + 0.012;         // els ferros sobresurten 1,2 cm de cada cara

  // Taulons
  const wp = L / LEAF.planks;
  for (let k = 0; k < LEAF.planks; k++) {
    const u0 = k * wp; const u1 = (k + 1) * wp - LEAF.plankGap;
    const Tk = T * (0.93 + rnd() * 0.07);
    const s = new THREE.Shape();
    s.moveTo(sx * u0, 0); s.lineTo(sx * u1, 0); s.lineTo(sx * u1, topAt(u1)); s.lineTo(sx * u0, topAt(u0));
    const geo = new THREE.ExtrudeGeometry(s, { depth: Tk, bevelEnabled: false });
    const uv = geo.attributes.uv; const vOff = rnd();
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (sx * uv.getX(i) - u0) / 0.3, uv.getY(i) / 1.2 + vOff); // 1 taulo ≈ 8 px d'ample
    b.add('doorOak', geo, 0, 0, -Tk / 2 + (rnd() - 0.5) * 0.006, { tint: jit(0xe6dacd, 0.09, rnd) });
  }

  const ironBox = (u0, u1, y0, y1, z) => b.box('plainD', {
    xMin: Math.min(sx * u0, sx * u1), xMax: Math.max(sx * u0, sx * u1), yMin: y0, yMax: y1, zMin: -z, zMax: z,
  }, iron());

  // Frontisses de ferro: tira llarga + cua + manilló a la frontissa + claus.
  for (const y of LEAF.strapY) {
    const uEnd = L * 0.78;
    ironBox(0, uEnd, y - LEAF.strapH / 2, y + LEAF.strapH / 2, zf);
    ironBox(uEnd, uEnd + 0.07, y - LEAF.strapH * 0.8, y + LEAF.strapH * 0.8, zf);
    b.add('plainD', new THREE.CylinderGeometry(0.03, 0.03, LEAF.strapH * 1.5, 6, 1), 0, y, 0, { tint: iron() });
    for (const u of LEAF.nailU) {
      b.box('plainD', { xMin: sx * u - 0.018, xMax: sx * u + 0.018, yMin: y - 0.018, yMax: y + 0.018, zMin: -(zf + 0.01), zMax: zf + 0.01 }, iron());
    }
  }
  // Reforç vertical del cantell que tanca (la junta del mig) amb una filera de claus.
  ironBox(L - 0.07, L, 0.05, topAt(L) - 0.18, zf - 0.004);
  for (let y = 0.4; y < 2.9; y += 0.5) {
    b.box('plainD', { xMin: sx * (L - 0.035) - 0.02, xMax: sx * (L - 0.035) + 0.02, yMin: y - 0.02, yMax: y + 0.02, zMin: -(zf + 0.012), zMax: zf + 0.012 }, iron());
  }
  // Anella per estirar, a cada cara, amb la seva placa.
  for (const face of [-1, 1]) {
    b.box('plainD', { xMin: sx * (L - 0.24) - 0.04, xMax: sx * (L - 0.24) + 0.04, yMin: 1.11, yMax: 1.19, zMin: face * (T / 2 + 0.004) - 0.01, zMax: face * (T / 2 + 0.004) + 0.01 }, iron());
    b.add('plainD', new THREE.TorusGeometry(0.06, 0.011, 5, 10), sx * (L - 0.24), 1.1, face * (T / 2 + 0.03), { tint: iron() });
  }
  b.finish();
  return g;
}

// Crea les dues fulles de D1 i retorna el control visual (angles → rotació dels pivots).
// Els angles són els de la física (doors.js): 0 = tancada, creixen cap a dins de la nau.
function addSwingLeaves(g, mats, door, seed) {
  const sw = door.swing;
  if (door.face !== 'south') fail(`${door.id}: la porta amb fulles només admet la cara sud`);
  const pivots = [-1, 1].map((side, i) => {
    const pivot = buildDoorLeaf(mats, door, side, seed + i);
    pivot.position.set(door.center.x + side * sw.hingeX, 0, sw.hingeZ); // el grup D1 no té transformació: món directe
    g.add(pivot);
    return pivot;
  });
  let west = NaN; let east = NaN;
  const handle = {
    id: door.id,
    pivots,
    // Posa els angles (radians). Només toca les matrius si han canviat.
    setAngles(w, e) {
      if (w === west && e === east) return false;
      west = w; east = e;
      pivots[0].rotation.y = w;     // fulla oest: s'estén cap a +X, gira cap a −Z
      pivots[1].rotation.y = -e;    // fulla est: s'estén cap a −X, gira cap a −Z
      return true;
    },
  };
  handle.setAngles((sw.initialAngleDeg * Math.PI) / 180, (sw.initialAngleDeg * Math.PI) / 180);
  return handle;
}

// Porta de casa d'UNA fulla (Fase C): bastiment de pedra per fora, llinda de fusta per dins i una fulla de taulons de roure
// que comença TANCADA, recolzada a la cara interior del pas i que gira sobre una frontissa vertical (peça mòbil).
// L'eix de gir, el costat de la frontissa i el sentit són els de la física (src/player/houseDoors.js), un per a cada casa.
// Retorna { swing, setAngle(radians amb signe: + cap a dins, − cap a fora) }.
function addHouseDoor(b, door, building, g, mats, seed) {
  const hw = door.width / 2; const lw = door.lintelWidth / 2;
  const t = wallThickness(building, door.face);
  const top = door.height;
  // Bastiment de pedra exterior i llindar. Cap peça comparteix cara coplanar amb una altra del mateix sentit.
  b.box('stone', { xMin: -lw, xMax: -hw, yMin: 0, yMax: top, zMin: 0, zMax: DOOR.jamb }, 0xe0dccf);
  b.box('stone', { xMin: hw, xMax: lw, yMin: 0, yMax: top, zMin: 0, zMax: DOOR.jamb }, 0xe0dccf);
  b.box('stone', { xMin: -lw, xMax: lw, yMin: top, yMax: top + 0.2, zMin: 0, zMax: DOOR.jamb + 0.02 }, 0xd4cfc0);
  b.box('stone', { xMin: -hw, xMax: hw, yMin: 0, yMax: 0.04, zMin: -t, zMax: 0.14 }, 0xcfcabb);
  // Llinda de fusta a la cara interior (no hi ha muntants de fusta: la fulla en gira al costat)
  b.box('wood', { xMin: -hw - 0.07, xMax: hw + 0.07, yMin: top, yMax: top + 0.08, zMin: -t - 0.06, zMax: -t }, TIMBER);
  // Fulla mòbil
  const geo = houseDoorGeometry(door);
  const theta = Math.atan2(-geo.closedDir.z, geo.closedDir.x);
  const outer = makeGroup(`${door.id}-hinge`, door.id);
  outer.position.set(geo.hinge.x, 0, geo.hinge.z);
  outer.rotation.y = theta;
  const swing = markDynamic(makeGroup(`${door.id}-leaf`, door.id));
  outer.add(swing);
  const lb = new Builder(swing, mats, seed);
  const L = geo.leafLength; const H = door.height - 0.06; const y0 = 0.04; const T = 0.04; // semigruix
  const planks = 5; const pw = L / planks;
  for (let i = 0; i < planks; i++) {
    lb.box('doorOak', { xMin: i * pw, xMax: (i + 1) * pw - 0.004, yMin: y0, yMax: y0 + H, zMin: -T, zMax: T }, 0xffffff);
  }
  for (const y of [0.4, H - 0.4]) { // travessers i frontisses de ferro a la cara que mira l'estança... i a l'altra
    lb.box('plainD', { xMin: 0.02, xMax: L * 0.92, yMin: y, yMax: y + 0.11, zMin: -T - 0.012, zMax: T + 0.012 }, 0x2a282e);
  }
  lb.box('plainD', { xMin: L - 0.2, xMax: L - 0.08, yMin: 0.95, yMax: 1.07, zMin: T + 0.012, zMax: T + 0.05 }, 0x2a282e);   // anella (cara A)
  lb.box('plainD', { xMin: L - 0.2, xMax: L - 0.08, yMin: 0.95, yMax: 1.07, zMin: -T - 0.05, zMax: -T - 0.012 }, 0x2a282e); // anella (cara B)
  lb.finish();
  g.add(outer);
  // Sentit del gir: z local de la frontissa (món) i quin costat és "cap a dins" (−normal de la cara).
  const zlx = Math.sin(theta); const zlz = Math.cos(theta);
  const si = Math.sign(-geo.n.x * zlx + -geo.n.z * zlz) || 1;
  let last = NaN;
  return {
    id: door.id, swing, outer,
    setAngle(signed) {
      if (signed === last) return false;
      last = signed;
      swing.rotation.y = -si * signed;
      return true;
    },
  };
}

function buildDoors(mats, parent, handles) {
  const group = makeGroup('Doors');
  DOORS.forEach((door, i) => {
    const building = BUILDINGS.find((x) => x.id === door.buildingId);
    if (!building) fail(`${door.id}: l'edifici '${door.buildingId}' no existeix`);
    const fp = building.visual.footprint;
    assertDoorOnFace(door, fp);
    const along = (door.face === 'south' || door.face === 'north') ? door.center.x : door.center.z;
    const g = makeGroup(door.id, door.id);
    const b = new Builder(g, mats, 4000 + i);
    // La cara sud del campanar no s'usa per a portes; la porta sempre és al pla de la cara.
    b.setFrame(faceFrame(fp, door.face, along));

    if (door.house) {
      handles[door.id] = addHouseDoor(b, door, building, g, mats, 4200 + i);
    } else if (door.style === 'arch' && door.state === 'open') {
      addOpenArchDoor(b, door, building);
    } else if (door.style === 'arch') {
      const straight = door.height - door.width / 2;
      const frame = archGeometry(door.width + 2 * DOOR.archMargin, straight, DOOR.archFrame);
      scaleUV(frame, 1 / TILE.stone);
      b.add('stone', frame, 0, 0, 0, { tint: 0xe2e4ea });
      const leaf = archGeometry(door.width, straight, DOOR.archLeaf);
      scaleUV(leaf, 1 / TILE.wood);
      b.add('wood', leaf, 0, 0, DOOR.archFrame, { tint: 0xa89888 });
      const zf = DOOR.archFrame + DOOR.archLeaf;
      for (const y of [0.8, 2.3]) {
        b.box('plainD', { xMin: -door.width / 2 + 0.05, xMax: door.width / 2 - 0.05, yMin: y, yMax: y + 0.1, zMin: zf, zMax: zf + 0.02 }, 0x2a282e);
      }
      for (const x of [-0.3, 0.3]) b.box('plainD', { xMin: x - 0.07, xMax: x + 0.07, yMin: 1.3, yMax: 1.44, zMin: zf, zMax: zf + 0.04 }, 0x2a282e);
    } else if (door.style === 'plank' && door.state === 'open') {
      // Porta de casa OBERTA (Fase B): muntants i llinda de pedra, llindar a ras de terra i la fulla de fusta
      // recolzada contra la cara INTERIOR de la paret (a 7 cm), al costat del pas, fora del camí del jugador.
      const hw = door.width / 2; const lw = door.lintelWidth / 2;
      const t = wallThickness(building, door.face);
      const top = door.height;
      b.box('stone', { xMin: -lw, xMax: -hw, yMin: 0, yMax: top, zMin: 0, zMax: DOOR.jamb }, 0xe0dccf);
      b.box('stone', { xMin: hw, xMax: lw, yMin: 0, yMax: top, zMin: 0, zMax: DOOR.jamb }, 0xe0dccf);
      b.box('stone', { xMin: -lw, xMax: lw, yMin: top, yMax: top + 0.2, zMin: 0, zMax: DOOR.jamb + 0.02 }, 0xd4cfc0);
      b.box('stone', { xMin: -hw, xMax: hw, yMin: 0, yMax: 0.04, zMin: -t, zMax: 0.14 }, 0xcfcabb);                      // llindar
      const x0 = hw + 0.02; const x1 = x0 + door.width - 0.08;                                                        // fulla: al costat +X local
      const z0 = -t - 0.07; const z1 = -t - 0.01;
      b.box('wood', { xMin: x0, xMax: x1, yMin: 0.04, yMax: door.height - 0.08, zMin: z0, zMax: z1 }, 0x8a7868);
      for (const y of [0.4, door.height - 0.5]) b.box('plainD', { xMin: x0, xMax: x1, yMin: y, yMax: y + 0.08, zMin: z0 - 0.02, zMax: z0 }, 0x2a282e);
      b.box('plainD', { xMin: x1 - 0.14, xMax: x1 - 0.02, yMin: 0.95, yMax: 1.07, zMin: z0 - 0.04, zMax: z0 }, 0x2a282e);  // anella
    } else if (door.style === 'plank') {
      const hw = door.width / 2; const lw = door.lintelWidth / 2;
      let th = 0;
      if (door.steps) {
        const s = door.steps;
        th = s.count * s.riseEach;
        for (let k = 0; k < s.count; k++) {
          b.box('stone', {
            xMin: -s.width / 2, xMax: s.width / 2, yMin: 0, yMax: s.riseEach * (s.count - k),
            zMin: k * s.depth, zMax: (k + 1) * s.depth,
          }, jit(0xcfcabb, 0.08, b.rnd));
        }
      }
      const top = th + door.height;
      b.box('wood', { xMin: -hw, xMax: hw, yMin: th, yMax: top, zMin: 0, zMax: DOOR.slab }, 0xa89888);
      b.box('stone', { xMin: -lw, xMax: -hw, yMin: th, yMax: top, zMin: 0, zMax: DOOR.jamb }, 0xe0dccf);
      b.box('stone', { xMin: hw, xMax: lw, yMin: th, yMax: top, zMin: 0, zMax: DOOR.jamb }, 0xe0dccf);
      b.box('stone', { xMin: -lw, xMax: lw, yMin: top, yMax: top + 0.2, zMin: 0, zMax: DOOR.jamb + 0.02 }, 0xd4cfc0);
      for (const y of [th + 0.4, th + door.height - 0.5]) {
        b.box('plainD', { xMin: -hw, xMax: hw, yMin: y, yMax: y + 0.08, zMin: DOOR.slab, zMax: DOOR.slab + 0.02 }, 0x2a282e);
      }
      b.box('plainD', { xMin: 0.22, xMax: 0.34, yMin: th + 0.95, yMax: th + 1.07, zMin: DOOR.slab, zMax: DOOR.slab + 0.04 }, 0x2a282e); // anella
    } else {
      fail(`${door.id}: estil de porta desconegut '${door.style}'`);
    }
    b.setFrame(null);
    b.finish();
    group.add(g);
    if (door.swing) handles[door.id] = addSwingLeaves(g, mats, door, 4100 + 2 * i); // fulles mòbils (només D1)
  });
  parent.add(group);
}

// ---------------------------------------------------------------------
// INTERIORS (Fase B): mobles, altar, espelmes, porta secreta i claus
// ---------------------------------------------------------------------
const WOOD_D = 0x6a5646;   // fusta fosca
const WOOD_L = 0x7e6a58;   // fusta una mica més clara (taules, calaixos)
const STONE_D = 0x8c909c;  // pedra envellida
const IRON_D = 0x2a282e;
const CLOTH = 0x5a2a32;    // tela vermella apagada
const KEY_COLOR = { bronze: 0x9a7440, iron: 0x5a5e6a };

function markDynamic(g) { g.userData.dynamic = true; return g; }

function candle(b, x, y, z, flames, h = 0.16) {
  b.add('plain', new THREE.CylinderGeometry(0.028, 0.032, h, 6), x, y + h / 2, z, { tint: 0xd8cdb4 });
  b.add('flame', new THREE.ConeGeometry(0.018, 0.06, 5), x, y + h + 0.03, z);
  flames.push([x, y + h + 0.05, z]);
}

// Silueta d'una campana (gravat) i d'una lluna creixent: formes 2D extrudides molt poc.
function bellShape(k = 1) {
  const s = new THREE.Shape();
  s.moveTo(-0.08 * k, 0); s.lineTo(0.08 * k, 0); s.lineTo(0.06 * k, 0.05 * k);
  s.quadraticCurveTo(0.05 * k, 0.12 * k, 0, 0.14 * k);
  s.quadraticCurveTo(-0.05 * k, 0.12 * k, -0.06 * k, 0.05 * k);
  s.lineTo(-0.08 * k, 0);
  return s;
}
function moonShape(k = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.09 * k);
  s.absarc(0, 0, 0.09 * k, Math.PI / 2, (3 * Math.PI) / 2, false);
  s.quadraticCurveTo(-0.06 * k, 0, 0, 0.09 * k);
  return s;
}
const glyph = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });

// Clau (llargada ≈ 0,19 m). `orient` 'flat' = jeu sobre una superfície (arbre al llarg de X);
// 'slot' = inserida a la paret (arbre al llarg de −Z, l'anella cap a la nau).
function buildKeyMesh(mats, def, orient, seed) {
  const g = makeGroup(`${def.id}-${orient}`, def.id);
  const inner = makeGroup(`${def.id}-${orient}-mesh`, def.id);
  g.add(inner);
  const b = new Builder(inner, mats, seed);
  const tint = KEY_COLOR[def.material];
  b.add('plain', new THREE.TorusGeometry(0.03, 0.009, 5, 10), -0.1, 0, 0, { tint });
  b.box('plain', { xMin: -0.07, xMax: 0.09, yMin: -0.007, yMax: 0.007, zMin: -0.007, zMax: 0.007 }, tint);
  b.box('plain', { xMin: 0.06, xMax: 0.075, yMin: -0.03, yMax: 0.007, zMin: -0.006, zMax: 0.006 }, tint);
  b.box('plain', { xMin: 0.08, xMax: 0.09, yMin: -0.022, yMax: 0.007, zMin: -0.006, zMax: 0.006 }, tint);
  // Símbol gravat a l'anella: campana (guardià) o lluna (oblidats).
  const sym = def.symbol === 'bell' ? bellShape(0.28) : moonShape(0.3);
  b.add('plain', glyph(sym, 0.004), -0.1, def.symbol === 'bell' ? -0.015 : 0, 0.0, { tint: shade(tint, 0.55) });
  b.finish();
  // 'flat': el pla de la clau (XY) es posa horitzontal; 'slot': l'arbre apunta a −Z (cap a dins de la paret).
  if (orient === 'flat') inner.rotation.x = -Math.PI / 2; else g.rotation.y = Math.PI / 2;
  return g;
}

function furnitureBody(b, item) {
  const f = item.visual.footprint; const h = item.visual.height;
  const { xMin, xMax, zMin, zMax } = f;
  const cx = (xMin + xMax) / 2; const cz = (zMin + zMax) / 2;
  const handles = {};
  switch (item.type) {
    case 'pew': { // mira al nord (−Z): respatller a la banda sud
      b.box('wood', { xMin, xMax, yMin: 0.4, yMax: 0.46, zMin: zMin + 0.04, zMax: zMax - 0.07 }, WOOD_D);
      b.box('wood', { xMin, xMax, yMin: 0.46, yMax: h, zMin: zMax - 0.07, zMax }, shade(WOOD_D, 0.9));
      b.box('wood', { xMin, xMax, yMin: h, yMax: h + 0.04, zMin: zMax - 0.09, zMax: zMax + 0.01 }, WOOD_L);
      for (const x0 of [xMin, xMax - 0.08]) b.box('wood', { xMin: x0, xMax: x0 + 0.08, yMin: 0, yMax: h - 0.05, zMin, zMax }, shade(WOOD_D, 0.85));
      b.box('wood', { xMin: xMin + 0.08, xMax: xMax - 0.08, yMin: 0.08, yMax: 0.12, zMin: zMin + 0.1, zMax: zMin + 0.16 }, WOOD_D); // travesser baix
      break;
    }
    case 'altar': {
      b.box('stone', { xMin: xMin - 0.06, xMax: xMax + 0.06, yMin: 0, yMax: 0.14, zMin: zMin - 0.06, zMax: zMax + 0.06 }, shade(STONE_D, 0.9));
      b.box('stone', { xMin, xMax, yMin: 0.14, yMax: h - 0.1, zMin, zMax }, STONE_D);
      b.box('stone', { xMin: xMin - 0.07, xMax: xMax + 0.07, yMin: h - 0.1, yMax: h, zMin: zMin - 0.07, zMax: zMax + 0.07 }, 0xa4a8b4);
      for (const x of [-0.5, 0, 0.5]) b.add('glass', gothicGeometry(0.3, 0.4, 0.14, 0.02), x, 0.26, zMax + 0.001, { tint: 0x12141c }); // arcuacions fosques a la cara de la nau
      b.box('wood', { xMin: -0.6, xMax: 0.6, yMin: h, yMax: h + 0.012, zMin: zMin + 0.1, zMax: zMax - 0.1 }, CLOTH);   // mantell
      // Creu discreta sobre l'altar (ferro) i dues espelmes.
      b.box('plainD', { xMin: -0.02, xMax: 0.02, yMin: h + 0.012, yMax: h + 0.46, zMin: cz - 0.02, zMax: cz + 0.02 }, IRON_D);
      b.box('plainD', { xMin: -0.13, xMax: 0.13, yMin: h + 0.3, yMax: h + 0.34, zMin: cz - 0.02, zMax: cz + 0.02 }, IRON_D);
      break;
    }
    case 'dresser': { // còmoda amb calaix (la clau A): el calaix de dalt és una peça mòbil
      b.box('wood', { xMin, xMax, yMin: 0.06, yMax: 0.9, zMin, zMax }, WOOD_D);
      b.box('wood', { xMin: xMin - 0.02, xMax: xMax + 0.02, yMin: 0.9, yMax: h, zMin: zMin - 0.01, zMax: zMax + 0.03 }, WOOD_L);
      for (const x of [xMin + 0.03, xMax - 0.09]) b.box('wood', { xMin: x, xMax: x + 0.06, yMin: 0, yMax: 0.06, zMin: zMin + 0.03, zMax: zMin + 0.09 }, WOOD_D);
      for (const [y0, y1] of [[0.34, 0.6], [0.06, 0.32]]) { // dos calaixos tancats
        b.box('wood', { xMin: xMin + 0.06, xMax: xMax - 0.06, yMin: y0, yMax: y1, zMin: zMax, zMax: zMax + 0.025 }, shade(WOOD_L, 0.92));
        b.box('plainD', { xMin: cx - 0.04, xMax: cx + 0.04, yMin: (y0 + y1) / 2 - 0.02, yMax: (y0 + y1) / 2 + 0.02, zMin: zMax + 0.025, zMax: zMax + 0.05 }, IRON_D);
      }
      break;
    }
    case 'cabinet': { // armari baix de dues portes (la cara que mira `faces`)
      b.box('wood', { xMin, xMax, yMin: 0.05, yMax: h, zMin, zMax }, WOOD_D);
      b.box('wood', { xMin: xMin - 0.02, xMax: xMax + 0.02, yMin: h, yMax: h + 0.04, zMin: zMin - 0.02, zMax: zMax + 0.02 }, WOOD_L);
      b.box('wood', { xMin: xMin + 0.03, xMax: xMax - 0.03, yMin: 0, yMax: 0.05, zMin: zMin + 0.03, zMax: zMax - 0.03 }, WOOD_D);
      break; // les portes es dibuixen a continuació, segons `faces`
    }
    case 'table': {
      b.box('wood', { xMin, xMax, yMin: h - 0.06, yMax: h, zMin, zMax }, WOOD_L);
      for (const x of [xMin + 0.05, xMax - 0.1]) for (const z of [zMin + 0.05, zMax - 0.1]) b.box('wood', { xMin: x, xMax: x + 0.05, yMin: 0, yMax: h - 0.06, zMin: z, zMax: z + 0.05 }, WOOD_D);
      break;
    }
    case 'crate': {
      b.box('wood', { xMin, xMax, yMin: 0, yMax: h, zMin, zMax }, shade(WOOD_L, 0.9));
      for (const y of [0.12, h - 0.12]) b.box('plainD', { xMin: xMin - 0.012, xMax: xMax + 0.012, yMin: y, yMax: y + 0.06, zMin: zMin - 0.012, zMax: zMax + 0.012 }, IRON_D);
      break;
    }
    case 'bed': { // llit al llarg de X, capçal a l'oest, contra la paret nord
      b.box('wood', { xMin, xMax, yMin: 0.18, yMax: 0.3, zMin, zMax }, WOOD_D);
      for (const x of [xMin, xMax - 0.08]) for (const z of [zMin, zMax - 0.08]) b.box('wood', { xMin: x, xMax: x + 0.08, yMin: 0, yMax: 0.18, zMin: z, zMax: z + 0.08 }, shade(WOOD_D, 0.85));
      b.box('wood', { xMin: xMin + 0.04, xMax: xMax - 0.04, yMin: 0.3, yMax: 0.42, zMin: zMin + 0.04, zMax: zMax - 0.04 }, 0x6e6458); // màrfega
      b.box('wood', { xMin: xMin + 0.3, xMax: xMax - 0.04, yMin: 0.42, yMax: 0.46, zMin: zMin + 0.04, zMax: zMax - 0.04 }, CLOTH);   // manta
      b.box('wood', { xMin: xMin + 0.06, xMax: xMin + 0.34, yMin: 0.42, yMax: 0.5, zMin: zMin + 0.12, zMax: zMax - 0.12 }, 0x8a8478); // coixí
      b.box('wood', { xMin, xMax: xMin + 0.07, yMin: 0.18, yMax: h + 0.35, zMin, zMax }, WOOD_D); // capçal
      break;
    }
    case 'chest': { // arca (la clau B): cos obert per dalt + tapa mòbil
      const hy = 0.4; // alçada de les parets
      b.box('wood', { xMin, xMax, yMin: 0, yMax: 0.06, zMin, zMax }, WOOD_D);
      b.box('wood', { xMin, xMax: xMin + 0.05, yMin: 0.06, yMax: hy, zMin, zMax }, WOOD_D);
      b.box('wood', { xMin: xMax - 0.05, xMax, yMin: 0.06, yMax: hy, zMin, zMax }, WOOD_D);
      b.box('wood', { xMin: xMin + 0.05, xMax: xMax - 0.05, yMin: 0.06, yMax: hy, zMin, zMax: zMin + 0.05 }, WOOD_D);
      b.box('wood', { xMin: xMin + 0.05, xMax: xMax - 0.05, yMin: 0.06, yMax: hy, zMin: zMax - 0.05, zMax }, WOOD_D);
      b.box('wood', { xMin: xMin + 0.05, xMax: xMax - 0.05, yMin: 0.06, yMax: 0.36, zMin: zMin + 0.05, zMax: zMax - 0.05 }, CLOTH); // manta (damunt hi jeu la clau)
      for (const z of [zMin + 0.2, zMax - 0.26]) b.box('plainD', { xMin: xMin - 0.012, xMax: xMax + 0.012, yMin: 0.06, yMax: hy + 0.012, zMin: z, zMax: z + 0.06 }, IRON_D);
      break;
    }
    default: fail(`${item.id}: tipus de moble desconegut '${item.type}'`);
  }
  return handles;
}


// ---------------------------------------------------------------------
// MOBLES NOUS (Fase C). Es dibuixen en un frame local amb el DAVANT cap a +Z (vegeu `framed`).
// ---------------------------------------------------------------------
const FRAMED_TYPES = ['coffer', 'shelf', 'store', 'chair', 'bench', 'dresser2', 'bed2', 'nightstand', 'wardrobe', 'cradle'];
const FACE_ROT = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };

// Dibuixa `item` amb el seu davant cap a `faces` (o `head` pel llit). `fn(b, R, h, rnd)` rep el rectangle local R i l'alçada h.
function framed(b, item, fn) {
  const f = item.visual.footprint;
  const w = f.xMax - f.xMin; const d = f.zMax - f.zMin;
  const dir = item.type === 'bed2' ? item.head : (item.faces || 'south');
  const swap = dir === 'east' || dir === 'west';
  const lw = swap ? d : w; const ld = swap ? w : d;
  const y = item.level === 1 ? FLOORS.slabs.find((q) => q.buildingId === item.buildingId).y : 0;
  b.setFrame({ x: (f.xMin + f.xMax) / 2, y, z: (f.zMin + f.zMax) / 2, rotY: FACE_ROT[dir] });
  fn(b, { xMin: -lw / 2, xMax: lw / 2, zMin: -ld / 2, zMax: ld / 2 }, item.visual.height);
  b.setFrame(null);
}

function jar(b, x, y, z, r, h, tint) {
  b.add('plain', new THREE.CylinderGeometry(r * 0.85, r, h, 7), x, y + h / 2, z, { tint });
  b.add('plain', new THREE.CylinderGeometry(r * 0.5, r * 0.85, h * 0.18, 7), x, y + h + h * 0.09, z, { tint: shade(tint, 0.8) });
}

function drawFramed(b, item) {
  const rnd = b.rnd;
  framed(b, item, (b, R, h) => {
    const { xMin, xMax, zMin, zMax } = R;
    const cx = (xMin + xMax) / 2;
    switch (item.type) {
      case 'coffer': { // arca de la família: cos, tapa bombada i dues bandes de ferro
        b.box('wood', { xMin, xMax, yMin: 0.05, yMax: h - 0.1, zMin, zMax }, WOOD_D);
        b.box('wood', { xMin: xMin - 0.02, xMax: xMax + 0.02, yMin: h - 0.1, yMax: h, zMin: zMin - 0.02, zMax: zMax + 0.02 }, WOOD_L);
        for (const x of [xMin + 0.06, xMax - 0.14]) b.box('plainD', { xMin: x, xMax: x + 0.08, yMin: 0.05, yMax: h + 0.005, zMin: zMin - 0.012, zMax: zMax + 0.012 }, IRON_D);
        b.box('plainD', { xMin: cx - 0.04, xMax: cx + 0.04, yMin: h - 0.28, yMax: h - 0.18, zMin: zMax + 0.012, zMax: zMax + 0.04 }, IRON_D); // pany
        for (const [x, z] of [[xMin, zMin], [xMax - 0.07, zMin], [xMin, zMax - 0.07], [xMax - 0.07, zMax - 0.07]]) b.box('wood', { xMin: x, xMax: x + 0.07, yMin: 0, yMax: 0.05, zMin: z, zMax: z + 0.07 }, shade(WOOD_D, 0.85));
        break;
      }
      case 'shelf': { // prestatgeria oberta (alta) o aparador baix amb portes (h < 1.2), amb gerros, bols i llibres
        const low = h < 1.2;
        if (low) {
          b.box('wood', { xMin, xMax, yMin: 0.06, yMax: h - 0.05, zMin, zMax }, WOOD_D);
          b.box('wood', { xMin: xMin - 0.02, xMax: xMax + 0.02, yMin: h - 0.05, yMax: h, zMin: zMin - 0.01, zMax: zMax + 0.03 }, WOOD_L);
          const n = Math.max(2, Math.round((xMax - xMin) / 0.5));
          const dw = (xMax - xMin - 0.08) / n;
          for (let i = 0; i < n; i++) {
            b.box('wood', { xMin: xMin + 0.04 + i * dw + 0.01, xMax: xMin + 0.04 + (i + 1) * dw - 0.01, yMin: 0.1, yMax: h - 0.1, zMin: zMax, zMax: zMax + 0.025 }, shade(WOOD_L, 0.92));
            b.box('plainD', { xMin: xMin + 0.04 + (i + 0.5) * dw - 0.02, xMax: xMin + 0.04 + (i + 0.5) * dw + 0.02, yMin: h * 0.5 - 0.03, yMax: h * 0.5 + 0.03, zMin: zMax + 0.025, zMax: zMax + 0.045 }, IRON_D);
          }
          jar(b, xMin + 0.18, h, cx * 0 + (zMin + zMax) / 2, 0.06, 0.16, 0x7a5a3a);
        } else {
          b.box('wood', { xMin, xMax, yMin: 0, yMax: h, zMin, zMax: zMin + 0.03 }, shade(WOOD_D, 0.85));
          for (const x of [xMin, xMax - 0.04]) b.box('wood', { xMin: x, xMax: x + 0.04, yMin: 0, yMax: h, zMin, zMax }, WOOD_D);
          const n = Math.max(3, Math.round(h / 0.45));
          for (let k = 0; k <= n; k++) {
            const y = k === 0 ? 0.06 : (h * k) / n;
            b.box('wood', { xMin: xMin + 0.04, xMax: xMax - 0.04, yMin: y - 0.02, yMax: y + 0.02, zMin, zMax }, WOOD_L);
            if (k === 0 || k === n) continue;
            let x = xMin + 0.15;
            while (x < xMax - 0.15) { // objectes sobre cada post
              const kind = rnd();
              if (kind < 0.4) jar(b, x, y + 0.02, (zMin + zMax) / 2, 0.05 + rnd() * 0.02, 0.13 + rnd() * 0.08, jit(0x6e5a44, 0.2, rnd));
              else if (kind < 0.7) b.add('plain', new THREE.CylinderGeometry(0.1, 0.06, 0.06, 8), x, y + 0.05, (zMin + zMax) / 2, { tint: 0x8a7a68 }); // bol
              else b.box('plainD', { xMin: x - 0.05, xMax: x + 0.05, yMin: y + 0.02, yMax: y + 0.02 + 0.1 + rnd() * 0.05, zMin: zMin + 0.06, zMax: zMax - 0.06 }, jit(0x5a3a30, 0.3, rnd)); // llibres
              x += 0.2 + rnd() * 0.12;
            }
          }
        }
        break;
      }
      case 'store': { // rebost: barrils, sacs i caixes dins del rectangle
        const barrel = (x, z, r, hh) => {
          b.add('wood', new THREE.CylinderGeometry(r, r * 0.92, hh, 9), x, hh / 2, z, { tint: WOOD_D });
          for (const y of [hh * 0.2, hh * 0.78]) b.add('plainD', new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.05, 9), x, y, z, { tint: IRON_D });
        };
        const w = xMax - xMin;
        barrel(xMin + 0.34, zMin + 0.34, 0.3, 1.0);
        barrel(xMin + 0.34, zMin + 0.95, 0.3, 0.85);
        barrel(xMax - 0.35, zMin + 0.4, 0.32, 1.1);
        b.box('wood', { xMin: xMax - 0.65, xMax: xMax - 0.05, yMin: 0, yMax: 0.5, zMin: zMin + 0.8, zMax: zMax - 0.05 }, shade(WOOD_L, 0.9)); // caixa
        b.add('plain', new THREE.BoxGeometry(0.5, 0.4, 0.34), xMin + w * 0.5, 0.2, zMax - 0.22, { tint: 0xb0a27a, rotY: 0.2 });   // sacs
        b.add('plain', new THREE.BoxGeometry(0.46, 0.34, 0.32), xMin + w * 0.5 + 0.12, 0.57, zMax - 0.22, { tint: 0xa89a74, rotY: -0.2 });
        break;
      }
      case 'chair': {
        const t0 = 0.045;
        b.box('wood', { xMin, xMax, yMin: 0.43, yMax: 0.47, zMin, zMax }, WOOD_L);
        for (const [x, z] of [[xMin, zMin], [xMax - t0, zMin], [xMin, zMax - t0], [xMax - t0, zMax - t0]]) b.box('wood', { xMin: x, xMax: x + t0, yMin: 0, yMax: 0.43, zMin: z, zMax: z + t0 }, WOOD_D);
        for (const x of [xMin, xMax - t0]) b.box('wood', { xMin: x, xMax: x + t0, yMin: 0.47, yMax: h, zMin, zMax: zMin + t0 }, WOOD_D); // muntants del respatller (a la banda de darrere)
        for (const [y0, y1] of [[0.6, 0.67], [0.78, 0.85]]) b.box('wood', { xMin: xMin + t0, xMax: xMax - t0, yMin: y0, yMax: y1, zMin, zMax: zMin + 0.03 }, WOOD_L);
        break;
      }
      case 'bench': {
        b.box('wood', { xMin, xMax, yMin: h - 0.05, yMax: h, zMin, zMax }, WOOD_L);
        for (const x of [xMin + 0.05, xMax - 0.1]) b.box('wood', { xMin: x, xMax: x + 0.05, yMin: 0, yMax: h - 0.05, zMin: zMin + 0.04, zMax: zMax - 0.04 }, WOOD_D);
        b.box('wood', { xMin: xMin + 0.1, xMax: xMax - 0.1, yMin: 0.14, yMax: 0.18, zMin: cx * 0 + (zMin + zMax) / 2 - 0.02, zMax: (zMin + zMax) / 2 + 0.02 }, WOOD_D);
        break;
      }
      case 'dresser2': { // calaixera: dues files de calaixos al davant (+Z)
        b.box('wood', { xMin, xMax, yMin: 0.06, yMax: h - 0.04, zMin, zMax }, WOOD_D);
        b.box('wood', { xMin: xMin - 0.02, xMax: xMax + 0.02, yMin: h - 0.04, yMax: h, zMin: zMin - 0.01, zMax: zMax + 0.03 }, WOOD_L);
        for (const x of [xMin + 0.03, xMax - 0.09]) for (const z of [zMin + 0.03, zMax - 0.09]) b.box('wood', { xMin: x, xMax: x + 0.06, yMin: 0, yMax: 0.06, zMin: z, zMax: z + 0.06 }, WOOD_D);
        const rows = h > 0.9 ? 3 : 2; const rowH = (h - 0.2) / rows;
        const cols = Math.max(1, Math.round((xMax - xMin) / 0.55)); const cw = (xMax - xMin - 0.1) / cols;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const x0 = xMin + 0.05 + c * cw + 0.01; const x1 = xMin + 0.05 + (c + 1) * cw - 0.01; const y0 = 0.1 + r * rowH + 0.01; const y1 = 0.1 + (r + 1) * rowH - 0.01;
          b.box('wood', { xMin: x0, xMax: x1, yMin: y0, yMax: y1, zMin: zMax, zMax: zMax + 0.025 }, shade(WOOD_L, 0.92));
          b.box('plainD', { xMin: (x0 + x1) / 2 - 0.035, xMax: (x0 + x1) / 2 + 0.035, yMin: (y0 + y1) / 2 - 0.015, yMax: (y0 + y1) / 2 + 0.015, zMin: zMax + 0.025, zMax: zMax + 0.045 }, IRON_D);
        }
        break;
      }
      case 'bed2': { // el CAPÇAL és cap a +Z (la paret)
        const hb = 0.75; // capçal (l'ampit de les finestres és a 0,8 m del terra del pis)
        b.box('wood', { xMin, xMax, yMin: 0.18, yMax: 0.3, zMin, zMax }, WOOD_D);
        for (const [x, z] of [[xMin, zMin], [xMax - 0.08, zMin], [xMin, zMax - 0.08], [xMax - 0.08, zMax - 0.08]]) b.box('wood', { xMin: x, xMax: x + 0.08, yMin: 0, yMax: 0.18, zMin: z, zMax: z + 0.08 }, shade(WOOD_D, 0.85));
        b.box('wood', { xMin: xMin + 0.04, xMax: xMax - 0.04, yMin: 0.3, yMax: 0.42, zMin: zMin + 0.04, zMax: zMax - 0.04 }, 0x6e6458);                  // màrfega
        b.box('wood', { xMin: xMin + 0.04, xMax: xMax - 0.04, yMin: 0.42, yMax: 0.46, zMin: zMin + 0.04, zMax: zMax - 0.6 }, CLOTH);                      // manta
        b.box('wood', { xMin: xMin + 0.2, xMax: xMax - 0.2, yMin: 0.42, yMax: 0.52, zMin: zMax - 0.5, zMax: zMax - 0.1 }, 0x8a8478);                       // coixí
        b.box('wood', { xMin, xMax, yMin: 0.18, yMax: hb, zMin: zMax - 0.07, zMax }, WOOD_D);                                                              // capçal
        b.box('wood', { xMin, xMax, yMin: 0.18, yMax: 0.4, zMin, zMax: zMin + 0.06 }, WOOD_D);                                                             // peu
        break;
      }
      case 'nightstand': {
        b.box('wood', { xMin, xMax, yMin: 0.08, yMax: h - 0.04, zMin, zMax }, WOOD_D);
        b.box('wood', { xMin: xMin - 0.02, xMax: xMax + 0.02, yMin: h - 0.04, yMax: h, zMin: zMin - 0.01, zMax: zMax + 0.02 }, WOOD_L);
        for (const x of [xMin + 0.02, xMax - 0.06]) for (const z of [zMin + 0.02, zMax - 0.06]) b.box('wood', { xMin: x, xMax: x + 0.04, yMin: 0, yMax: 0.08, zMin: z, zMax: z + 0.04 }, WOOD_D);
        b.box('wood', { xMin: xMin + 0.04, xMax: xMax - 0.04, yMin: 0.3, yMax: h - 0.08, zMin: zMax, zMax: zMax + 0.02 }, shade(WOOD_L, 0.92));
        b.box('plainD', { xMin: cx - 0.03, xMax: cx + 0.03, yMin: 0.4, yMax: 0.44, zMin: zMax + 0.02, zMax: zMax + 0.04 }, IRON_D);
        break;
      }
      case 'wardrobe': { // armari gran de dues portes amb cornisa
        b.box('wood', { xMin, xMax, yMin: 0.08, yMax: h - 0.08, zMin, zMax }, WOOD_D);
        b.box('wood', { xMin: xMin - 0.03, xMax: xMax + 0.03, yMin: h - 0.08, yMax: h, zMin: zMin - 0.02, zMax: zMax + 0.04 }, WOOD_L);
        b.box('wood', { xMin: xMin + 0.02, xMax: xMax - 0.02, yMin: 0, yMax: 0.08, zMin: zMin + 0.02, zMax: zMax - 0.02 }, WOOD_D);
        const mid = cx;
        for (const [a, c] of [[xMin + 0.05, mid - 0.01], [mid + 0.01, xMax - 0.05]]) {
          b.box('wood', { xMin: a, xMax: c, yMin: 0.14, yMax: h - 0.14, zMin: zMax, zMax: zMax + 0.025 }, shade(WOOD_L, 0.92));
          b.box('wood', { xMin: a + 0.08, xMax: c - 0.08, yMin: 0.3, yMax: h - 0.3, zMin: zMax + 0.025, zMax: zMax + 0.04 }, shade(WOOD_D, 1.1)); // plafó
        }
        for (const x of [mid - 0.08, mid + 0.08]) b.box('plainD', { xMin: x - 0.02, xMax: x + 0.02, yMin: 1.0, yMax: 1.14, zMin: zMax + 0.03, zMax: zMax + 0.06 }, IRON_D);
        break;
      }
      case 'cradle': { // bressol: llit petit amb balancins
        b.box('wood', { xMin: xMin + 0.04, xMax: xMax - 0.04, yMin: 0.14, yMax: 0.2, zMin: zMin + 0.04, zMax: zMax - 0.04 }, WOOD_D);
        for (const x of [xMin + 0.04, xMax - 0.1]) b.box('wood', { xMin: x, xMax: x + 0.06, yMin: 0.2, yMax: 0.5, zMin: zMin + 0.04, zMax: zMax - 0.04 }, WOOD_D);
        for (const z of [zMin + 0.04, zMax - 0.1]) b.box('wood', { xMin: xMin + 0.04, xMax: xMax - 0.04, yMin: 0.2, yMax: z === zMin + 0.04 ? 0.5 : 0.4, zMin: z, zMax: z + 0.06 }, WOOD_D);
        for (const x of [xMin + 0.02, xMax - 0.08]) b.box('wood', { xMin: x, xMax: x + 0.06, yMin: 0, yMax: 0.14, zMin: zMin + 0.02, zMax: zMax - 0.02 }, shade(WOOD_D, 0.85)); // balancins
        b.box('wood', { xMin: xMin + 0.1, xMax: xMax - 0.1, yMin: 0.2, yMax: 0.3, zMin: zMin + 0.1, zMax: zMax - 0.1 }, 0x8a8478);
        break;
      }
      default: fail(`${item.id}: tipus de moble desconegut '${item.type}'`);
    }
  });
}

// Espelma de paret: cadell de ferro (plaqueta + bacina) a la paret interior més propera de la casa.
function wallSconce(b, c, flames) {
  const it = BUILDINGS.find((q) => q.id === c.buildingId).visual.interior.footprint;
  const d = [[c.x - it.xMin, 'W'], [it.xMax - c.x, 'E'], [c.z - it.zMin, 'N'], [it.zMax - c.z, 'S']].sort((a, q) => a[0] - q[0])[0][1];
  const wx = d === 'W' ? it.xMin : d === 'E' ? it.xMax : null; const wz = d === 'N' ? it.zMin : d === 'S' ? it.zMax : null;
  const sx = d === 'W' ? 1 : -1; const sz = d === 'N' ? 1 : -1;
  if (wx !== null) b.box('plainD', { xMin: Math.min(wx, wx + sx * 0.02), xMax: Math.max(wx, wx + sx * 0.02), yMin: c.y - 0.2, yMax: c.y + 0.02, zMin: c.z - 0.035, zMax: c.z + 0.035 }, IRON_D);
  else b.box('plainD', { xMin: c.x - 0.035, xMax: c.x + 0.035, yMin: c.y - 0.2, yMax: c.y + 0.02, zMin: Math.min(wz, wz + sz * 0.02), zMax: Math.max(wz, wz + sz * 0.02) }, IRON_D);
  b.box('plainD', { xMin: c.x - 0.05, xMax: c.x + 0.05, yMin: c.y - 0.035, yMax: c.y, zMin: c.z - 0.05, zMax: c.z + 0.05 }, IRON_D); // bacina
  candle(b, c.x, c.y, c.z, flames, 0.15);
}

// Llums de ferro amb espelmes, ciris i decoració domèstica de la casa C: la família que hi vivia (Fase C).
function buildHouseDecor(mats, parent, flames) {
  const g = makeGroup('HouseDecor', 'HC');
  const b = new Builder(g, mats, 7600);
  const rnd = b.rnd;
  const up = FLOORS.slabs[0].y;
  // Espelmes de tots els interiors (CANDLES)
  for (const c of CANDLES) {
    if (c.on === 'wall') wallSconce(b, c, flames);
    else candle(b, c.x, c.y, c.z, flames, 0.14);
  }
  // Canelobre penjat sobre la taula: anella de ferro, cadena i dos ciris
  {
    const cxp = 4.1; const cyp = 2.05; const czp = 12.0; const rr = 0.28;
    b.add('plainD', new THREE.TorusGeometry(rr, 0.016, 5, 14).rotateX(Math.PI / 2), cxp, cyp, czp, { tint: IRON_D });
    b.box('plainD', { xMin: cxp - 0.01, xMax: cxp + 0.01, yMin: cyp, yMax: 2.65, zMin: czp - 0.01, zMax: czp + 0.01 }, IRON_D);
    for (let k = 0; k < 2; k++) { // Fase C.1: només 2 ciris (abans 4)
      const a = k * Math.PI + 0.4;
      candle(b, cxp + Math.cos(a) * rr, cyp + 0.016, czp + Math.sin(a) * rr, flames, 0.12);
    }
  }
  // Taula parada per a quatre (el sopar que no es va acabar): plats, gots i una barra de pa
  for (const [x, z] of [[3.8, 11.45], [4.4, 11.45], [3.8, 12.55], [4.4, 12.55]]) {
    b.add('plain', new THREE.CylinderGeometry(0.11, 0.09, 0.025, 9), x, 0.81, z, { tint: 0x8a7a68 });
    b.add('plain', new THREE.CylinderGeometry(0.03, 0.025, 0.08, 6), x + 0.14, 0.84, z, { tint: 0x6a6e78 });
  }
  b.add('plain', new THREE.CylinderGeometry(0.05, 0.05, 0.3, 7).rotateZ(Math.PI / 2), 4.1, 0.85, 12.0, { tint: 0xb08a50 });   // pa
  jar(b, 4.5, 0.8, 11.9, 0.07, 0.2, 0x7a5a3a);                                                                                    // gerra
  // Catifes velles (Fase C.2; mateixa mida i posició que abans): dues sota la taula (una damunt de l'altra) i una al costat del llit.
  b.add('rugA', new THREE.PlaneGeometry(2.0, 2.4).rotateX(-Math.PI / 2), 4.1, 0.036, 12.0);
  b.add('rugB', new THREE.PlaneGeometry(1.7, 2.1).rotateX(-Math.PI / 2), 4.1, 0.04, 12.0);
  b.add('rugC', new THREE.PlaneGeometry(1.0, 1.6).rotateX(-Math.PI / 2), 3.1, up + 0.012, 11.3);
  // Retrats de la família (marc de fusta + tela fosca amb dues siluetes) a la paret nord, sobre la prestatgeria, i a la paret est
  const portrait = (x, y, z, wall) => {
    const along = wall === 'N' || wall === 'S';
    const fw = 0.34; const fh = 0.44;
    const box = (key, a, tint) => b.box(key, a, tint);
    if (along) {
      const zz = wall === 'N' ? 9.4 : 14.6; const dz = wall === 'N' ? 1 : -1;
      box('wood', { xMin: x - fw / 2, xMax: x + fw / 2, yMin: y - fh / 2, yMax: y + fh / 2, zMin: Math.min(zz, zz + dz * 0.03), zMax: Math.max(zz, zz + dz * 0.03) }, WOOD_L);
      box('plainD', { xMin: x - fw / 2 + 0.03, xMax: x + fw / 2 - 0.03, yMin: y - fh / 2 + 0.03, yMax: y + fh / 2 - 0.03, zMin: Math.min(zz + dz * 0.03, zz + dz * 0.045), zMax: Math.max(zz + dz * 0.03, zz + dz * 0.045) }, 0x2a2a34);
      b.add('plainD', new THREE.CircleGeometry(0.05, 8), x, y + 0.08, zz + dz * 0.047, { tint: 0x8a7a68, rotY: wall === 'N' ? 0 : Math.PI });
      b.add('plainD', new THREE.PlaneGeometry(0.16, 0.12), x, y - 0.04, zz + dz * 0.047, { tint: 0x4a3a5a, rotY: wall === 'N' ? 0 : Math.PI });
    } else {
      const xx = wall === 'W' ? 2.4 : 6.6; const dx = wall === 'W' ? 1 : -1;
      box('wood', { xMin: Math.min(xx, xx + dx * 0.03), xMax: Math.max(xx, xx + dx * 0.03), yMin: y - fh / 2, yMax: y + fh / 2, zMin: z - fw / 2, zMax: z + fw / 2 }, WOOD_L);
      box('plainD', { xMin: Math.min(xx + dx * 0.03, xx + dx * 0.045), xMax: Math.max(xx + dx * 0.03, xx + dx * 0.045), yMin: y - fh / 2 + 0.03, yMax: y + fh / 2 - 0.03, zMin: z - fw / 2 + 0.03, zMax: z + fw / 2 - 0.03 }, 0x2a2a34);
      b.add('plainD', new THREE.CircleGeometry(0.05, 8), xx + dx * 0.047, y + 0.08, z, { tint: 0x8a7a68, rotY: dx > 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  };
  portrait(4.3, 2.25, 0, 'N'); portrait(4.85, 2.25, 0, 'N'); portrait(0, 1.85, 10.1, 'E');
  portrait(4.15, up + 1.6, 0, 'S');
  // Joguines d'infant a terra (cavallet de fusta i nina de drap) i botes a la porta
  b.box('wood', { xMin: 3.0, xMax: 3.34, yMin: 0.14, yMax: 0.2, zMin: 10.78, zMax: 10.9 }, WOOD_L);
  b.box('wood', { xMin: 3.26, xMax: 3.32, yMin: 0.2, yMax: 0.34, zMin: 10.78, zMax: 10.84 }, WOOD_L);
  for (const [x, z] of [[3.02, 10.78], [3.3, 10.78], [3.02, 10.86], [3.3, 10.86]]) b.box('wood', { xMin: x, xMax: x + 0.03, yMin: 0, yMax: 0.14, zMin: z, zMax: z + 0.03 }, WOOD_D);
  b.add('plain', new THREE.BoxGeometry(0.1, 0.2, 0.06), 3.25, up + 0.1 - up, 9.9 + 0.2, { tint: 0x8a6a5a, rotY: 0.4 });
  for (const z of [11.1, 11.25]) b.box('plain', { xMin: 2.5, xMax: 2.68, yMin: 0.0, yMax: 0.12, zMin: z, zMax: z + 0.1 }, 0x3a2a20);
  // Colador de cuina i verdures seques penjades d'una biga
  for (let k = 0; k < 4; k++) b.add('plain', new THREE.ConeGeometry(0.05, 0.28, 5).rotateX(Math.PI), 3.2 + k * 0.18, 2.35, 9.55, { tint: [0x5a6a3a, 0x6a5a3a, 0x4a5a30, 0x6a6a40][k] });
  b.box('wood', { xMin: 3.05, xMax: 3.95, yMin: 2.52, yMax: 2.56, zMin: 9.52, zMax: 9.58 }, WOOD_D);
  // Pis superior: gibrelles, cistell i una nina sobre el llit
  b.add('plain', new THREE.CylinderGeometry(0.16, 0.13, 0.12, 8), 4.8, up + 0.06, 13.4, { tint: 0x8a6a40 });
  b.add('plain', new THREE.BoxGeometry(0.1, 0.18, 0.06), 3.1, up + 0.55, 14.2, { tint: 0x8a6a5a, rotY: 0.3 });
  b.finish();
  parent.add(g);
}

// Portes de l'armari, segons la cara.
function cabinetDoors(b, item) {
  const f = item.visual.footprint; const h = item.visual.height;
  const { xMin, xMax, zMin, zMax } = f;
  const tint = shade(WOOD_L, 0.92);
  if (item.faces === 'east' || item.faces === 'west') {
    const x0 = item.faces === 'east' ? xMax : xMin - 0.025; const x1 = x0 + 0.025;
    const zm = (zMin + zMax) / 2;
    for (const [a, c] of [[zMin + 0.04, zm - 0.01], [zm + 0.01, zMax - 0.04]]) b.box('wood', { xMin: x0, xMax: x1, yMin: 0.1, yMax: h - 0.04, zMin: a, zMax: c }, tint);
    const kx0 = item.faces === 'east' ? x1 : x0 - 0.025;
    for (const z of [zm - 0.06, zm + 0.06]) b.box('plainD', { xMin: kx0, xMax: kx0 + 0.025, yMin: 0.7, yMax: 0.76, zMin: z - 0.02, zMax: z + 0.02 }, IRON_D);
  } else {
    const z0 = item.faces === 'south' ? zMax : zMin - 0.025; const z1 = z0 + 0.025;
    const xm = (xMin + xMax) / 2;
    for (const [a, c] of [[xMin + 0.04, xm - 0.01], [xm + 0.01, xMax - 0.04]]) b.box('wood', { xMin: a, xMax: c, yMin: 0.1, yMax: h - 0.04, zMin: z0, zMax: z1 }, tint);
    const kz0 = item.faces === 'south' ? z1 : z0 - 0.025;
    for (const x of [xm - 0.06, xm + 0.06]) b.box('plainD', { xMin: x - 0.02, xMax: x + 0.02, yMin: 0.7, yMax: 0.76, zMin: kz0, zMax: kz0 + 0.025 }, IRON_D);
  }
}

// Mobles de totes les estances: una malla per material i per edifici. Retorna els controls dels elements mòbils.
function buildFurniture(mats, parent, opts, puzzle) {
  const group = makeGroup('Furniture');
  const byBuilding = {};
  for (const item of FURNITURE) (byBuilding[item.buildingId] = byBuilding[item.buildingId] || []).push(item);
  const flames = [];
  let seed = 6000;
  for (const [bid, items] of Object.entries(byBuilding)) {
    const g = makeGroup(`Furniture-${bid}`, bid);
    const b = new Builder(g, mats, seed++);
    for (const item of items) {
      if (FRAMED_TYPES.includes(item.type)) { drawFramed(b, item); continue; }
      const up = item.level === 1 ? FLOORS.slabs.find((q) => q.buildingId === item.buildingId).y : 0;
      if (up) b.setFrame({ x: 0, y: up, z: 0, rotY: 0 });
      furnitureBody(b, item);
      if (item.type === 'cabinet') cabinetDoors(b, item);
      if (up) b.setFrame(null);
      const f = item.visual.footprint;
      if (item.type === 'altar') {
        for (const x of [-0.6, 0.6]) candle(b, x, item.visual.height + 0.012, (f.zMin + f.zMax) / 2, flames, 0.2);
      }
    }
    b.finish();
    group.add(g);
  }
  // --- Calaix de la còmoda A (peça mòbil que llisca cap a la sala) ---
  const drs = FURNITURE.find((q) => q.id === 'A-DRS');
  const keyA = KEYS.find((k) => k.id === 'KEY-A');
  const drawer = markDynamic(makeGroup('A-DRS-drawer', 'A-DRS'));
  {
    const f = drs.visual.footprint;
    const b = new Builder(drawer, mats, 6100);
    b.box('wood', { xMin: f.xMin + 0.06, xMax: f.xMax - 0.06, yMin: 0.62, yMax: 0.88, zMin: f.zMax, zMax: f.zMax + 0.03 }, shade(WOOD_L, 0.92)); // front
    b.box('plainD', { xMin: (f.xMin + f.xMax) / 2 - 0.04, xMax: (f.xMin + f.xMax) / 2 + 0.04, yMin: 0.73, yMax: 0.77, zMin: f.zMax + 0.03, zMax: f.zMax + 0.06 }, IRON_D);
    b.box('wood', { xMin: f.xMin + 0.09, xMax: f.xMax - 0.09, yMin: 0.62, yMax: 0.64, zMin: f.zMax - 0.4, zMax: f.zMax }, WOOD_D);       // fons
    for (const x of [f.xMin + 0.06, f.xMax - 0.09]) b.box('wood', { xMin: x, xMax: x + 0.03, yMin: 0.64, yMax: 0.8, zMin: f.zMax - 0.4, zMax: f.zMax }, WOOD_D);
    b.box('wood', { xMin: f.xMin + 0.09, xMax: f.xMax - 0.09, yMin: 0.64, yMax: 0.8, zMin: f.zMax - 0.4, zMax: f.zMax - 0.37 }, WOOD_D);
    b.box('wood', { xMin: f.xMin + 0.09, xMax: f.xMax - 0.09, yMin: 0.64, yMax: 0.66, zMin: f.zMax - 0.4, zMax: f.zMax }, CLOTH); // drap al fons
    b.finish();
    group.add(drawer);
  }
  const DRAWER_TRAVEL = 0.35;
  const chs = FURNITURE.find((q) => q.id === 'B-CHS');
  const keyB = KEYS.find((k) => k.id === 'KEY-B');
  const lidPivot = markDynamic(makeGroup('B-CHS-lid', 'B-CHS'));
  {
    const f = chs.visual.footprint;
    lidPivot.position.set(f.xMax, 0.4, (f.zMin + f.zMax) / 2); // frontissa a la paret (est), a la vora del cos
    const b = new Builder(lidPivot, mats, 6200);
    const w = f.xMax - f.xMin; const d = f.zMax - f.zMin;
    b.box('wood', { xMin: -w, xMax: 0, yMin: 0, yMax: 0.07, zMin: -d / 2, zMax: d / 2 }, shade(WOOD_D, 0.95));
    b.box('wood', { xMin: -w, xMax: 0, yMin: 0.07, yMax: 0.11, zMin: -d / 2 + 0.05, zMax: d / 2 - 0.05 }, WOOD_D); // bombat
    for (const z of [-d / 2 + 0.2, d / 2 - 0.26]) b.box('plainD', { xMin: -w - 0.012, xMax: 0.012, yMin: 0.0, yMax: 0.115, zMin: z, zMax: z + 0.06 }, IRON_D);
    b.box('plainD', { xMin: -w - 0.03, xMax: -w + 0.02, yMin: 0.02, yMax: 0.09, zMin: -0.04, zMax: 0.04 }, IRON_D); // pany
    b.finish();
    group.add(lidPivot);
  }

  // --- Claus al descobert (dins el calaix / sobre la manta de l'arca) + espurna per descobrir-les ---
  const keyMeshes = {}; const keyGlints = {};
  for (const [k, parentObj, local] of [
    [keyA, drawer, [keyA.pos.x, keyA.y, keyA.pos.z - DRAWER_TRAVEL]],
    [keyB, group, [keyB.pos.x, keyB.y, keyB.pos.z]],
  ]) {
    const mesh = buildKeyMesh(mats, k, 'flat', 6300);
    mesh.position.set(local[0], local[1], local[2]);
    mesh.rotation.y = k.id === 'KEY-A' ? 0.5 : -0.35;
    mesh.visible = false;
    parentObj.add(mesh);
    const glint = new THREE.Sprite(mats.keyGlow);
    glint.scale.set(0.4, 0.4, 1);
    glint.position.set(local[0], local[1] + 0.04, local[2]);
    glint.visible = false;
    parentObj.add(glint);
    keyMeshes[k.id] = mesh; keyGlints[k.id] = glint;
  }

  const churchFlames = flames.length; // les flames de l'altar de l'església (anteriors a les cases) no canvien
  buildHouseDecor(mats, group, flames);
  const sprites = [];
  for (const [i, [x, y, z]] of flames.entries()) {
    const house = i >= churchFlames;
    const sp = new THREE.Sprite(house ? mats.glowSoft : mats.glow); // Fase C.1: a les cases, halo petit i més tènue (la flama es veu, però no il·lumina res)
    if (house) sp.scale.set(0.42, 0.42, 1); else sp.scale.set(0.7, 0.7, 1);
    sp.position.set(x, y, z);
    group.add(sp);
    sprites.push(sp);
  }
  parent.add(group);

  const handles = {
    // 0 → 1: el calaix llisca / la tapa s'alça (95° màxim: no entra a la paret)
    setContainer(id, p) {
      if (id === 'A-DRS') drawer.position.z = DRAWER_TRAVEL * p;
      else if (id === 'B-CHS') lidPivot.rotation.z = -p * (95 * Math.PI) / 180;
    },
    // La clau és visible (i brilla una mica) quan el contenidor s'ha obert i encara no s'ha recollit.
    setKeyVisible(id, v) { if (keyMeshes[id]) { keyMeshes[id].visible = v; keyGlints[id].visible = v; } },
  };
  return { group, handles, flames };
}

// ---------------------------------------------------------------------
// PORTA SECRETA (darrere l'altar): marc gòtic de pedra, dos batents de roure molt fosc que lliscaran
// dins el gruix del marc, dues ranures de ferro i símbols gravats. La foscor del darrere és una placa negra.
// ---------------------------------------------------------------------
function buildSecretDoor(mats, parent) {
  const SD = SECRET_DOOR;
  const group = makeGroup('SecretDoor', SD.id);
  const halfW = SD.width / 2; const straight = SD.height - 0.7; const apex = 0.7;
  const b = new Builder(group, mats, 7000);
  b.setFrame({ x: SD.center.x, y: 0, z: SD.center.z, rotY: 0 });

  // Marc de pedra: placa de 3,0 × 3,3 m amb l'obertura apuntada tallada (0,16 m de relleu).
  const shape = new THREE.Shape();
  shape.moveTo(-1.5, 0); shape.lineTo(1.5, 0); shape.lineTo(1.5, 3.3); shape.lineTo(-1.5, 3.3);
  shape.holes.push(gothicHole(0, SD.width, 0.02, straight - 0.02, apex));
  const frame = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false, curveSegments: 6 });
  scaleUV(frame, 1 / TILE.stone);
  b.add('stone', frame, 0, 0, 0, { tint: 0x8a90a4 });
  b.box('stone', { xMin: -1.62, xMax: 1.62, yMin: 3.3, yMax: 3.42, zMin: 0, zMax: 0.24 }, 0x9aa0b2);   // cornisa
  b.box('stone', { xMin: -0.7, xMax: 0.7, yMin: 0, yMax: 0.04, zMin: 0, zMax: 0.3 }, 0x7a8092);         // llindar
  // Foscor del darrere (placa negra dins l'obertura).
  b.add('glass', gothicGeometry(SD.width, straight - 0.02, apex, 0.01), 0, 0.02, 0.005, { tint: 0x020307 });

  // Ranures de ferro (a les dovelles) amb la gravació del símbol a sobre.
  for (const s of SD.slots) {
    b.box('plainD', { xMin: s.x - 0.08, xMax: s.x + 0.08, yMin: s.y - 0.27, yMax: s.y + 0.27, zMin: 0.16, zMax: 0.19 }, IRON_D);
    b.box('glass', { xMin: s.x - 0.018, xMax: s.x + 0.018, yMin: s.y - 0.16, yMax: s.y + 0.16, zMin: 0.19, zMax: 0.2 }, 0x050508);
    for (const dy of [-0.23, 0.23]) b.box('plainD', { xMin: s.x - 0.02, xMax: s.x + 0.02, yMin: s.y + dy - 0.015, yMax: s.y + dy + 0.015, zMin: 0.19, zMax: 0.21 }, 0x4a464e); // reblons
    const sym = s.key === 'KEY-A' ? bellShape(1.5) : moonShape(1.6);
    b.add('plain', glyph(sym, 0.012), s.x, s.key === 'KEY-A' ? 1.85 : 1.9, 0.16, { tint: 0x1c1e26 });
  }
  // Banda de símbols antics gravats sobre l'obertura (barres amb marques), i tres sigils rodons.
  const r = b.rnd;
  for (let i = 0; i < 17; i++) {
    const x = -1.25 + i * 0.155;
    const hgt = 0.1 + r() * 0.1;
    b.box('plain', { xMin: x - 0.012, xMax: x + 0.012, yMin: 3.0, yMax: 3.0 + hgt, zMin: 0.16, zMax: 0.175 }, 0x1c1e26);
    if (r() > 0.45) b.box('plain', { xMin: x - 0.05, xMax: x + 0.05, yMin: 3.0 + hgt * 0.5, yMax: 3.0 + hgt * 0.5 + 0.02, zMin: 0.16, zMax: 0.175 }, 0x1c1e26);
  }
  for (const x of [-1.15, 0, 1.15]) b.add('plain', new THREE.TorusGeometry(0.1, 0.012, 4, 10), x, 2.88 - (x === 0 ? 0 : 0.5), 0.17, { tint: 0x1c1e26 });
  // Creu de fusta sobre la cornisa (símbol medieval discret).
  b.box('wood', { xMin: -0.035, xMax: 0.035, yMin: 3.62, yMax: 4.42, zMin: 0.01, zMax: 0.06 }, WOOD_D);
  b.box('wood', { xMin: -0.25, xMax: 0.25, yMin: 4.12, yMax: 4.19, zMin: 0.01, zMax: 0.06 }, WOOD_D);
  b.setFrame(null);
  b.finish();

  // Batents (peces mòbils): cada un llisca cap al seu costat, per dins del marc.
  const leaves = [-1, 1].map((side) => {
    const leaf = markDynamic(makeGroup(`SD-leaf-${side < 0 ? 'W' : 'E'}`, SD.id));
    const lb = new Builder(leaf, mats, 7100 + side);
    const s = new THREE.Shape();
    if (side < 0) {
      s.moveTo(-halfW, 0.02); s.lineTo(0, 0.02); s.lineTo(0, SD.height);
      s.quadraticCurveTo(-halfW, straight + apex * 0.75, -halfW, straight);
    } else {
      s.moveTo(0, 0.02); s.lineTo(halfW, 0.02); s.lineTo(halfW, straight);
      s.quadraticCurveTo(halfW, straight + apex * 0.75, 0, SD.height);
    }
    s.closePath();
    const slab = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false, curveSegments: 6 });
    scaleUV(slab, 1 / 0.3, 1 / 1.2);
    lb.add('doorOak', slab, 0, 0, 0.03, { tint: 0x3a2c22 });
    const x0 = side < 0 ? -halfW : 0; const x1 = side < 0 ? 0 : halfW;
    for (const y of [0.45, 1.2, 1.9]) { // reforços de ferro horitzontals amb reblons i frontissa
      lb.box('plainD', { xMin: x0 + 0.01, xMax: x1 - 0.01, yMin: y, yMax: y + 0.13, zMin: 0.1, zMax: 0.115 }, IRON_D);
      for (const dx of [0.1, 0.35, 0.6]) {
        const x = side < 0 ? x0 + dx : x1 - dx;
        lb.box('plainD', { xMin: x - 0.018, xMax: x + 0.018, yMin: y + 0.05, yMax: y + 0.085, zMin: 0.115, zMax: 0.13 }, 0x4a464e);
      }
      const hx = side < 0 ? x0 : x1 - 0.2;
      lb.box('plainD', { xMin: hx, xMax: hx + 0.2, yMin: y - 0.015, yMax: y + 0.145, zMin: 0.1, zMax: 0.125 }, 0x1e1c22);
    }
    lb.box('plainD', { xMin: side < 0 ? -0.07 : 0, xMax: side < 0 ? 0 : 0.07, yMin: 0.1, yMax: 2.5, zMin: 0.1, zMax: 0.12 }, IRON_D); // junta central
    lb.add('plainD', new THREE.TorusGeometry(0.07, 0.012, 5, 10), side < 0 ? -0.2 : 0.2, 1.1, 0.13, { tint: IRON_D });
    lb.finish();
    group.add(leaf);
    leaf.position.set(SD.center.x, 0, SD.center.z);
    return leaf;
  });

  // Claus inserides (visibles a mesura que s'insereixen) i el seu llumeneta.
  const inserted = {};
  for (const s of SD.slots) {
    const def = KEYS.find((k) => k.id === s.key);
    const mesh = buildKeyMesh(mats, def, 'slot', 7200);
    mesh.position.set(SD.center.x + s.x, s.y, SD.center.z + 0.28);
    mesh.visible = false;
    group.add(mesh);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.3, 0.004), mats.flame);
    glow.position.set(SD.center.x + s.x, s.y, SD.center.z + 0.202);
    glow.visible = false;
    group.add(glow);
    inserted[s.key] = { mesh, glow };
  }
  parent.add(group);
  return {
    group,
    // p: 0 (tancada) → 1 (oberta). Cada batent llisca `SD.slide` · p cap al seu costat.
    setProgress(p) {
      leaves[0].position.x = SD.center.x - SD.slide * p;
      leaves[1].position.x = SD.center.x + SD.slide * p;
    },
    setInserted(keyId, v) { const e = inserted[keyId]; if (e) { e.mesh.visible = v; e.glow.visible = v; } },
  };
}

// ---------------------------------------------------------------------
// ESGLÉSIA (Fase B): pilastres gòtiques, espelmes de paret i llum càlida dels ciris
// ---------------------------------------------------------------------
function buildChurchDecor(mats, parent, opts) {
  const nave = BUILDINGS.find((b) => b.id === 'CH-N');
  const it = nave.visual.interior.footprint;
  const g = makeGroup('ChurchDecor', 'CH-N');
  const b = new Builder(g, mats, 7300);
  const flames = [];
  // Pilastres/mènsules entre finestres (només visual, sobresurten 0,12 m): per sobre dels bancs (y ≥ 1,1).
  for (const z of [-17.65, -15.35, -13.0]) {
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? it.xMin : it.xMax - 0.12; const x1 = x0 + 0.12;
      b.box('stone', { xMin: x0, xMax: x1, yMin: 1.1, yMax: 3.7, zMin: z - 0.14, zMax: z + 0.14 }, 0x8e94a6);
      b.box('stone', { xMin: side < 0 ? x0 : x0 - 0.04, xMax: side < 0 ? x1 + 0.04 : x1, yMin: 1.0, yMax: 1.1, zMin: z - 0.2, zMax: z + 0.2 }, 0xa0a6b6);   // mènsula
      b.box('stone', { xMin: side < 0 ? x0 : x0 - 0.04, xMax: side < 0 ? x1 + 0.04 : x1, yMin: 3.7, yMax: 3.8, zMin: z - 0.2, zMax: z + 0.2 }, 0xa0a6b6);   // capitell
    }
  }
  // Dues espelmes de paret flanquejant la porta secreta.
  for (const x of [-2.0, 2.0]) {
    b.box('plainD', { xMin: x - 0.02, xMax: x + 0.02, yMin: 1.55, yMax: 1.62, zMin: it.zMin, zMax: it.zMin + 0.22 }, IRON_D);
    b.box('plainD', { xMin: x - 0.06, xMax: x + 0.06, yMin: 1.6, yMax: 1.64, zMin: it.zMin + 0.16, zMax: it.zMin + 0.26 }, IRON_D);
    candle(b, x, 1.64, it.zMin + 0.21, flames, 0.18);
  }
  b.finish();
  for (const [x, y, z] of flames) {
    const sp = new THREE.Sprite(mats.glow);
    sp.scale.set(0.9, 0.9, 1);
    sp.position.set(x, y, z);
    g.add(sp);
  }
  parent.add(g);
  let light = null;
  if (opts.candleLight) { // UNA sola llum puntual, càlida i baixa, per als ciris de l'altar
    light = new THREE.PointLight(0xffb468, opts.candleIntensity, opts.candleDistance, 2);
    light.position.set(0, 1.5, (it.zMin + 1.9));
    light.name = 'ChurchCandles';
    parent.add(light);
  }
  return light;
}

// ---------------------------------------------------------------------
// ATREZZO
// ---------------------------------------------------------------------
const FOUNTAIN = { floorY: 0.35, rim: 0.35, column: 0.3, plinth: 0.62, plinthH: 0.3, bowl: 0.9, bowlH: 0.3, finialH: 0.4 };
const BENCH = { slab: 0.05, gap: 0.02, backGap: 0.12, leg: 0.06 };
const SIGN = { boardWidth: 0.9, boardBottom: 1.85, boardThick: 0.06 };

function buildFountain(mats, p, seed) {
  const { center, acrossFlats, height, basinHeight } = p.visual;
  if (p.visual.shape !== 'octagon') fail(`${p.id}: només s'admet shape 'octagon'`);
  const g = makeGroup(p.id, p.id);
  g.position.set(center.x, 0, center.z);
  const b = new Builder(g, mats, seed);
  const F = FOUNTAIN;
  const R = (acrossFlats / 2) / Math.cos(Math.PI / 8); // radi circumscrit de l'octàgon
  const align = Math.PI / 8;                           // plans (no vèrtexs) sobre els eixos
  const stone = 0xd2cec2;

  const inner = R - F.rim;
  const basin = new THREE.LatheGeometry([
    new THREE.Vector2(R, 0), new THREE.Vector2(R, basinHeight), new THREE.Vector2(inner, basinHeight),
    new THREE.Vector2(inner, F.floorY), new THREE.Vector2(0, F.floorY),
  ], 8).rotateY(align);
  scaleUV(basin, 3.4, 0.6);
  b.add('stoneD', basin, 0, 0, 0, { tint: stone });
  // Vora de pedres: 8 blocs, un per pla de l'octàgon, dins del pla (apotema = acrossFlats / 2).
  const apothem = acrossFlats / 2;
  for (let i = 0; i < 8; i++) {
    const a = i * (Math.PI / 4); // direcció del centre de cada pla (angle des de +Z cap a +X)
    const rr = apothem - 0.05 - 0.21;
    const blk = texBox(1.5, 0.08, 0.42, TILE.stone, b.rnd);
    b.add('stone', blk, Math.sin(a) * rr, basinHeight + 0.04, Math.cos(a) * rr, { rotY: a, tint: jit(0xe4e0d4, 0.1, b.rnd) });
  }
  const bowlTop = height - F.finialH;
  const piece = (geo, y, tint) => { scaleUV(geo, 2, 1); b.add('stoneD', geo.rotateY(align), 0, y, 0, { tint }); };
  piece(new THREE.CylinderGeometry(F.plinth, F.plinth + 0.05, F.plinthH, 8), F.floorY + F.plinthH / 2, 0xc8c4b8);                  // peça 1: sòcol
  const shaftH = bowlTop - F.bowlH - (F.floorY + F.plinthH);
  piece(new THREE.CylinderGeometry(F.column, F.column + 0.04, shaftH, 8), F.floorY + F.plinthH + shaftH / 2, stone);               // peça 2: fust
  piece(new THREE.CylinderGeometry(F.bowl, F.column + 0.1, F.bowlH, 8), bowlTop - F.bowlH / 2, 0xdad6ca);                         // peça 3: copa
  piece(new THREE.ConeGeometry(F.column, F.finialH, 8), bowlTop + F.finialH / 2, 0xc8c4b8);                                         // coronament
  b.finish();
  return g;
}

// Cilindre cònic entre dos punts (coordenades locals de l'arbre).
function addLimb(b, key, p0, p1, r0, r1, seg, tint) {
  const dx = p1[0] - p0[0]; const dy = p1[1] - p0[1]; const dz = p1[2] - p0[2];
  const L = Math.hypot(dx, dy, dz);
  const geo = new THREE.CylinderGeometry(r1, r0, L, seg, 1);
  scaleUV(geo, 1.5, Math.max(0.5, L));          // escorça: ~1 rajola per metre
  geo.rotateZ(-Math.acos(dy / L));               // inclina (el +Y cap a +X)
  geo.rotateY(Math.atan2(-dz, dx));              // gira cap a la direcció horitzontal
  b.add(key, geo, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, { tint });
}

// Arbre vell i tortuós: tronc irregular amb escorça, arrels, 3 branques
// principals, branquetes seques i una capçada de grups de fulles (cartes amb
// alpha-test) asimètrica on es veuen les branques. La posició, el radi del
// tronc a terra i l'alçada total (`height`, exacta) surten del layout.
function buildTree(mats, tex, p, seed) {
  const { center, trunkRadius: R, height } = p.visual;
  const g = makeGroup(p.id, p.id);
  g.position.set(center.x, 0, center.z);
  const b = new Builder(g, mats, seed);
  const r = b.rnd;
  const bark = () => jit(0xd8d0c4, 0.12, r);

  // Tronc: trams desplaçats i cada cop més prims; base lleugerament eixamplada.
  addLimb(b, 'bark', [0, -0.02, 0], [0, 0.35, 0], R * 1.35, R, 7, bark());
  const trunk = [[0, 0.3, 0, R], [0.08, 0.95, 0.05, R * 0.88], [-0.04, 1.8, 0.12, R * 0.78], [0.1, 2.6, 0, R * 0.66]];
  for (let i = 0; i < trunk.length - 1; i++) {
    addLimb(b, 'bark', trunk[i].slice(0, 3), trunk[i + 1].slice(0, 3), trunk[i][3], trunk[i + 1][3], 7, bark());
  }
  // Arrels visibles que s'estenen pel terra (només visuals, a ras de terra).
  [0.3, 1.5, 2.6, 3.9, 5.1].forEach((a) => {
    const len = 1.0 + r() * 0.5;
    const p0 = [Math.cos(a) * 0.15, 0.22, Math.sin(a) * 0.15];
    const p1 = [Math.cos(a) * 0.7, 0.07, Math.sin(a) * 0.7];
    const p2 = [Math.cos(a + 0.15) * len, -0.02, Math.sin(a + 0.15) * len];
    addLimb(b, 'bark', p0, p1, 0.14, 0.08, 5, bark());
    addLimb(b, 'bark', p1, p2, 0.08, 0.03, 5, bark());
  });
  // Tres branques principals que surten de la forca (+ una que penja).
  const fork = [0.1, 2.6, 0];
  const branches = [
    [[0.9, 3.4, 0.3, 0.15], [1.7, 4.3, 0.5, 0.1]],
    [[-0.6, 3.5, -0.3, 0.14], [-1.5, 4.4, -0.7, 0.09]],
    [[0.2, 3.8, 0.5, 0.12], [0.5, 5.0, 0.9, 0.07]],
  ];
  for (const br of branches) {
    let prev = fork; let pr = R * 0.66 * 0.8;
    for (const [x, y, z, rad] of br) { addLimb(b, 'bark', prev, [x, y, z], pr, rad, 6, bark()); prev = [x, y, z]; pr = rad; }
  }
  addLimb(b, 'bark', [0.9, 3.4, 0.3], [1.4, 3.2, 1.2], 0.1, 0.05, 5, bark());   // branca que penja
  addLimb(b, 'bark', [-0.6, 3.5, -0.3], [-1.1, 3.9, 0.6], 0.09, 0.05, 5, bark());
  // Branquetes seques (grises i primes) que sobresurten de la capçada.
  const dry = [[[1.7, 4.3, 0.5], [2.6, 4.6, 0.9]], [[-1.5, 4.4, -0.7], [-2.4, 4.2, -1.2]],
    [[0.5, 5.0, 0.9], [0.9, 5.7, 1.3]], [[-1.5, 4.4, -0.7], [-2.0, 5.2, -0.9]]];
  for (const [p0, p1] of dry) addLimb(b, 'bark', p0, p1, 0.05, 0.012, 4, jit(0x9a9488, 0.1, r));

  if (tex.leaf) {
    // Capçada: grups de 3 cartes de fulles (2 verticals creuades + 1 gairebé horitzontal).
    // Cap carta supera `height`; la del grup superior hi arriba EXACTAMENT.
    const clumps = [
      [0.2, 5.2, 0.2, 2.3], [1.6, 4.6, 0.6, 2.0], [-1.5, 4.7, -0.5, 2.0], [0.6, 4.0, 1.3, 1.8],
      [-0.4, 3.9, -1.3, 1.7], [2.3, 4.0, -0.1, 1.6], [-2.3, 4.0, 0.1, 1.4], [0.9, 5.5, -0.5, 1.7],
      [-0.8, 5.4, 0.8, 1.6], [1.4, 3.5, 0.9, 1.4], [-1.0, 3.3, 0.3, 1.3], [0.1, 4.6, -1.7, 1.4],
      [2.6, 4.8, 0.6, 1.1],
    ];
    const tints = [0xffffff, 0xd6e6b4, 0xc0cfae, 0xe8ead2, 0xb4c4a0];
    clumps.forEach(([x, y, z, s], ci) => {
      for (let k = 0; k < 3; k++) {
        const card = new THREE.PlaneGeometry(s, s);
        card.rotateX(k < 2 ? (r() - 0.5) * 0.6 : -Math.PI / 2 + (r() - 0.5) * 0.5);
        card.computeBoundingBox();
        let cy = y;
        if (ci === 0 && k === 0) cy = height - card.boundingBox.max.y;       // punt més alt exacte
        else cy = Math.min(y, height - 0.05 - card.boundingBox.max.y);       // mai per sobre
        b.add('leaves', card, x, cy, z, { rotY: k * (Math.PI / 3) + r() * 0.5, tint: jit(tints[Math.floor(r() * tints.length)], 0.08, r) });
      }
    });
    // Masses fosques a l'interior perquè no es vegi a través de tota la capçada.
    for (const [x, y, z, rad, c] of [[0.1, 4.5, 0.1, 0.8, 0x1f3320], [1.2, 4.2, 0.4, 0.65, 0x23381f], [-1.0, 4.3, -0.4, 0.6, 0x1c2f20]]) {
      b.add('plain', new THREE.IcosahedronGeometry(rad, 0), x, y, z, { tint: c });
    }
  } else {
    // Sense textures: capçada de blocs de color (el punt més alt, exacte).
    const crown = new THREE.IcosahedronGeometry(2.0, 0);
    crown.computeBoundingBox();
    const cy = height - crown.boundingBox.max.y;
    b.add('plain', crown, 0, cy, 0, { tint: jit(0x3f5f3a, 0.06, r) });
    b.add('plain', new THREE.IcosahedronGeometry(1.1, 0), 1.0, cy - 0.6, 0.5, { tint: jit(0x4a6a3a, 0.08, r) });
    b.add('plain', new THREE.IcosahedronGeometry(1.1, 0), -0.9, cy - 0.7, -0.6, { tint: jit(0x35553a, 0.08, r) });
  }
  b.finish();
  return g;
}

// Banc: seient i respatller de llistons, costats i muntants de fusta.
function buildBench(mats, p, seed) {
  const { footprint: fp, height: H, seatHeight: S, facing } = p.visual;
  requireRect(fp, `${p.id}.visual.footprint`);
  const g = makeGroup(p.id, p.id);
  const b = new Builder(g, mats, seed);
  const depthAlongX = facing === 'east' || facing === 'west';
  if (!depthAlongX && facing !== 'north' && facing !== 'south') fail(`${p.id}: facing desconegut '${facing}'`);
  const B = BENCH;
  const width = depthAlongX ? fp.zMax - fp.zMin : fp.xMax - fp.xMin;
  const depth = depthAlongX ? fp.xMax - fp.xMin : fp.zMax - fp.zMin;
  // (u, v): u al llarg de l'amplada; v del DAVANT (0) al DARRERE (depth).
  const box = (u0, u1, v0, v1, y0, y1, tint) => {
    let xMin; let xMax; let zMin; let zMax;
    if (depthAlongX) {
      zMin = fp.zMin + u0; zMax = fp.zMin + u1;
      if (facing === 'west') { xMin = fp.xMin + v0; xMax = fp.xMin + v1; } else { xMin = fp.xMax - v1; xMax = fp.xMax - v0; }
    } else {
      xMin = fp.xMin + u0; xMax = fp.xMin + u1;
      if (facing === 'north') { zMin = fp.zMin + v0; zMax = fp.zMin + v1; } else { zMin = fp.zMax - v1; zMax = fp.zMax - v0; }
    }
    b.box('wood', { xMin, xMax, yMin: y0, yMax: y1, zMin, zMax }, tint);
  };
  const slatD = (depth - B.leg - 2 * B.gap) / 3;
  for (let i = 0; i < 3; i++) { // seient: 3 llistons
    const v0 = i * (slatD + B.gap);
    box(0, width, v0, v0 + slatD, S - B.slab, S, jit(0xb0a090, 0.1, b.rnd));
  }
  box(0, B.leg, 0, depth, 0, S - B.slab, 0x8a7a6e);                         // costats
  box(width - B.leg, width, 0, depth, 0, S - B.slab, 0x8a7a6e);
  box(0, B.leg, depth - B.leg, depth, S - B.slab, H, 0x8a7a6e);             // muntants del respatller
  box(width - B.leg, width, depth - B.leg, depth, S - B.slab, H, 0x8a7a6e);
  const backH = (H - S - B.backGap - B.gap) / 2;
  for (let i = 0; i < 2; i++) { // respatller: 2 llistons
    const y0 = S + B.backGap + i * (backH + B.gap);
    box(B.leg, width - B.leg, depth - B.leg, depth - B.leg / 2, y0, y0 + backH, jit(0xb0a090, 0.1, b.rnd));
  }
  b.finish();
  return g;
}

// Barril: panxa de 12 costats i tres cèrcols de ferro.
function makeBarrel(mats, id, cx, cz, radius, height, seed) {
  const g = makeGroup(id, id);
  g.position.set(cx, 0, cz);
  const b = new Builder(g, mats, seed);
  const prof = [[0, 0], [0.8, 0], [0.93, 0.22], [1, 0.5], [0.93, 0.78], [0.8, 1], [0, 1]];
  const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * radius, y * height)), 12);
  scaleUV(body, 2, 1.2);
  b.add('wood', body, 0, 0, 0, { tint: jit(0x9a8068, 0.12, b.rnd) });
  const radiusAt = (f) => (f <= 0.22 ? 0.8 + (f / 0.22) * 0.13 : f <= 0.5 ? 0.93 + ((f - 0.22) / 0.28) * 0.07
    : f <= 0.78 ? 1 - ((f - 0.5) / 0.28) * 0.07 : 0.93 - ((f - 0.78) / 0.22) * 0.13);
  for (const f of [0.15, 0.5, 0.85]) {
    const r = radiusAt(f) * radius + 0.006;
    b.add('plainD', new THREE.CylinderGeometry(r, r, 0.05, 12, 1, true), 0, f * height, 0, { tint: 0x2a282e });
  }
  b.finish();
  return g;
}

// Caixa: tauler amb marc i travesser en creu a la tapa.
function buildCrate(mats, p, seed) {
  const fp = requireRect(p.visual.footprint, `${p.id}.visual.footprint`);
  const H = p.visual.height;
  const g = makeGroup(p.id, p.id);
  const b = new Builder(g, mats, seed);
  b.box('wood', { ...fp, yMin: 0, yMax: H }, jit(0xb0a090, 0.1, b.rnd));
  const pr = 0.02; const post = 0.06;
  for (const [x0, x1] of [[fp.xMin, fp.xMin + post], [fp.xMax - post, fp.xMax]]) {
    for (const [z0, z1] of [[fp.zMin, fp.zMin + post], [fp.zMax - post, fp.zMax]]) {
      b.box('wood', { xMin: x0 - (x0 === fp.xMin ? pr : 0), xMax: x1 + (x1 === fp.xMax ? pr : 0), yMin: 0, yMax: H, zMin: z0 - (z0 === fp.zMin ? pr : 0), zMax: z1 + (z1 === fp.zMax ? pr : 0) }, 0x8a7a6e);
    }
  }
  const cx = (fp.xMin + fp.xMax) / 2; const cz = (fp.zMin + fp.zMax) / 2;
  b.box('wood', { xMin: fp.xMin, xMax: fp.xMax, yMin: H, yMax: H + pr, zMin: cz - 0.04, zMax: cz + 0.04 }, 0x8a7a6e);
  b.box('wood', { xMin: cx - 0.04, xMax: cx + 0.04, yMin: H, yMax: H + pr, zMin: fp.zMin, zMax: fp.zMax }, 0x8a7a6e);
  b.finish();
  return g;
}

function buildSign(mats, p, seed) {
  const { center, postRadius, height } = p.visual;
  const g = makeGroup(p.id, p.id);
  g.position.set(center.x, 0, center.z);
  const b = new Builder(g, mats, seed);
  b.add('wood', new THREE.CylinderGeometry(postRadius, postRadius, height, 8), 0, height / 2, 0, { tint: 0x8a7a6e });
  // Taulell: de la vora del pal cap al carrer (−X) fins a `boardWidth`.
  b.box('wood', { xMin: postRadius - SIGN.boardWidth, xMax: postRadius, yMin: SIGN.boardBottom, yMax: height, zMin: -SIGN.boardThick / 2, zMax: SIGN.boardThick / 2 }, 0xb0a090);
  b.box('plainD', { xMin: postRadius - SIGN.boardWidth, xMax: postRadius, yMin: SIGN.boardBottom - 0.03, yMax: SIGN.boardBottom, zMin: -0.04, zMax: 0.04 }, 0x2a282e);
  b.finish();
  return g;
}

function buildProps(mats, tex, parent) {
  const group = makeGroup('Props');
  PROPS.forEach((p, i) => {
    const seed = 5000 + i;
    switch (p.type) {
      case 'fountain': group.add(buildFountain(mats, p, seed)); break;
      case 'tree': group.add(buildTree(mats, tex, p, seed)); break;
      case 'bench': group.add(buildBench(mats, p, seed)); break;
      case 'barrelPair': {
        const g = makeGroup(p.id, p.id);
        p.visual.barrels.forEach((br, k) => g.add(makeBarrel(mats, br.id, br.center.x, br.center.z, br.radius, br.height, seed + k)));
        group.add(g);
        break;
      }
      case 'barrel': {
        const v = p.visual;
        group.add(makeBarrel(mats, p.id, v.center.x, v.center.z, v.radius, v.height, seed));
        break;
      }
      case 'crate': group.add(buildCrate(mats, p, seed)); break;
      case 'sign': group.add(buildSign(mats, p, seed)); break;
      default: fail(`${p.id}: tipus d'atrezzo desconegut '${p.type}'`);
    }
  });
  parent.add(group);
}

// ---------------------------------------------------------------------
// FANALS DE FERRO FORJAT: braç amb voluta, vidre càlid emissiu, halo suau
// ---------------------------------------------------------------------
const LANTERN = { arm: 0.04, link: 0.04, cap: 0.12, capR: 0.14, glass: 0.16, glassH: 0.26, ring: 0.02, base: 0.03 };

function buildLanterns(mats, tex, parent, options) {
  const group = makeGroup('Lanterns');
  const lights = [];
  const L = LANTERN;
  const iron = 0x2a282e;
  LIGHTS.forEach((lt, i) => {
    if (lt.type !== 'lantern') fail(`${lt.id}: tipus de llum desconegut '${lt.type}'`);
    const g = makeGroup(lt.id, lt.id);
    const b = new Builder(g, mats, 6000 + i);
    const M = lt.mountHeight;
    const { wallPoint: wp, glassPoint: gp } = lt;
    const dx = gp.x - wp.x; const dz = gp.z - wp.z;
    const len = Math.hypot(dx, dz);
    if (Math.abs(len - lt.armLength) > 1e-6) fail(`${lt.id}: armLength no coincideix amb wallPoint→glassPoint`);
    const rotY = Math.atan2(-dz, dx); // X local → direcció del braç
    const ux = dx / len; const uz = dz / len;
    const alongArm = (s) => [wp.x + ux * s, wp.z + uz * s];

    let [x, z] = alongArm(len / 2);
    b.add('plainD', new THREE.BoxGeometry(len, L.arm, L.arm), x, M - L.arm / 2, z, { rotY, tint: iron });
    [x, z] = alongArm(0.125);
    b.add('plainD', new THREE.BoxGeometry(0.354, 0.025, 0.025).rotateZ(Math.PI / 4), x, M - 0.125, z, { rotY, tint: iron }); // travesser
    [x, z] = alongArm(0.2);
    b.add('plainD', new THREE.TorusGeometry(0.07, 0.012, 4, 10, Math.PI * 1.5), x, M - 0.1, z, { rotY, tint: iron });        // voluta
    [x, z] = alongArm(0);
    b.add('plainD', new THREE.BoxGeometry(0.05, 0.22, 0.14), x, M - 0.08, z, { rotY, tint: iron });                           // placa a la paret

    const yLink0 = M - L.link; const yCap0 = yLink0 - L.cap; const yRing0 = yCap0 - L.ring;
    const yG1 = yRing0; const yG0 = yG1 - L.glassH; const yB0 = yG0 - L.base;
    const gx = gp.x; const gz = gp.z; const h = L.glass / 2 + 0.02; const gl = L.glass / 2;
    b.box('plainD', { xMin: gx - 0.01, xMax: gx + 0.01, yMin: yLink0, yMax: M, zMin: gz - 0.01, zMax: gz + 0.01 }, iron);
    b.add('plainD', new THREE.ConeGeometry(L.capR, L.cap, 4).rotateY(Math.PI / 4), gx, yCap0 + L.cap / 2, gz, { tint: iron });
    b.box('plainD', { xMin: gx - h, xMax: gx + h, yMin: yRing0, yMax: yCap0, zMin: gz - h, zMax: gz + h }, iron);
    b.box('plainD', { xMin: gx - h, xMax: gx + h, yMin: yB0, yMax: yG0, zMin: gz - h, zMax: gz + h }, iron);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // 4 muntants del fanal
      b.box('plainD', { xMin: gx + sx * gl - 0.012, xMax: gx + sx * gl + 0.012, yMin: yG0, yMax: yG1, zMin: gz + sz * gl - 0.012, zMax: gz + sz * gl + 0.012 }, iron);
    }
    // Vidre càlid emissiu (color del layout; MeshBasicMaterial: no depèn de la llum).
    const ge = gl - 0.012;
    b.box('lanternGlass', { xMin: gx - ge, xMax: gx + ge, yMin: yG0, yMax: yG1, zMin: gz - ge, zMax: gz + ge }, lt.glassColor);
    b.finish();

    const cy = (yG0 + yG1) / 2;
    if (options.glow && tex.glow) {
      const halo = new THREE.Sprite(mats.glow);
      halo.name = `${lt.id}-glow`;
      halo.position.set(gx, cy, gz);
      halo.scale.set(1.5, 1.5, 1);
      g.add(halo);
    }
    if (options.pointLights && lt.pointLight) {
      const pl = new THREE.PointLight(lt.glassColor, options.lightIntensity, options.lightDistance, 2);
      pl.name = `${lt.id}-light`;
      pl.position.set(gx, cy, gz);
      g.add(pl);
      lights.push(pl);
    }
    group.add(g);
  });
  parent.add(group);
  return lights;
}

// ---------------------------------------------------------------------
// DECORACIÓ: empedrat continu, terra als marges, molsa, heura i herba
// ---------------------------------------------------------------------
// Tot són plans fins amb alpha-test (vora dura, sense transparència suau) fusionats
// en 4 malles. Són purament visuals: no existeixen per a les col·lisions.
const IVY = [ // posicions de disseny (decoració): cara i desplaçament local sobre la cara
  { id: 'HA', face: 'south', x: 0.0, w: 0.9, h: 2.7 },
  { id: 'HC', face: 'north', x: 0.2, w: 1.0, h: 2.6 },
  { id: 'HB', face: 'north', x: -0.3, w: 0.9, h: 2.4 },
  { id: 'CH-T', face: 'south', x: 0.6, w: 1.0, h: 3.6 },
];

function wallById(id) {
  const w = WALLS.find((x) => x.id === id);
  if (!w) fail(`Mur '${id}' no trobat al layout`);
  return w.visual.footprint;
}

function nearProp(x, z, margin, ignoreId) {
  for (const p of PROPS) {
    if (p.id === ignoreId) continue;
    const c = p.collision;
    if (c.type === 'circle') { if (Math.hypot(x - c.cx, z - c.cz) < c.radius + margin) return true; }
    else if (x > c.xMin - margin && x < c.xMax + margin && z > c.zMin - margin && z < c.zMax + margin) return true;
  }
  return false;
}

// Punt dins d'un edifici o mur (excepte `excludeId`), útil per no deixar decoració dins de la pedra.
function insideSolid(x, z, excludeId) {
  for (const s of [...BUILDINGS, ...WALLS]) {
    if (s.id === excludeId) continue;
    for (const c of solidRects(s)) {
      if (x > c.xMin - 0.001 && x < c.xMax + 0.001 && z > c.zMin - 0.001 && z < c.zMax + 0.001) return true;
    }
  }
  return false;
}

// Coordenades de món d'un punt local d'un frame de cara.
function frameToWorld(f, xl, zl) {
  const c = Math.cos(f.rotY); const s = Math.sin(f.rotY);
  return [f.x + c * xl + s * zl, f.z - s * xl + c * zl];
}

function nearDoor(x, z, margin) {
  return DOORS.some((d) => Math.hypot(x - d.center.x, z - d.center.z) < margin);
}

const COBBLE_TILE = 8; // metres per rajola de la textura d'empedrat (128 px)

function addPavingDecal(parent, mats, rect) {
  const w = rect.xMax - rect.xMin; const d = rect.zMax - rect.zMin;
  if (!(w > 0 && d > 0)) fail('Rectangle d\'empedrat invàlid');
  const cx = (rect.xMin + rect.xMax) / 2; const cz = (rect.zMin + rect.zMax) / 2;
  const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  // UV segons la posició al món: el dibuix de les pedres continua sense talls
  // d'una zona empedrada a la veïna i no es reinicia a cada rectangle.
  const pos = geo.attributes.position; const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + pos.getX(i)) / COBBLE_TILE, (cz + pos.getZ(i)) / COBBLE_TILE);
  const m = new THREE.Mesh(geo, mats.cobble);
  m.name = 'Paving';
  m.position.set(cx, 0.02, cz);
  m.receiveShadow = true;
  parent.add(m);
}

function buildDecor(mats, parent) {
  const group = makeGroup('Decor');
  const b = new Builder(group, mats, 7000);
  const r = b.rnd;
  const P = PLAZA.bounds;

  // Zones empedrades, derivades dels murs del layout (cap coordenada nova).
  const street = { xMin: wallById('M-SO').xMax, xMax: wallById('M-SE').xMin, zMin: P.zMax, zMax: wallById('M-S2').zMin };
  const eastAlley = { xMin: P.xMax, xMax: wallById('M-E3').xMin, zMin: wallById('M-N1').zMax, zMax: wallById('M-E1').zMin };
  const westAlley = { xMin: wallById('M-W4').xMax, xMax: P.xMin, zMin: wallById('M-W3').zMax, zMax: wallById('M-W1').zMin };
  for (const rect of [P, street, eastAlley, westAlley]) addPavingDecal(group, mats, rect);

  // Terra natural NOMÉS en petites zones dels marges (a prop de parets, plantes i
  // vegetació). Mai sobre les zones transitables: l'empedrat és continu.
  const fnt = PROPS.find((p) => p.id === 'FNT');
  const earth = [0x4b4a3e, 0x434a38, 0x50493b, 0x3f4535]; // tons apagats, a prop de l'empedrat
  const marginPatch = (x, z) => {
    const m = 0.5; // semidiagonal d'un pla de 0,7 m girat
    if (nearProp(x, z, 0.5) || nearDoor(x, z, 1.4)) return;
    for (const [ox, oz] of [[0, 0], [m, m], [-m, m], [m, -m], [-m, -m]]) if (insideSolid(x + ox, z + oz, null)) return;
    const saved = b.frame; // x, z són coordenades de MÓN: apartem el frame local actiu
    b.setFrame(null);
    b.add('patch', new THREE.PlaneGeometry(0.7, 0.7).rotateX(-Math.PI / 2), x, 0.035, z, { rotY: r() * Math.PI, tint: jit(earth[Math.floor(r() * earth.length)], 0.06, r) });
    b.setFrame(saved);
  };

  // Molsa (parts baixes) i herba als marges de les façanes dels edificis.
  for (const building of BUILDINGS) {
    const fp = building.visual.footprint;
    for (const face of ALL_FACES) {
      const info = faceInfo(fp, face);
      if (faceBlocked(building, info)) continue;
      const bump = building.id === 'CH-T' && face === 'south' ? TOWER.southBump : 0;
      b.setFrame(info.frame);
      for (let k = 0; k < 3; k++) {
        const xl = (k - 1) * (info.len / 3) + (r() - 0.5) * 0.8;
        const mw = 0.9 + r() * 0.5;
        const [wx, wz] = frameToWorld(info.frame, xl, 0.1);
        const [ex1, ez1] = frameToWorld(info.frame, xl - mw / 2, 0.075);
        const [ex2, ez2] = frameToWorld(info.frame, xl + mw / 2, 0.075);
        if (nearDoor(wx, wz, 1.3) || nearProp(wx, wz, 0.25) || nearProp(ex1, ez1, 0.05) || nearProp(ex2, ez2, 0.05)) continue;
        if (insideSolid(ex1, ez1, building.id) || insideSolid(ex2, ez2, building.id)) continue;
        b.add('moss', new THREE.PlaneGeometry(mw, mw / 2), xl, mw / 4 + 0.02, 0.075 + bump, { tint: jit(0xffffff, 0.12, r) });
        if (r() < 0.8) {
          const s = 0.35 + r() * 0.2; const gx = xl + (r() - 0.5) * 0.8;
          const gz = 0.1 + s / 2 + bump; // el pla creuat no entra a la paret
          const [tx, tz] = frameToWorld(info.frame, gx, gz);
          if (!insideSolid(tx, tz, building.id) && !nearProp(tx, tz, 0.1) && !nearDoor(tx, tz, 1.3)) {
            b.add('grass', new THREE.PlaneGeometry(s, s * 0.9), gx, s * 0.45, gz, { tint: jit(0xffffff, 0.15, r) });
            b.add('grass', new THREE.PlaneGeometry(s, s * 0.9), gx, s * 0.45, gz, { rotY: Math.PI / 2, tint: jit(0xffffff, 0.15, r) });
            if (r() < 0.5) marginPatch(...frameToWorld(info.frame, gx, 0.55));
          }
        }
      }
      b.setFrame(null);
    }
  }

  // Molsa i herba a la base dels murs (a banda i banda).
  for (const w of WALLS) {
    const fp = w.visual.footprint;
    const longX = (fp.xMax - fp.xMin) > (fp.zMax - fp.zMin);
    const len = longX ? fp.xMax - fp.xMin : fp.zMax - fp.zMin;
    const n = Math.max(1, Math.round(len / 2.5));
    for (const face of longX ? ['south', 'north'] : ['east', 'west']) {
      for (let k = 0; k < n; k++) {
        const a0 = (longX ? fp.xMin : fp.zMin) + ((k + 0.5 + (r() - 0.5) * 0.6) * len) / n;
        const frame = faceFrame(fp, face, a0);
        b.setFrame(frame);
        const mw = 0.9 + r() * 0.5;
        const [m1x, m1z] = frameToWorld(frame, -mw / 2, 0.05);
        const [m2x, m2z] = frameToWorld(frame, mw / 2, 0.05);
        const [mcx, mcz] = frameToWorld(frame, 0, 0.05);
        if (!nearProp(mcx, mcz, 0.3) && !nearProp(m1x, m1z, 0.05) && !nearProp(m2x, m2z, 0.05) && !insideSolid(m1x, m1z, w.id) && !insideSolid(m2x, m2z, w.id)) {
          b.add('moss', new THREE.PlaneGeometry(mw, mw / 2), 0, mw / 4 + 0.02, 0.05, { tint: jit(0xffffff, 0.12, r) });
        }
        const s = 0.35 + r() * 0.25;
        const gz = 0.1 + s / 2;
        const [tx, tz] = frameToWorld(frame, 0.3, gz);
        const [t1x, t1z] = frameToWorld(frame, 0.3 - s / 2, gz);
        const [t2x, t2z] = frameToWorld(frame, 0.3 + s / 2, gz);
        if (r() < 0.75 && !nearProp(tx, tz, 0.3) && !nearDoor(tx, tz, 1.4)
          && !insideSolid(tx, tz, w.id) && !insideSolid(t1x, t1z, w.id) && !insideSolid(t2x, t2z, w.id)) {
          b.add('grass', new THREE.PlaneGeometry(s, s * 0.9), 0.3, s * 0.45, gz, { tint: jit(0xffffff, 0.15, r) });
          b.add('grass', new THREE.PlaneGeometry(s, s * 0.9), 0.3, s * 0.45, gz, { rotY: Math.PI / 2, tint: jit(0xffffff, 0.15, r) });
          if (r() < 0.5) marginPatch(...frameToWorld(frame, 0.3, 0.55));
        }
        b.setFrame(null);
      }
    }
  }

  // Herba al voltant de la font i de l'arbre (als marges, fora de la col·lisió).
  const tufts = (cx, cz, rMin, rMax, n, ignoreId, solidR) => {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2; const rr = rMin + r() * (rMax - rMin);
      const x = cx + Math.cos(a) * rr; const z = cz + Math.sin(a) * rr;
      if (nearProp(x, z, 0.15, ignoreId)) continue;
      const s = 0.35 + r() * 0.25;
      b.add('grass', new THREE.PlaneGeometry(s, s * 0.9), x, s * 0.45, z, { tint: jit(0xffffff, 0.15, r) });
      b.add('grass', new THREE.PlaneGeometry(s, s * 0.9), x, s * 0.45, z, { rotY: Math.PI / 2, tint: jit(0xffffff, 0.15, r) });
      if (rr >= solidR + 0.55 && r() < 0.5) marginPatch(x, z);
    }
  };
  tufts(fnt.collision.cx, fnt.collision.cz, fnt.collision.radius + 0.35, fnt.collision.radius + 0.85, 12, 'FNT', fnt.collision.radius);
  const tree = PROPS.find((p) => p.type === 'tree');
  if (tree) tufts(tree.collision.cx, tree.collision.cz, tree.collision.radius + 0.3, tree.collision.radius + 0.8, 6, tree.id, tree.collision.radius);

  // Heura en algunes façanes (franges verticals, sense exagerar).
  for (const iv of IVY) {
    const building = BUILDINGS.find((x) => x.id === iv.id);
    if (!building) fail(`Heura: l'edifici '${iv.id}' no existeix`);
    const info = faceInfo(building.visual.footprint, iv.face);
    if (faceBlocked(building, info)) continue;
    b.setFrame(info.frame);
    const bump = iv.id === 'CH-T' && iv.face === 'south' ? TOWER.southBump : 0;
    b.add('ivy', new THREE.PlaneGeometry(iv.w, iv.h), iv.x, iv.h / 2 + 0.1, 0.09 + bump, { tint: jit(0xffffff, 0.1, r) });
    b.setFrame(null);
  }

  b.finish();
  parent.add(group);
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
    textures: true,
    decor: true,
    glow: true,
    candleLight: true,       // UNA llum puntual càlida als ciris de l'altar (false = només sprites)
    houseLights: true,       // (Fase C) UNA llum càlida per estança de les cases A, B i C (4 en total; false = només flames)
    cobwebs: true,           // (Fase C.2) teranyines enganxades als interiors de les cases (false = sense)
    candleIntensity: 10,
    candleDistance: 9,
    ...options,
  };

  const tex = createTextures(opts.textures);
  const mats = createMaterials(tex);
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
  const doorHandles = {};
  buildDoors(mats, root, doorHandles);
  buildGate(mats, root);
  buildForest(mats, root);
  const furniture = buildFurniture(mats, root, opts);
  if (opts.cobwebs) buildCobwebs(mats, root);
  const houseLights = opts.houseLights ? buildInteriorLights(root) : [];
  const secretDoor = buildSecretDoor(mats, root);
  const churchLight = buildChurchDecor(mats, root, opts);
  buildProps(mats, tex, root);
  const lanternLights = buildLanterns(mats, tex, root, opts);
  if (opts.decor) buildDecor(mats, root);

  scene.add(root);

  // Tot és estàtic: calculem les matrius una vegada i deixem d'actualitzar-les.
  root.updateMatrixWorld(true);
  let meshes = 0; let triangles = 0;
  root.traverse((o) => {
    o.matrixAutoUpdate = !!o.userData.dynamic; // només les fulles de la porta (pivots) es mouen
    if (o.isMesh) {
      meshes += 1;
      const g = o.geometry;
      triangles += g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
    }
  });

  const stats = {
    buildings: BUILDINGS.length, walls: WALLS.length, props: PROPS.length,
    doors: DOORS.length, lanterns: LIGHTS.length, meshes, triangles: Math.round(triangles),
    pointLights: lanternLights.length,
  };

  function dispose() {
    root.removeFromParent();
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    Object.values(mats).forEach((m) => m.dispose());
    Object.values(tex).forEach((t) => { if (t) t.dispose(); });
  }

  // `doors`: control visual de les portes amb fulles mòbils ({ D1: { pivots, setAngles(oest, est) } }).
  // `puzzle`: control visual del primer puzle (només dibuixa; l'estat el calcula src/player/puzzle.js).
  const puzzle = {
    setSecretDoorProgress: secretDoor.setProgress,
    setKeyInserted: secretDoor.setInserted,
    setContainerProgress: furniture.handles.setContainer,
    setKeyVisible: furniture.handles.setKeyVisible,
  };
  return { root, lanternLights, interiorLights: [...(churchLight ? [churchLight] : []), ...houseLights], stats, doors: doorHandles, puzzle, dispose };
}
