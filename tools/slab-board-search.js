// Fase E — Cerca (determinista) del tauler inicial del trencaclosques de les lloses.
// Construeix una solució amb un recorregut de 7 caselles entre l'entrada i la sortida, hi afegeix lloses «parany», desordena el tauler
// amb moviments legals (per tant, SEMPRE és resoluble) i en comprova per cerca exhaustiva (BFS) la solució més curta i el nombre de solucions.
// Ús: node tools/slab-board-search.js   (imprimeix el candidat que es copia a src/world/mausoleumData.js)
import { explore, SIZE, OPPOSITE, neighbor, movableCells, moveCell } from '../src/player/slabPuzzle.js';

const ENTRY = { cell: 0, side: 'W' }; const EXIT = { cell: 8, side: 'E' };
const SIDE_OF = (a, b) => (b === a + 1 ? 'E' : b === a - 1 ? 'W' : b === a + 3 ? 'S' : 'N');
const paths = [];
(function dfs(p) {
  const c = p[p.length - 1];
  if (c === 8) { if (p.length === 7) paths.push(p.slice()); return; }
  for (const s of ['N', 'E', 'S', 'W']) { const n = neighbor(c, s); if (n >= 0 && !p.includes(n)) { p.push(n); dfs(p); p.pop(); } }
})([0]);

let seed = 20261123; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const chan = (a, b) => [a, b].sort((x, y) => 'NESW'.indexOf(x) - 'NESW'.indexOf(y)).join('');
const found = [];
for (const path of paths) {
  const tiles = []; let enter = ENTRY.side;
  path.forEach((cell, k) => { const out = k === path.length - 1 ? EXIT.side : SIDE_OF(cell, path[k + 1]); tiles.push(chan(enter, out)); enter = OPPOSITE[out]; });
  for (const decoy of ['EW', 'NS', 'NE', 'ES', 'SW', 'NW']) {
    const symbolIdx = [1, 3, 5];                                                         // les lloses 2a, 4a i 6a del recorregut porten els símbols
    const defTiles = []; const goal = Array(9).fill(-1); let id = 0;
    path.forEach((cell, k) => { defTiles.push({ id, channels: tiles[k], symbol: symbolIdx.includes(k) ? ['bell', 'moon', 'cross'][symbolIdx.indexOf(k)] : undefined }); goal[cell] = id++; });
    const rest = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => !path.includes(c));            // 2 caselles lliures: una porta el parany i l'altra és el forat
    defTiles.push({ id, channels: decoy }); goal[rest[0]] = id;
    const def = { tiles: defTiles, symbols: ['bell', 'moon', 'cross'], entry: ENTRY, exit: EXIT, start: goal };
    for (let attempt = 0; attempt < 6; attempt++) {
      let cells = goal.slice(); let last = -1;
      for (let m = 0; m < 70 + attempt * 9; m++) { const opts = movableCells(cells).filter((i) => i !== last); const i = opts[Math.floor(rnd() * opts.length)]; last = cells.indexOf(-1); cells = moveCell(cells, i); }
      const r = explore(cells, def);
      if (r.shortest >= 18 && r.shortest <= 26) found.push({ def: { ...def, start: cells }, shortest: r.shortest, solutions: r.solutions.length, reachable: r.reachable, path });
    }
  }
}
found.sort((a, b) => b.solutions - a.solutions || a.shortest - b.shortest);
console.log(`${paths.length} recorreguts de 7 caselles; ${found.length} candidats`);
const best = found[0];
console.log(JSON.stringify({ shortest: best.shortest, solutions: best.solutions, reachable: best.reachable, path: best.path, start: best.def.start, tiles: best.def.tiles }));
