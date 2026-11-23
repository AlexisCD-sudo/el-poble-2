# Fonts del joc (El Poble)

Des de la Fase D.6 el joc fa servir UNA SOLA tipografia: **Pixel Monastery Script**. Es carrega des del fitxer LOCAL `PixelMonasteryScript.woff`: el joc no necessita cap servei extern ni connexió a internet per mostrar-la.
Les fonts Gloock i Crimson Pro (SIL OFL 1.1) estan retirades del projecte: ja no s'utilitzen ni se'n distribueixen els fitxers.

## Pixel Monastery Script — NO és OFL
- Autor: Maroš Beťko (Betko), 2018. Tipus: Masaryk University Type Foundry — https://typefoundry.fi.muni.cz/pixel-monastery
- El fitxer només declara «Copyright (c) 2018 by Maroš Betko. All rights reserved.» i la pàgina de descàrrega no n'indica cap llicència d'ús.
- Decisió del projecte: ús en un joc de prova gratuït (itch.io, sense ingressos), AMB CRÈDIT visible a l'autor. Recomanat: demanar-li permís per escrit abans de publicar.
- Fitxers: `PixelMonasteryScript.woff` (conversió TTF→WOFF sense canviar-ne el disseny), `src/assets/title/el-poble-title.png` / `el-poble-ghost.png` (títol «El Poble») i `src/world/worldText.js` (mapes de bits del cartell i de les làpides, rasteritzats amb la font).
- Si l'autor no ho permet, s'ha de retirar la font, les imatges i `worldText.js` i triar una altra tipografia.
