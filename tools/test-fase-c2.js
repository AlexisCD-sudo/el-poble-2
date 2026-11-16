// =====================================================================
// PROVES DE LA FASE C.2: catifes velles i teranyines            node tools/test-fase-c2.js   (necessita `three`)
// Prova la geometria, els colors de les textures (píxel a píxel) i la col·locació; NO prova l'aspecte en pantalla ni la GPU.
// =====================================================================
import * as THREE from 'three';
import { BUILDINGS, DOORS, FURNITURE, FLOORS, CANDLES, COBWEBS, INTERIOR_LIGHTS } from '../src/world/layout.js';
import { buildVillage, openWindowWorldList, paintRug, paintWeb, RUG_PALETTES, RUG_SIZES, WEB_CELL } from '../src/world/village.js';

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); } }
const expect = (c, m) => { if (!c) throw new Error(m); };
const bld = (id) => BUILDINGS.find((b) => b.id === id);
const EPS = 1e-6;

// ---------------------------------------------------------------------
console.log('\n1. Catifes velles');
// ---------------------------------------------------------------------
function rasterize(kind, seed, center) {
  const [w, h] = RUG_SIZES[kind]; const px = new Array(w * h).fill(null);
  paintRug((x, y, hex, a = 255) => { const xx = Math.floor(x); const yy = Math.floor(y); if (xx >= 0 && yy >= 0 && xx < w && yy < h) px[yy * w + xx] = { hex, a }; }, w, h, RUG_PALETTES[kind], seed, center);
  return { w, h, px };
}
const RUGS = { A: rasterize('A', 5101, true), B: rasterize('B', 5102, false), C: rasterize('C', 5103, true) };
const hsl = (hex) => {
  const r = ((hex >> 16) & 255) / 255; const g = ((hex >> 8) & 255) / 255; const b = (hex & 255) / 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2; const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hh = 0; if (d) { if (mx === r) hh = ((g - b) / d + 6) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; }
  return { h: hh * 60, s, l };
};
test('Cap píxel de cap catifa és rosa, magenta ni de color viu (to 285°–345° amb saturació, o saturació > 0,55)', () => {
  for (const [k, { px }] of Object.entries(RUGS)) for (const p of px) {
    if (!p) continue;
    const c = hsl(p.hex);
    expect(!(c.h >= 285 && c.h <= 345 && c.s > 0.12), `catifa ${k}: píxel ${p.hex.toString(16)} rosat/magenta (to ${c.h.toFixed(0)}°, s ${c.s.toFixed(2)})`);
    expect(c.s <= 0.55, `catifa ${k}: píxel ${p.hex.toString(16)} massa saturat (${c.s.toFixed(2)})`);
    const r = (p.hex >> 16) & 255; const g = (p.hex >> 8) & 255; const b = p.hex & 255;
    expect(!(r > g * 1.1 && b > g * 0.92 && r > 40), `catifa ${k}: píxel ${p.hex.toString(16)} té dominant rosat (r ${r}, g ${g}, b ${b})`);
  }
});
test('Colors apagats i foscos: luminositat ≤ 0,42 a tots els píxels i mitjana ≤ 0,25; to de cada catifa: A marró bordeus, B oliva, C marró grisenc', () => {
  for (const [k, { px }] of Object.entries(RUGS)) {
    const ls = px.filter(Boolean).map((p) => hsl(p.hex).l);
    expect(Math.max(...ls) <= 0.42, `catifa ${k}: píxel massa clar (${Math.max(...ls).toFixed(2)})`);
    expect(ls.reduce((a, b) => a + b, 0) / ls.length <= 0.25, `catifa ${k}: massa clara`);
  }
  const hue = (hex) => hsl(hex).h;
  expect(hue(RUG_PALETTES.A.base) < 30 || hue(RUG_PALETTES.A.base) > 350, `A: to ${hue(RUG_PALETTES.A.base)}`);
  expect(hue(RUG_PALETTES.B.base) > 55 && hue(RUG_PALETTES.B.base) < 90, `B: to ${hue(RUG_PALETTES.B.base)}`);
  expect(hue(RUG_PALETTES.C.base) > 20 && hue(RUG_PALETTES.C.base) < 50, `C: to ${hue(RUG_PALETTES.C.base)}`);
});
test('Aspecte gastat: vores esfilagarsades i serrells (píxels transparents o de serrell), forats i zones descolorides, motius geomètrics', () => {
  for (const [k, { w, h, px }] of Object.entries(RUGS)) {
    const total = w * h; const empty = px.filter((p) => !p).length;
    expect(empty / total > 0.04 && empty / total < 0.45, `catifa ${k}: ${(empty / total * 100).toFixed(0)}% transparent (vores/serrells/forats)`);
    const fringeRows = [0, 1, h - 2, h - 1]; let fringe = 0; for (const y of fringeRows) for (let x = 0; x < w; x++) if (px[y * w + x]) fringe++;
    expect(fringe > w * 0.5, `catifa ${k}: serrells ${fringe}`);
    let ragged = 0; for (let y = 2; y < h - 2; y++) if (!px[y * w] || !px[y * w + w - 1]) ragged++;
    expect(ragged >= 2, `catifa ${k}: vores laterals massa netes (${ragged})`);
    const used = new Set(px.filter(Boolean).map((p) => p.hex)); expect(used.size >= 25, `catifa ${k}: poca variació (${used.size} colors)`);
    const worn = px.filter((p) => p && hsl(p.hex).l > hsl(RUG_PALETTES[k].base).l * 1.2).length; expect(worn > total * 0.05, `catifa ${k}: sense zones descolorides (${worn})`);
  }
});
test('Les tres catifes són diferents entre elles (paleta i dibuix) i la gastada del centre (A, C) té el mig més descolorit que la B', () => {
  const key = (r) => r.px.map((p) => (p ? p.hex : 0)).join();
  expect(new Set(Object.values(RUGS).map(key)).size === 3, 'dues catifes idèntiques');
});

const scene = new THREE.Scene();
const village = buildVillage(scene, { houseLights: true });
scene.updateMatrixWorld(true);
const meshByName = (re) => { const out = []; village.root.traverse((o) => { if (o.isMesh && re.test(o.name)) out.push(o); }); return out; };
test('Mateixa posició i mida que abans: A 2,0×2,4 a (4,1; 12,0), B 1,7×2,1 a (4,1; 12,0), C 1,0×1,6 a (3,1; 11,3) sobre el forjat de dalt', () => {
  const want = { A: [2.0, 2.4, 4.1, 12.0, 0.036], B: [1.7, 2.1, 4.1, 12.0, 0.04], C: [1.0, 1.6, 3.1, 11.3, FLOORS.slabs[0].y + 0.012] };
  for (const [k, [sx, sz, cx, cz, y]] of Object.entries(want)) {
    const ms = meshByName(new RegExp(`HouseDecor-rug${k}$`)); expect(ms.length === 1, `catifa ${k}: ${ms.length} malles`);
    const box = new THREE.Box3().setFromObject(ms[0]); const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
    expect(Math.abs(s.x - sx) < 1e-3 && Math.abs(s.z - sz) < 1e-3 && Math.abs(c.x - cx) < 1e-3 && Math.abs(c.z - cz) < 1e-3 && Math.abs(box.min.y - y) < 1e-3, `catifa ${k}: ${s.x.toFixed(2)}×${s.z.toFixed(2)} a (${c.x.toFixed(2)}, ${c.z.toFixed(2)}) y ${box.min.y.toFixed(3)}`);
  }
});
test('Les catifes estan dins l\'interior de la casa C (no travessen cap paret) i no ocupen cap pas de porta', () => {
  const it = bld('HC').visual.interior.footprint;
  for (const k of ['A', 'B', 'C']) {
    const box = new THREE.Box3().setFromObject(meshByName(new RegExp(`HouseDecor-rug${k}$`))[0]);
    expect(box.min.x >= it.xMin && box.max.x <= it.xMax && box.min.z >= it.zMin && box.max.z <= it.zMax, `catifa ${k} fora de l'interior`);
  }
  const d4 = DOORS.find((d) => d.id === 'D4'); const a = new THREE.Box3().setFromObject(meshByName(/HouseDecor-rugA$/)[0]);
  expect(a.min.x > d4.center.x + 0.4, 'la catifa gran arriba al pas de D4');
});
test('Materials de catifa: Lambert amb alpha-test (vores esfilagarsades), amb textura pixel-art NearestFilter i cap color viu de reserva', () => {
  for (const k of ['A', 'B', 'C']) {
    const m = meshByName(new RegExp(`HouseDecor-rug${k}$`))[0].material;
    expect(m.type === 'MeshLambertMaterial' && m.alphaTest === 0.5, `${k}: ${m.type}/${m.alphaTest}`);
    expect(!m.map || m.map.magFilter === THREE.NearestFilter, `${k}: filtre ${m.map && m.map.magFilter}`);
    const c = hsl(m.color.getHex()); expect(c.s <= 0.55 && !(c.h >= 285 && c.h <= 345), `${k}: color de reserva ${m.color.getHexString()}`);
  }
});

// ---------------------------------------------------------------------
console.log('\n2. Teranyines');
// ---------------------------------------------------------------------
const ceilOf = (w) => { const b = bld(w.buildingId).visual.interior; return w.level === 1 ? b.upper.ceilingY : b.ceilingY; };
const floorOf = (w) => (w.level === 1 ? FLOORS.slabs[0].y : 0);
const corners = (q) => [[0, 0], [1, 0], [1, 1], [0, 1]].map(([i, j]) => [0, 1, 2].map((k) => q.o[k] + q.a[k] * q.sa * i + q.b[k] * q.sb * j));
const aabb = (q) => { const cs = corners(q); return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]))), max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]))) }; };
test('Distribució selectiva: 16 teranyines (A 4, B 4, C baix 3, C dalt 5); res de repetit, ≤ 5 per estança, amb 3 dibuixos i ambdues orientacions', () => {
  expect(COBWEBS.length === 16, `${COBWEBS.length}`);
  const per = {}; for (const w of COBWEBS) { const k = `${w.buildingId}${w.level}`; per[k] = (per[k] || 0) + 1; }
  expect(per.HA0 === 4 && per.HB0 === 4 && per.HC0 === 3 && per.HC1 === 5, JSON.stringify(per));
  expect(new Set(COBWEBS.map((w) => w.id)).size === COBWEBS.length, 'ids repetits');
  expect(new Set(COBWEBS.map((w) => w.variant)).size === 3 && COBWEBS.some((w) => w.flip) && COBWEBS.some((w) => !w.flip), 'poca varietat');
  const sizes = new Set(COBWEBS.map((w) => w.quads[0].sa.toFixed(2))); expect(sizes.size >= 6, `${sizes.size} mides diferents`);
  expect(COBWEBS.filter((w) => w.level === 1).length > COBWEBS.filter((w) => w.buildingId === 'HA').length, 'el dormitori hauria de tenir més teranyines');
});
test('Enganxades: cada rectangle és sobre una superfície real (paret interior, sostre, tapa d\'un moble) i dins dels seus límits; mai en suspensió', () => {
  for (const w of COBWEBS) {
    const it = bld(w.buildingId).visual.interior.footprint; const cy = ceilOf(w); const fy = floorOf(w);
    for (const q of w.quads) {
      const cs = corners(q); const bb = aabb(q);
      const inRoom = bb.min[0] >= it.xMin - EPS && bb.max[0] <= it.xMax + EPS && bb.min[2] >= it.zMin - EPS && bb.max[2] <= it.zMax + EPS && bb.min[1] >= fy - EPS && bb.max[1] <= cy + EPS;
      expect(inRoom, `${w.id}: surt de l'estança`);
      const ax = q.n.findIndex((v) => v !== 0); const flat = Math.max(...cs.map((c) => c[ax])) - Math.min(...cs.map((c) => c[ax]));
      expect(flat < EPS, `${w.id}: el rectangle no és pla sobre l'eix ${ax}`);
      const val = cs[0][ax];
      if (q.surface === 'ceiling') expect(Math.abs(val - cy) < EPS && q.n[1] === -1, `${w.id}: no és al sostre`);
      else if (q.surface === 'wall') {
        const walls = ax === 0 ? [it.xMin, it.xMax] : ax === 2 ? [it.zMin, it.zMax] : [];
        expect(walls.some((p) => Math.abs(p - val) < EPS), `${w.id}: cap paret interior a ${val} (eix ${ax})`);
        const into = ax === 0 ? (Math.abs(val - it.xMin) < EPS ? 1 : -1) : (Math.abs(val - it.zMin) < EPS ? 1 : -1);
        expect(q.n[ax] === into, `${w.id}: la normal no mira cap a dins`);
      } else if (q.surface === 'top') {
        const furn = FURNITURE.filter((m) => m.buildingId === w.buildingId && (m.level || 0) === w.level && Math.abs(fy + m.visual.height - val) < EPS && bb.min[0] >= m.collision.xMin - EPS && bb.max[0] <= m.collision.xMax + EPS && bb.min[2] >= m.collision.zMin - EPS && bb.max[2] <= m.collision.zMax + EPS);
        expect(furn.length >= 1, `${w.id}: la tapa no és sobre cap moble (y ${val})`);
      } else throw new Error(`${w.id}: superfície desconeguda`);
    }
  }
});
test('Les teranyines de paret dels mobles són per sobre del moble (no el travessen) i les de cantonada no travessen cap moble', () => {
  for (const w of COBWEBS) {
    for (const q of w.quads) {
      const bb = aabb(q);
      for (const m of FURNITURE) {
        if (m.buildingId !== w.buildingId || (m.level || 0) !== w.level) continue;
        const r = m.collision; const y0 = floorOf(w); const y1 = y0 + m.visual.height;
        const ov = (a, b, c, d) => Math.min(b, d) - Math.max(a, c) > 0.02;
        const hit = ov(bb.min[0] - 0.02, bb.max[0] + 0.02, r.xMin, r.xMax) && ov(bb.min[1], bb.max[1], y0, y1 - 0.005) && ov(bb.min[2] - 0.02, bb.max[2] + 0.02, r.zMin, r.zMax);
        expect(!hit, `${w.id} travessa ${m.id}`);
      }
    }
  }
});
test('No interfereixen amb finestres ni portes (marge 0,1 m): cap rectangle de paret se superposa a una finestra ni a una porta', () => {
  const marginOk = (lo1, hi1, lo2, hi2) => hi1 + 0.1 <= lo2 + 1e-9 || hi2 + 0.1 <= lo1 + 1e-9;
  for (const w of COBWEBS) {
    const b = bld(w.buildingId); const it = b.visual.interior.footprint; const fy = floorOf(w);
    const holes = []; // { plane axis, plane value, lo/hi along, ylo/yhi }
    for (const wl of openWindowWorldList(b)) {
      const isUp = wl.y > FLOORS.slabs[0].y + 0.5; if ((isUp ? 1 : 0) !== w.level && b.id === 'HC') continue; if (b.id !== 'HC' && isUp) continue;
      const horiz = wl.face === 'north' || wl.face === 'south';
      const plane = { north: it.zMin, south: it.zMax, east: it.xMax, west: it.xMin }[wl.face];
      const along = horiz ? wl.x : wl.z;
      holes.push({ ax: horiz ? 2 : 0, plane, lo: along - 0.45, hi: along + 0.45, ylo: wl.y - 0.55, yhi: wl.y + 0.55 });
    }
    for (const d of DOORS.filter((q) => q.buildingId === w.buildingId && q.house && w.level === 0)) {
      const horiz = d.face === 'north' || d.face === 'south'; const plane = { north: it.zMin, south: it.zMax, east: it.xMax, west: it.xMin }[d.face];
      const along = horiz ? d.center.x : d.center.z;
      holes.push({ ax: horiz ? 2 : 0, plane, lo: along - d.width / 2, hi: along + d.width / 2, ylo: 0, yhi: d.height || 2.2 });
    }
    for (const q of w.quads) {
      if (q.surface === 'ceiling') continue;
      const bb = aabb(q); const ax = q.n.findIndex((v) => v !== 0); const other = ax === 0 ? 2 : 0;
      for (const h of holes) {
        if (h.ax !== ax || Math.abs(bb.min[ax] - h.plane) > 0.05) continue;
        expect(marginOk(bb.min[other], bb.max[other], h.lo, h.hi) || marginOk(bb.min[1], bb.max[1], h.ylo + fy * 0, h.yhi), `${w.id}: se superposa a una obertura (finestra o porta) a ${h.plane}`);
      }
    }
  }
});
test('Sostre: no es superposen a les bigues ni al forat de l\'escala (la planta baixa de la casa C no té sostre sobre l\'escala)', () => {
  const hole = FLOORS.slabs[0].holes[0];
  for (const w of COBWEBS) {
    const it = bld(w.buildingId).visual.interior.footprint; const d = it.zMax - it.zMin;
    for (const q of w.quads) {
      if (q.surface !== 'ceiling') continue;
      const bb = aabb(q);
      for (let k = 1; k <= 3; k++) { const z = it.zMin + (d * k) / 4; expect(bb.max[2] < z - 0.09 - 0.01 || bb.min[2] > z + 0.09 + 0.01, `${w.id}: sobre la bigua z = ${z}`); }
      if (w.buildingId === 'HC' && w.level === 0) expect(bb.max[0] <= hole.xMin + EPS || bb.min[2] > hole.zMax || bb.max[2] < hole.zMin, `${w.id}: sobre el forat de l'escala`);
    }
  }
});
test('Lluny de les espelmes (≥ 0,35 m de qualsevol flama) i sense afegir llums: continuen 4 llums de casa + 1 de l\'església', () => {
  for (const w of COBWEBS) for (const q of w.quads) {
    const bb = aabb(q);
    for (const c of CANDLES.filter((c) => c.buildingId === w.buildingId && (c.level || 0) === w.level)) {
      const d = [0, 1, 2].map((k) => Math.max(bb.min[k] - [c.x, c.y + 0.2, c.z][k], 0, [c.x, c.y + 0.2, c.z][k] - bb.max[k]));
      expect(Math.hypot(...d) >= 0.3, `${w.id} a ${Math.hypot(...d).toFixed(2)} m de ${c.id}`);
    }
  }
  expect(INTERIOR_LIGHTS.length === 4 && village.interiorLights.length === 5, 'han canviat les llums');
  let lights = 0; village.root.traverse((o) => { if (o.isLight) lights++; });
  const lights0 = lights; expect(lights0 <= 10, `${lights0} llums a l'escena`);
});
test('Textura i material: atles 3×24 px, línies fines (< 30 % de píxels opacs), color gris polsós (no blanc brillant), translúcid, sense depthWrite, Lambert', () => {
  const [w, h] = [WEB_CELL * 3, WEB_CELL]; const px = new Array(w * h).fill(null);
  paintWeb((x, y, hex, a = 255) => { const xx = Math.floor(x); const yy = Math.floor(y); if (xx >= 0 && yy >= 0 && xx < w && yy < h) px[yy * w + xx] = { hex, a }; }, w, h);
  for (let c = 0; c < 3; c++) {
    let on = 0; for (let y = 0; y < h; y++) for (let x = c * WEB_CELL; x < (c + 1) * WEB_CELL; x++) if (px[y * w + x]) on++;
    expect(on > 30 && on / (WEB_CELL * WEB_CELL) < 0.3, `dibuix ${c}: ${on} píxels (${(on / WEB_CELL / WEB_CELL * 100).toFixed(0)}%)`);
  }
  const meshes = meshByName(/^Cobwebs-web$/); expect(meshes.length === 1, `${meshes.length} malles de teranyines (han de ser fusionades en una)`);
  const m = meshes[0].material;
  expect(m.type === 'MeshLambertMaterial' && m.transparent && m.opacity <= 0.65 && m.depthWrite === false && m.side === THREE.DoubleSide, `${m.type} transparent ${m.transparent} opacitat ${m.opacity}`);
  if (m.map) expect(m.map.magFilter === THREE.NearestFilter, 'textura suavitzada');
  const cols = meshes[0].geometry.getAttribute('color'); let maxC = 0; for (let i = 0; i < cols.count * 3; i++) maxC = Math.max(maxC, cols.array[i]);
  expect(maxC <= 0.85, `color de vèrtex massa blanc (${maxC.toFixed(2)})`);
});
test('Rendiment: una sola malla i una sola crida de dibuix; ≤ 100 triangles en total (16 teranyines); 0 partícules/llums noves; opció cobwebs:false les treu', () => {
  const meshes = meshByName(/^Cobwebs-web$/); const tri = meshes[0].geometry.getAttribute('position').count / 3;
  expect(tri <= 100 && tri === COBWEBS.reduce((a, w) => a + w.quads.length, 0) * 2, `${tri} triangles`);
  let particles = 0; village.root.traverse((o) => { if (o.isPoints) particles++; }); expect(particles === 0, 'hi ha partícules');
  const s2 = new THREE.Scene(); const v2 = buildVillage(s2, { houseLights: true, cobwebs: false });
  let found = false; v2.root.traverse((o) => { if (o.name === 'Cobwebs') found = true; });
  expect(!found, 'cobwebs:false no les ha tret'); v2.dispose();
  expect(village.stats.triangles < 60000, `${village.stats.triangles} triangles`);
});
test('Cap z-fighting entre els rectangles de teranyina i la superfície on s\'enganxen (separació de 1,2 cm) i cap rectangle coincident amb un altre', () => {
  const ps = [];
  for (const w of COBWEBS) for (const q of w.quads) ps.push({ id: w.id, bb: aabb(q), ax: q.n.findIndex((v) => v !== 0), n: q.n });
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i]; const b = ps[j]; if (a.id === b.id || a.ax !== b.ax) continue;
    const s = a.n[a.ax] === b.n[b.ax]; if (!s) continue;
    const planeD = Math.abs(a.bb.min[a.ax] - b.bb.min[b.ax]); if (planeD > 0.006) continue;
    const ov = [0, 1, 2].filter((k) => k !== a.ax).every((k) => Math.min(a.bb.max[k], b.bb.max[k]) - Math.max(a.bb.min[k], b.bb.min[k]) > 0.01);
    expect(!ov, `${a.id} i ${b.id} són coplanars i se solapen`);
  }
});

village.dispose();
console.log(`\nResum: ${passed} proves superades, ${failed} fallades.`);
process.exit(failed ? 1 : 0);
