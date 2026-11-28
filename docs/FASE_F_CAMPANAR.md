# FASE F — EL SECRET DEL CAMPANAR

## Resum
La clau KEY-BELLS (Fase E) obre una porta de bronze a la paret oest de l'església, just sota el campanar. Darrere hi ha una escala de cargol estreta (35 graons, 7,0 m, 1,75 voltes) que porta a la sala de les campanes (y = 7,0), amb tres campanes (petita, gran, mitjana) i tres cordes. L'ordre correcte és PETITA → GRAN → MITJANA, gravat sense text a la façana del mausoleu (a la dreta de la porta, d'esquerra a dreta).

## Decisions de disseny
- Porta a z −11,3 → −10,3 (el primer banc acaba a z −11,4): la fulla oberta (80°) no toca cap banc. La clau no es consumeix.
- Escala: columna central (radi 0,30) dins d'un cilindre de radi 1,30; anell de graons de 1,0 m. L'alçada és contínua al llarg de l'hèlix i es tria la volta més propera a l'alçada actual (`floors.js`, ganxo opcional `surfaces`; el comportament antic no canvia).
- Sala superior: el terra cobreix només l'arc on l'escala és ≥ 1,95 m per sota; la resta és el pou, amb barana de col·lisió.
- Cos del campanar: ja no és un bloc massís. Parets de 0,4 m amb lancetes i obertures reals (S, N, O); les campanes es veuen des de fora.
- `layout.js` no es toca (hashes). Les dades noves són a `belfryData.js`; `CH-T` i `CH-N-W` se substitueixen en carregar (`belfry.js`).
- Conseqüència narrativa: la ressonància ho deixa «resolt» (permanent i desat). No hi ha clau ni porta nova: no hi ha encara una Fase G que les necessiti; l'estat `solved` queda disponible com a requisit.
- Desat: camp opcional `belfry {doorOpen, solved}`; una partida antiga amb KEY-BELLS es carrega amb la porta tancada.

## Fitxers
Nous: `src/world/belfryData.js`, `src/player/belfry.js`, `tools/test-fase-f.js`.
Modificats: `src/main.js`, `src/world/village.js`, `src/player/puzzle.js`, `src/player/floors.js`, `src/game/saveGame.js`, `src/audio/cryptSounds.js`, `src/world/mausoleumData.js` (descripció de la clau) i les línies base de `tools/test-fase-d2/d3/d31.js` (el poble sol passa de 41.092 a ≤ 47.092 triangles; el campanar interior és un grup propi fora de `root`).

## Estat de la verificació
Provat amb Node (lògica real, col·lisions i terres reals): `node tools/test-fase-f.js` → 39 superades, 0 fallades. NO verificat en aquest entorn: geometria Three.js, animacions i so reals, aspecte en pantalla, `npm run build` i rendiment a l'iMac (sense `three`/Vite ni xarxa). Cal provar-ho al navegador.
