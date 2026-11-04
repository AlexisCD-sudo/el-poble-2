# THE FORGOTTEN VILLAGE — PROJECT BIBLE

**Document de disseny i producció · Versió 1.0**  
**Estat:** document inicial; les decisions es poden revisar durant el prototipatge.

## 1. Visió del projecte

The Forgotten Village és un joc d'exploració 3D en primera persona ambientat en un poble europeu medieval abandonat. El jugador arriba al poble de nit i l'explora amb una llanterna de mà. L'experiència ha de transmetre solitud, misteri i tensió ambiental, sense dependre inicialment de combats ni d'acció ràpida.

L'objectiu principal de la primera versió és construir un espai petit però creïble, bonic i completament explorable. La qualitat i la coherència visual tenen prioritat sobre la mida del mapa.

## 2. Pilares de disseny

1. **Exploració lliure:** el jugador pot recórrer una xarxa de carrers connectats i tornar a la plaça central.
2. **Atmosfera:** nit, boira lleugera, silenci, sons llunyans i contrast entre foscor i llum.
3. **Llanterna protagonista:** el feix de llum guia la mirada i revela detalls de l'entorn.
4. **Món coherent:** arquitectura, materials i objectes han de semblar part del mateix poble.
5. **Producció modular:** reutilitzar peces i conjunts d'objectes en lloc de modelar cada edifici des de zero.

## 3. Direcció artística

### 3.1 Estil

- Entorn 3D low-poly amb formes llegibles i siluetes clares.
- Textures pixel-art modernes, amb píxel visible i una resolució coherent entre actius.
- Arquitectura medieval/europea de pedra, fusta i teula.
- No buscar realisme fotogràfic: conservar una aparença estilitzada i artesanal.
- Evitar l'aspecte de primitives sense acabar o d'un escenari fet només amb cubs.

### 3.2 Paleta i llum

- Ambient general nocturn blau-gris, amb llum de lluna freda.
- Llum càlida i escassa als fanals o finestres puntuals.
- Llanterna amb llum clara, focalitzada i amb caiguda gradual.
- Boira subtil per donar profunditat; no ha d'impedir veure ni jugar.
- Ombres suaus quan el rendiment ho permeti.
- Evitar saturació excessiva i negres absoluts que facin impossible orientar-se.

### 3.3 Materials

- Pedra irregular en murs, paviment i font.
- Fusta envellida a portes, porticons, carros i balcons.
- Teules de terracota fosca.
- Metall fosc als fanals, frontisses i ferratges.
- Vegetació apagada, molsa i heura en zones humides.

Les textures han de compartir escala de píxel, contrast i nivell de detall. Cal provar-les en moviment i a la distància real de càmera, no només en primer pla.

## 4. Referències visuals aportades

Les imatges i el vídeo de referència compartits a la conversa defineixen aquests objectius:

- Plaça de poble amb font de pedra, església/campanar i façanes de pedra al voltant.
- Carrerons estrets i empedrats, amb cases molt properes, portes i finestres de fusta.
- Teulades inclinades de teula, estructures de fusta, fanals, carros i objectes abandonats.
- Herba i vegetació que creixen entre les pedres i a les parets.
- Vista en primera persona amb llanterna visible i un feix de llum que recorre les façanes.
- Boira i llum nocturna que oculten parcialment el poble i creen profunditat.

**Regla:** aquestes referències són una guia d'atmosfera i llenguatge visual, no una ordre de copiar exactament cada fotograma. El mapa final ha de ser coherent i jugable.

## 5. Disseny del món i mapa inicial

El mapa es construirà al voltant d'una plaça central amb carrers connectats. La distribució exacta s'ajustarà durant el greybox.

### Zones

1. **Entrada del poble:** carretera d'arribada, cotxe del protagonista, cartell i primeres cases.
2. **Carrer principal:** via empedrada que condueix cap a la plaça; façanes, fanals i accessos laterals.
3. **Plaça central:** font, bancs, església i diverses sortides cap als carrers.
4. **Carrerons:** passos estrets, arcs, escales i racons foscos.
5. **Zona residencial:** cases abandonades; alguns interiors podran ser accessibles en fases posteriors.
6. **Església i cementiri:** fita visual important i zona d'exploració posterior.
7. **Perifèria i bosc:** camins que surten del poble, arbres, vegetació i boira.

### Regles de navegació

- La plaça ha de funcionar com a punt de referència fàcil de reconèixer.
- Els carrers han de connectar entre si; evitar un recorregut estrictament lineal.
- Cal combinar espais oberts i trams estrets per variar el ritme.
- Els límits del mapa s'han d'integrar amb murs, cases, bosc, pendents o boira, no amb barreres invisibles evidents.
- El jugador no ha de quedar atrapat en geometria ni poder travessar parets.

## 6. Inventari d'actius 3D

### Prioritat 1 — kit de prototip

- Mòduls de mur de pedra recte, cantonada i tram amb obertura.
- Una casa modular petita amb variants de façana.
- Porta de fusta i finestra amb porticons.
- Mòduls de teulada i xemeneia.
- Tram de carrer empedrat i vorera irregular.
- Fanal de paret o de carrer.
- Barril, caixa i banc.
- Vegetació bàsica: herba, arbust i arbre.

### Prioritat 2 — identitat de la plaça

- Font de pedra.
- Església amb campanar i porta principal.
- Cases de dues plantes i balcó de fusta.
- Carro de fusta.
- Tanques, senyals i mobiliari addicional.

### Prioritat 3 — ampliació

- Peces del cementiri, làpides i reixes.
- Variants de cases i interiors.
- Més arbres, heura, molsa i plantes.
- Objectes narratius i elements misteriosos.
- Personatges i habitants del poble.

### Convencions dels models

- Aplicar transformacions abans d'exportar.
- Origen i escala coherents; utilitzar metres com a referència de treball.
- Noms clars i consistents per a objectes i materials.
- Geometria tan simple com sigui possible sense perdre la silueta.
- Reutilitzar materials i malles quan sigui convenient.
- Exportar en GLB/ glTF per integrar a Three.js.
- Mantenir els actius agrupats per categoria i amb noms descriptius.

## 7. Tecnologia i arquitectura

### Stack previst

- Three.js per al renderitzat 3D.
- JavaScript amb ES modules.
- Vite com a servidor de desenvolupament i eina de build.
- Blender per al modelatge i exportació GLB.
- GitHub per al control de versions.
- GitHub Pages per a la publicació web.

### Estructura orientativa

```text
el-poble-2/
├── public/
│   ├── models/
│   ├── textures/
│   └── audio/
├── src/
│   ├── main.js
│   ├── world/
│   │   ├── village.js
│   │   ├── buildings.js
│   │   └── environment.js
│   ├── player/
│   │   ├── controls.js
│   │   ├── collisions.js
│   │   └── flashlight.js
│   └── systems/
│       ├── lighting.js
│       └── audio.js
├── docs/
│   └── PROJECT_BIBLE.md
├── index.html
├── package.json
└── vite.config.js
```

Aquesta estructura és orientativa. No s'han de crear tots aquests fitxers buits per avançat: cada mòdul s'afegirà quan tingui una responsabilitat real.

### Requisits de joc inicials

- Càmera en primera persona.
- Controls WASD i ratolí; Pointer Lock per mirar al voltant.
- Moviment amb acceleració o velocitat estable, gravetat i col·lisions.
- Llanterna activable/desactivable, amb tecla configurable (proposta inicial: F).
- Il·luminació nocturna, boira i ambient sonor bàsic.
- Disseny adaptable a navegador d'escriptori.

## 8. Renderitzat pixel-art

- Definir una resolució interna baixa i escalar-la sense suavitzat quan sigui viable.
- Evitar que el filtratge de textures difumini els píxels; provar `NearestFilter` per a textures pixel-art.
- Mantenir una escala de textura coherent entre actius.
- Evitar línies fines o detalls massa petits que parpellegin en moviment.
- Provar el resultat amb la càmera caminant, girant i mirant objectes a diferents distàncies.
- No afegir postprocessament que destrueixi la lectura dels píxels.

## 9. So i ambientació

Primera fase: vent suau, ambient nocturn, passes sobre pedra i so de la llanterna o equipament si escau. Més endavant: portes, fusta que cruix, campanes llunyanes, sons del bosc i senyals sonors associats als habitants.

El so ha de ser discret i espacial quan sigui possible. Evitar música constant que trenqui la sensació de solitud.

## 10. Habitants i elements de terror

No són necessaris per al primer prototip. Quan s'afegeixin:

- Siluetes llegibles a distància i disseny coherent amb el món.
- Comportament senzill i fiable abans d'afegir IA complexa.
- Una primera mecànica possible: figures que s'allunyen o desapareixen quan el jugador les il·lumina.
- No sobrecarregar el mapa de personatges; el misteri depèn també de l'absència.

## 11. Fases i criteris d'acceptació

### Fase 0 — Preparació

- Repositori GitHub inicialitzat amb README.
- Aquest document guardat a `docs/PROJECT_BIBLE.md`.
- Estructura mínima del projecte acordada.

**Acceptació:** document disponible al repositori i decisions principals visibles.

### Fase 1 — Greybox jugable

- Escenari provisional amb entrada, carrer, plaça i sortides.
- Jugador en primera persona amb moviment i mirada.
- Col·lisions bàsiques i límits del mapa.

**Acceptació:** es pot caminar per la zona sense travessar edificis ni quedar encallat.

### Fase 2 — Primer kit artístic

- Substituir les formes provisionals per models propis de pedra, fusta, teulada i paviment.
- Afegir font, fanals i vegetació bàsica.

**Acceptació:** el carrer i la plaça tenen una identitat visual coherent amb les referències.

### Fase 3 — Il·luminació i ambient

- Llanterna funcional i llegible.
- Lluna/llum ambiental, fanals, boira i primer àudio.

**Acceptació:** el jugador pot orientar-se i la llum crea una atmosfera consistent sense ocultar el camí.

### Fase 4 — Ampliació del poble

- Església, més carrers, cases, bosc i cementiri.
- Interiors seleccionats.

**Acceptació:** mapa connectat, navegable i amb punts de referència clars.

### Fase 5 — Habitants i experiència

- Afegir figures misterioses i esdeveniments senzills.
- Polir interaccions i sons.

**Acceptació:** existeix un petit bucle d'exploració amb moments de tensió.

### Fase 6 — Optimització i publicació

- Revisar rendiment, càrrega d'actius i errors de navegador.
- Configurar Vite per al subdirectori de GitHub Pages (`/el-poble-2/`).
- Provar la versió publicada.

**Acceptació:** el joc es carrega des de GitHub Pages i és jugable en un navegador d'escriptori.

## 12. Organització del treball amb IA

Claude (pla gratuït) es pot utilitzar per consultar, redactar codi i generar instruccions, però no s'ha de donar per fet que pot editar directament el repositori o executar Claude Code. El flux inicial serà manual i controlat:

1. Demanar a ChatGPT o Claude una tasca petita i concreta.
2. Revisar els fitxers o canvis proposats.
3. Aplicar-los al repositori només després d'entendre què es modificarà.
4. Provar el resultat abans de passar a la tasca següent.
5. Fer commits petits amb missatges descriptius.

No demanar a cap agent que reescrigui tot el projecte quan només cal modificar un mòdul. No fer canvis massius sense còpia/commit previ.

## 13. Regles de col·laboració i qualitat

- Treballar una fase cada vegada; no avançar si el criteri d'acceptació no es compleix.
- Abans de modificar fitxers existents, inspeccionar-ne el contingut.
- No substituir funcionalitats que ja funcionen sense explicar el motiu.
- No afegir dependències innecessàries.
- Mantenir el projecte executable després de cada canvi.
- Explicar quins fitxers s'han creat o modificat i com provar-los.
- No publicar ni fer push remot sense autorització explícita de l'usuari.
- Si hi ha dubtes de disseny, prioritzar aquest document i les referències visuals aportades; proposar canvis abans d'aplicar-los.

## 14. Primer objectiu concret

Construir una primera secció jugable formada per **un carrer empedrat que desemboca a una plaça petita**, amb dues o tres cases modulars, un fanal, una font provisional i la llanterna en primera persona. Aquesta secció serà la prova de qualitat visual i tècnica abans d'ampliar el poble.

**No començar pels habitants, missions ni un mapa enorme. Primer cal aconseguir que caminar per aquest carrer de nit sigui convincent.**
