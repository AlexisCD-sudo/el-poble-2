// Fase E.2 — marques d'entrada/sortida, mural i tecla R (proves de lògica pura + comprovacions de text; sense Three.js real)
import fs from 'node:fs';
import { SLAB_PUZZLE, SLAB_MURAL, MAUSOLEUM } from '../src/world/mausoleumData.js';
import * as SP from '../src/player/slabPuzzle.js';
let pass = 0; let fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FALLA:', m); } };
const b = SLAB_MURAL.board;
ok(SP.validCells(b), 'mural: el tauler és una permutació vàlida');
ok(SP.isSolution(b, SLAB_PUZZLE), 'mural: el tauler del mural és una solució real');
const tr = SP.traceChannels(b, SLAB_PUZZLE.tiles, SLAB_PUZZLE.entry, SLAB_PUZZLE.exit);
ok(tr.path.join() === SLAB_MURAL.path.join(), 'mural: el recorregut coincideix amb el dels canals reals');
const symAt = {}; tr.path.forEach((c) => { const t = SLAB_PUZZLE.tiles.find((x) => x.id === b[c]); if (t.symbol) symAt[c] = t.symbol; });
ok(JSON.stringify(symAt) === JSON.stringify(SLAB_MURAL.symbols), 'mural: els símbols coincideixen amb els de la solució');
const r = SP.explore(SLAB_PUZZLE.start, SLAB_PUZZLE);
ok(r.solutions.some((s) => s.cells.join() === b.join()), 'mural: la solució del mural és assolible des de l\'inici (no és impossible)');
ok(SLAB_PUZZLE.start.join() === '5,0,4,3,6,-1,2,7,1', 'el tauler inicial no ha canviat');
ok(SLAB_MURAL.wallX === MAUSOLEUM.interior.xMax && SLAB_MURAL.zc === MAUSOLEUM.board.zc, 'mural: a la paret est, davant del tauler');
ok(SLAB_MURAL.erased > 0 && SLAB_MURAL.erased < 1, 'mural: parcialment esborrat');
// R reinicia
const p = SP.createSlabPuzzle(SLAB_PUZZLE); p.move(2); p.move(1);
ok(p.moves === 2 && p.cells.join() !== SLAB_PUZZLE.start.join(), 'abans de reset hi ha moviments');
p.reset(); ok(p.cells.join() === SLAB_PUZZLE.start.join() && p.moves === 0 && !p.solved, 'reset torna al tauler inicial');
// text
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
ok(/KeyR[^\n]*puzzle\.reset\(\)/.test(main), 'main.js: tecla R reinicia el puzle');
ok(main.split('\n').length < 1000, 'main.js < 1000 línies');
const vil = fs.readFileSync(new URL('../src/world/village.js', import.meta.url), 'utf8');
ok(/const fx = xw \+ 0\.11/.test(vil) && !/xMin: xw \+ 0\.02, xMax: xw \+ 0\.06/.test(vil), 'village.js: els solcs d\'entrada i sortida són sobre la cara del marc (no enterrats)');
ok(/MausoleumMural/.test(vil) && /paintMural/.test(vil), 'village.js: mural present');
console.log(`Fase E.2: ${pass} correctes, ${fail} fallides`); process.exit(fail ? 1 : 0);
