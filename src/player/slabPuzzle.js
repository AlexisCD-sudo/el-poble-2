// =====================================================================
// THE FORGOTTEN VILLAGE — TRENCACLOSQUES DE LES LLOSES (Fase E, matemàtiques pures, sense Three.js ni DOM)
// =====================================================================
// TAULER 3 × 3: 8 lloses i 1 forat. Cada llosa té dos canals gravats (recta: N-S o E-O; angular: dos costats consecutius) i NO es pot girar.
// Una llosa només es mou cap al forat si hi és ADJACENT (mai en diagonal ni a través d'altres lloses).
// VALIDACIÓ: no es compara amb cap disposició fixa. Es SEGUEIX el recorregut real des de l'entrada: cada llosa ha de tenir un canal obert al
//   costat per on s'hi entra, el recorregut surt pel seu altre canal cap a la veïna, i així fins a la sortida. Ha de travessar els tres
//   símbols. Qualsevol disposició que ho compleixi és una solució (n'hi pot haver diverses).
// ÍNDEX D'UNA CASELLA: fila * 3 + columna (fila 0 = dalt, columna 0 = esquerra, mirant el tauler de cara). Forat = -1 a `cells`.
// =====================================================================

export const SIZE = 3;
export const SIDES = ['N', 'E', 'S', 'W'];
export const OPPOSITE = { N: 'S', E: 'W', S: 'N', W: 'E' };
const STEP = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const VALID_PAIRS = new Set(['NS', 'EW', 'NE', 'ES', 'SW', 'NW']);   // N-S i E-O (rectes) + 4 angulars

export const rowOf = (i) => Math.floor(i / SIZE);
export const colOf = (i) => i % SIZE;

// Comprova que la definició (tiles + inici) és coherent. Llança un Error descriptiu si no ho és.
// def = { tiles: [{ id, channels: 'EW', symbol? }], start: [9 ids o -1], entry: { cell, side }, exit: { cell, side }, symbols: ['bell',...] }
export function validateDef(def) {
  if (!def || !Array.isArray(def.tiles) || def.tiles.length !== SIZE * SIZE - 1) throw new Error('Calen exactament 8 lloses');
  const ids = new Set();
  for (const t of def.tiles) {
    if (!Number.isInteger(t.id) || t.id < 0 || t.id > 7 || ids.has(t.id)) throw new Error(`Llosa amb id invàlid o repetit: ${t.id}`);
    ids.add(t.id);
    if (!VALID_PAIRS.has(t.channels)) throw new Error(`Canals invàlids a la llosa ${t.id}: "${t.channels}" (cal un parell com NS, EW, NE, ES, SW o NW)`);
  }
  if (!Array.isArray(def.start) || def.start.length !== SIZE * SIZE) throw new Error('El tauler inicial ha de tenir 9 caselles');
  const seen = new Set();
  for (const v of def.start) { if (v !== -1 && !ids.has(v)) throw new Error(`Llosa inexistent al tauler inicial: ${v}`); if (seen.has(v)) throw new Error(`Llosa repetida al tauler inicial: ${v}`); seen.add(v); }
  if (!seen.has(-1)) throw new Error('El tauler inicial no té forat');
  for (const e of [def.entry, def.exit]) if (!e || !(e.cell >= 0 && e.cell < 9) || !SIDES.includes(e.side)) throw new Error('Entrada o sortida invàlida');
  const onBoard = def.tiles.filter((t) => t.symbol).map((t) => t.symbol).sort().join();
  if (onBoard !== [...def.symbols].sort().join()) throw new Error('Els símbols gravats a les lloses no coincideixen amb els símbols obligatoris');
  return true;
}

export const neighbor = (i, side) => {
  const r = rowOf(i) + STEP[side][0]; const c = colOf(i) + STEP[side][1];
  return r < 0 || r >= SIZE || c < 0 || c >= SIZE ? -1 : r * SIZE + c;
};
export const blankIndex = (cells) => cells.indexOf(-1);
// La llosa de la casella `i` es pot moure? (només si la casella és adjacent al forat)
export function canMove(cells, i) {
  if (!(i >= 0 && i < 9) || cells[i] === -1) return false;
  const b = blankIndex(cells);
  return Math.abs(rowOf(i) - rowOf(b)) + Math.abs(colOf(i) - colOf(b)) === 1;
}
// Retorna les caselles de les lloses que es poden moure ara (2, 3 o 4).
export const movableCells = (cells) => { const out = []; for (let i = 0; i < 9; i++) if (canMove(cells, i)) out.push(i); return out; };
// Mou la llosa de la casella `i` al forat. Retorna el NOU tauler (cells és immutable) o null si el moviment no és legal.
export function moveCell(cells, i) {
  if (!canMove(cells, i)) return null;
  const b = blankIndex(cells); const next = cells.slice(); next[b] = cells[i]; next[i] = -1; return next;
}

// Segueix els canals des de l'entrada. Retorna { path: [caselles], symbols: [símbols travessats], complete, reason }.
//   complete = el recorregut arriba a la sortida pel costat correcte; `reason` explica on es talla si no.
export function traceChannels(cells, tiles, entry, exit) {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const path = []; const symbols = []; const visited = new Set();
  let cur = entry.cell; let enter = entry.side;
  for (let guard = 0; guard < 20; guard++) {
    const id = cells[cur];
    if (id === -1) return { path, symbols, complete: false, reason: 'forat' };
    if (visited.has(cur)) return { path, symbols, complete: false, reason: 'bucle' };
    const tile = byId.get(id);
    if (!tile.channels.includes(enter)) return { path, symbols, complete: false, reason: 'tancat' };
    visited.add(cur); path.push(cur); if (tile.symbol) symbols.push(tile.symbol);
    const out = tile.channels[0] === enter ? tile.channels[1] : tile.channels[0];
    if (cur === exit.cell && out === exit.side) return { path, symbols, complete: true, reason: '' };
    const nxt = neighbor(cur, out);
    if (nxt < 0) return { path, symbols, complete: false, reason: 'vora' };
    cur = nxt; enter = OPPOSITE[out];
  }
  return { path, symbols, complete: false, reason: 'bucle' };
}

// Un tauler és una solució si el recorregut arriba a la sortida i travessa TOTS els símbols obligatoris.
export function isSolution(cells, def) {
  const t = traceChannels(cells, def.tiles, def.entry, def.exit);
  return t.complete && def.symbols.every((s) => t.symbols.includes(s));
}

const key = (cells) => cells.join(',');
// Exploració completa (BFS) de tots els taulers assolibles des de `cells` amb moviments legals.
// Retorna { reachable (nombre d'estats), solutions: [{cells, moves}], shortest: moviments mínims fins a una solució o -1, path: caselles de les lloses a moure, en ordre }.
export function explore(cells, def, { limit = 400000 } = {}) {
  const seen = new Map([[key(cells), null]]);
  let frontier = [cells]; let depth = 0; let shortest = -1; let firstPath = null; const solutions = [];
  const pathTo = (k) => { const out = []; let cur = k; while (seen.get(cur)) { const p = seen.get(cur); out.push(p.cell); cur = p.from; } return out.reverse(); };
  const record = (c) => { if (isSolution(c, def)) { solutions.push({ cells: c, moves: depth }); if (shortest < 0) { shortest = depth; firstPath = pathTo(key(c)); } } };
  record(cells);
  while (frontier.length && seen.size < limit) {
    depth++; const next = [];
    for (const c of frontier) {
      const ck = key(c);
      for (const i of movableCells(c)) {
        const n = moveCell(c, i); const nk = key(n);
        if (seen.has(nk)) continue;
        seen.set(nk, { from: ck, cell: i });       // `cell` = casella on era la llosa que es mou (després hi queda el forat)
        next.push(n); record(n);
      }
    }
    frontier = next;
  }
  return { reachable: seen.size, solutions, shortest, path: firstPath };
}

// ---------------------------------------------------------------------
// Estat de joc: lloses, moviments, resolució i il·luminació progressiva dels canals.
// ---------------------------------------------------------------------
export function createSlabPuzzle(def, mech = {}) {
  validateDef(def);
  const litSeconds = mech.litSeconds !== undefined ? mech.litSeconds : 0.45;   // retard entre una llosa i la següent en il·luminar-se
  let cells = def.start.slice(); let moves = 0; let solved = false; let glowT = 0; let path = [];
  const listeners = [];
  const emit = (type, data) => { for (const f of listeners) f(type, data); };
  const api = {
    def,
    get cells() { return cells.slice(); },
    get moves() { return moves; },
    get solved() { return solved; },
    get path() { return path.slice(); },
    onEvent(f) { listeners.push(f); },
    canMove: (i) => !solved && canMove(cells, i),
    // Mou la llosa de la casella `i`. Retorna { ok, from, to } o { ok:false }. En resoldre's el tauler queda bloquejat.
    move(i) {
      if (solved) return { ok: false };
      const n = moveCell(cells, i); if (!n) return { ok: false };
      const to = blankIndex(cells); cells = n; moves++;
      emit('move', { from: i, to });
      if (isSolution(cells, def)) { solved = true; glowT = 0; path = traceChannels(cells, def.tiles, def.entry, def.exit).path; emit('solved', { path: path.slice() }); }
      return { ok: true, from: i, to };
    },
    // Lloses il·luminades: la 1a (l'entrada) a t = 0, i una més cada `litSeconds`. Retorna el nombre (pot ser fraccionari: 0..path.length).
    litCount() { return !solved ? 0 : Math.min(path.length, glowT / litSeconds); },
    glowDone() { return solved && glowT >= path.length * litSeconds; },
    glowSeconds() { return path.length * litSeconds; },
    update(dt) { if (solved) glowT += dt; },
    reset() { cells = def.start.slice(); moves = 0; solved = false; glowT = 0; path = []; },
    // Desar / carregar: només el tauler (les lloses mai es giren). Un tauler resolt es restaura amb la il·luminació acabada.
    snapshot() { return { cells: cells.slice(), moves }; },
    restore(s) {
      cells = s.cells.slice(); moves = s.moves | 0; solved = isSolution(cells, def);
      path = solved ? traceChannels(cells, def.tiles, def.entry, def.exit).path : []; glowT = solved ? path.length * litSeconds : 0;
    },
  };
  return api;
}

// Valida un tauler desat: ha de ser una permutació de les 8 lloses + forat (si no, l'estat és corrupte).
export function validCells(cells) {
  if (!Array.isArray(cells) || cells.length !== 9) return false;
  const want = [-1, 0, 1, 2, 3, 4, 5, 6, 7].join(); return [...cells].sort((a, b) => a - b).join() === want;
}
// Un tauler és assolible des de l'inicial si la paritat de la permutació és la mateixa (invariant del puzle de 8 amb forat).
// Aquí el forat pot acabar en qualsevol casella: la paritat de la permutació (comptant el forat com a peça 8) més la distància del forat a la seva casella original ha de ser parell.
export function reachableFrom(start, cells) {
  const perm = (c) => c.map((v) => (v === -1 ? 8 : v));
  const a = perm(start); const b = perm(cells);
  const pos = new Map(a.map((v, i) => [v, i])); const p = b.map((v) => pos.get(v));   // p[i] = casella inicial de la peça que ara és a i
  let inv = 0; for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) if (p[i] > p[j]) inv++;
  const bi = start.indexOf(-1); const bj = cells.indexOf(-1);
  const dist = Math.abs(rowOf(bi) - rowOf(bj)) + Math.abs(colOf(bi) - colOf(bj));
  return (inv + dist) % 2 === 0;
}
