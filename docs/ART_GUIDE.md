# THE FORGOTTEN VILLAGE — GUIA D'ART

**Document de direcció artística · Versió 1.0**
**Ubicació prevista al repositori:** `docs/ART_GUIDE.md`
**Document germà de:** `docs/PROJECT_BIBLE.md` (el Bible continua sent la font principal de veritat; aquesta guia el concreta visualment).

---

## 0. Abast i fonts

Aquesta guia s'ha elaborat a partir de **3 imatges de referència**. **No s'ha rebut cap vídeo**, tot i que el Bible el menciona. Si s'aporta, caldrà revisar aquesta guia.

**Llegenda d'etiquetes:**

- **[VIST]**: es veu clarament a les imatges.
- **[INTERPRETAT]**: s'intueix, però no és del tot clar.
- **[PROPOSTA]**: decisió de producció per fer-ho viable en 3D. Cal validar-la amb proves.

**Jerarquia de les referències.** Les imatges 1 i 3 (pixel-art nocturn) són la referència principal. La imatge 2 (poble amb boira) només s'usa per a la **boira, la profunditat i les teulades**. Conté elements que contradiuen el Bible, i es descarten a la secció 8.

---

## 1. Arquitectura (cases, carrers, edificis)

### 1.1 Cases (imatges 1 i 3)

- **[VIST]** Façanes de **pedra irregular clara** (gris/beix) amb la part baixa i les zones d'ombra molt fosques.
- **[VIST]** **Fusta fosca** als emmarcaments: llinda de fusta sobre la porta, ampit sortint a les finestres i bigues horitzontals.
- **[VIST]** Teulades de **teula terracota fosca** amb ràfec sortint, vistes només a les vores (cases de fons i cases a l'ombra).
- **[VIST]** Cases molt juntes i façanes planes, sense jardí ni separació. Els carrers són estrets.
- **[VIST]** Casa dreta de la imatge 1: **balcó de fusta** a la planta alta amb barana de barrots, i **escales de pedra** amb barana de ferro negre.
- **[INTERPRETAT]** Cases de 2 plantes. La imatge 3 mostra la finestra superior i la imatge 1 el balcó.
- **[PROPOSTA]** Les xemeneies no es veuen clarament a les imatges 1 i 3 (sí a la 2). Es mantenen perquè el Bible les demana, en poques cases.

### 1.2 Porta (imatge 3)

**[VIST]** Porta de fusta de taulons verticals, amb **dues tires de ferro horitzontals**, anella de ferro i dos esglaons de pedra. La llinda és més ampla que la porta.

### 1.3 Finestres

**[VIST]** Marc de fusta amb graella de vidres foscos: 2×2 a la imatge 1 i unes 3×2 a la imatge 3. Els vidres són **foscos i sense reflex ni llum interior**. A la imatge 1 hi ha porticons de fusta.

### 1.4 Església

- **[VIST]** Campanar **quadrat**, amb obertura d'arc i campana visible, i una **creu** al capdamunt.
- **[VIST]** Façana de pedra amb **porta d'arc de mig punt** de fusta fosca i una finestra petita.
- **[VIST]** A la imatge 3 l'església tanca el carrer. L'eix del carrer apunta cap al campanar.

---

## 2. Plaça central (imatge 1)

- **[VIST]** **Font de pedra** al centre, sense aigua visible. Té una conca baixa de perfil poligonal (sembla hexagonal o octogonal), un pedestal de **tres peces apilades** i una vora de pedres a terra amb herba.
- **[VIST]** Un **arbre caducifoli** fosc darrere la font, a l'esquerra.
- **[VIST]** L'**església** al fons a la dreta, amb el campanar sobresortint.
- **[VIST]** Cases al voltant amb sortides laterals de carrer, **banc** de fusta i **caixa** a la dreta, **barril** i escales a l'esquerra.
- **[PROPOSTA]** Mides aproximades de la plaça: **18 × 14 m**. La font queda a uns 12 m de la façana de l'església, perquè el campanar es vegi des de l'entrada del carrer. Aquestes mides són orientatives; s'ajustaran al greybox.

---

## 3. Materials, textures i colors

### 3.1 Descripció de les textures

- **Pedra de paret [VIST]:** no hi ha blocs amb junta dibuixada. És soroll de píxels clars i foscos agrupats en clústers de 2–4 píxels, amb variació de to per pedra.
- **Empedrat [VIST]:** pedres arrodonides irregulars, d'uns 4–6 texels, separades per **juntes fosques**. A les zones il·luminades hi ha **taques de molsa verda** (imatge 3).
- **Fusta [VIST]:** to marró fosc amb vetes verticals i les vores més clares (desgast).
- **Metall [VIST]:** negre quasi pla, amb un píxel de llum als cantells.

### 3.2 Paleta (aproximada, mostrejada a ull) [PROPOSTA]

| Element | Zona il·luminada | Zona fosca |
|---|---|---|
| Pedra de paret | #C9B79A / #A89878 | #3A3A48 (gris porpra) |
| Empedrat | #B8A888 | #2A2832 |
| Fusta | #7A5334 | #3B2818 |
| Teula | #6B3A2C | #2A1A1E |
| Heura | #5C6E2A / #7A8A30 | #1F2A1A |
| Metall | #2A282E | #121014 |
| Cel | #1B2A5A (a prop de la lluna) | #0B1230 |
| Lluna | #D8DCF0 | — |
| Vidre de fanal | #E8C98A | — |

**Regla [PROPOSTA]:** a les textures, la zona fosca no ha de passar de **#101018**. Als exemples no hi ha negre absolut, tal com demana el Bible.

---

## 4. Estil 3D low-poly amb pixel art

### 4.1 Observació important

**[VIST]** Les imatges de referència **no tenen una mida de píxel uniforme**: els píxels de la paret pròxima són molt més grans que els de l'església llunyana. En 3D això no es pot reproduir tal qual. Un joc renderitzat a baixa resolució té una mida de píxel fixa a pantalla, i les textures a distància es veuran més petites.

### 4.2 Decisions tècniques [PROPOSTA]

- **Resolució interna de render:** començar amb **480×270** (16:9) i escalar amb filtre *nearest*. Si queda massa fi, provar **320×180**. És la decisió amb més impacte visual: es prova aviat.
- **Densitat de textura (texel density):** **16 px per metre** per a tot (6,25 cm per texel). És equivalent a una porta d'1 m amb 16 texels d'amplada. Els objectes petits (fanal, barril) s'han de dibuixar amb detalls grossos, no amb més resolució.
- **Mides de tile:** empedrat 64×64 px (= 4 m), pedra de paret 64×64, fusta 32×64, teula 64×64.
- **Variació:** per evitar repeticions, usar diverses variants de tile i afegir variació amb colors de vèrtex (taques fosques a la base de les parets).
- **Filtratge:** *Nearest* a totes les textures. A Blender, el node d'imatge ha d'estar en **«Closest»**. Provar mipmaps només si la distància parpelleja.
- **Vores d'alfa:** heura i herba amb **alpha-test** (vora dura), mai amb transparència suau.

### 4.3 Geometria

Silueta clara amb **pocs polígons però amb detalls que sobresurten**: llindes, ampits, ràfecs, escales i balcons surten del pla de la paret. Això dona la sensació de «no cub» que demana el Bible.

---

## 5. Il·luminació nocturna, boira i ombres

### 5.1 Llum

- **Llanterna [VIST]:** la llum és **càlida crema** i crea un **bassal ample a terra i a la paret propera**, amb caiguda gradual i sense contorn de con dur.
  - **Atenció:** el Bible diu «llum clara», però les imatges mostren llum càlida.
  - **[PROPOSTA]** Color aproximat **#F0E0BC**, con ample (~40–50° exterior) amb penombra gran.
- **Lluna [VIST]:** disc visible al cel, il·luminació ambient **blava freda**. **[PROPOSTA]** Llum direccional molt baixa, elevada uns 35–45°, mateix color que el cel.
- **Fanals [VIST]:** els vidres es veuen càlids, però **no hi ha bassals de llum al voltant**. **[PROPOSTA]** Emissiu al vidre i una llum puntual feble només en 1–2 fanals clau.
- **Finestres [VIST]:** totes fosques.

### 5.2 Ombres

- **[VIST]** No hi ha ombres projectades dures. El volum ve de la il·luminació i de les zones fosques.
- **[PROPOSTA]** Ombra només de la llanterna, suau i de baixa resolució (encaixa amb el pixel). Per a l'oclusió ambiental, usar **colors de vèrtex pintats a Blender** a les cantonades i bases de paret.

### 5.3 Boira

- **[VIST]** A les imatges 1 i 3 la profunditat ve de la **foscor i la desaturació**, no d'una boira espessa. La imatge 2 mostra **boira per capes**: cada pla llunyà és més pàl·lid i blavós.
- **[PROPOSTA]** Boira de color **blau fosc (#12182E)**, coincident amb el cel. Densitat baixa: el campanar ha de ser visible des de l'entrada. Evitar el gris, perquè trencaria la paleta.

---

## 6. Vegetació, mobiliari i petits detalls

### 6.1 Vegetació

- **Heura [VIST]:** franges verticals irregulars sobre la pedra, de 0,3 a 0,6 m d'ample i fins a 2–3 m d'alçada. Mantenir-la **a la façana il·luminada** de les cases properes al carrer.
- **Herba [VIST]:** mates a la base de les parets i entre les pedres, de 0,3 a 0,5 m.
- **Arbre [VIST]:** caducifoli fosc amb copa arrodonida i tronc gruixut. A la imatge 3 hi ha fullatge dens en primer pla a l'esquerra.
- **Molsa [VIST]:** taques verdes sobre l'empedrat.

### 6.2 Mobiliari

- **Banc [VIST]:** respatller de llistons, seient de llistons, fusta fosca amb vores clares.
- **Caixa [VIST]:** fusta amb marc i travesser en creu.
- **Barril [VIST]:** fusta amb **2–3 cèrcols de ferro**.
- **Tanca [VIST, imatge 3]:** pals gruixuts amb dos travessers horitzontals.
- **Fanal [VIST]:** ferro forjat de paret amb braç i voluta decorativa, i llanterna de vidre amb teulada petita.
- **Garlanda de banderins [VIST, imatge 3]:** triangles taronja desgastats, penjats entre façanes a uns 4 m.

---

## 7. Ambientació i sensació d'abandonament

- **[VIST]** Cap persona, cap llum interior, portes i finestres tancades.
- **[VIST]** Caixes i barrils **deixats al lloc**, banderins que encara pengen.
- **[VIST]** El desgast és **natural** (heura, herba, molsa). **No hi ha runes, destrucció ni brutícia dramàtica.**
- **[PROPOSTA]** Mantenir aquesta línia: abandonament silenciós, no violent. Evitar parets esfondrades, sang o grafits.
- **[PROPOSTA]** El contrast clau és **llum càlida petita contra foscor blava gran**. Si la llanterna il·lumina massa, es perd la tensió.

---

## 8. Què NO agafar de les referències

De la imatge 2 es descarta, perquè **contradiu el Bible (medieval, pedra/fusta/teula)**:

- Cables elèctrics i pals de la llum.
- Parasols de cafè i quioscos moderns.
- Façanes de guix llis pàl·lid.
- Estàtua amb rètol i text superposat (és interfície d'un altre joc).
- Muntanyes i coníferes. Només si es vol un fons de bosc, i seria una decisió nova.
- Vista aèria: el nostre joc és en primera persona.

---

## 9. Especificacions dels models 3D (Prioritat 1 i 2 del Bible)

**Convencions globals [PROPOSTA]:** unitats en metres, graella modular de **2 m**, transformacions aplicades abans d'exportar, origen a la base, exportació GLB. Prefix de nom: `SM_` (malla estàtica), p. ex. `SM_Wall_Stone_Straight_2m`.

| Model | Mides (m) | Detalls obligatoris | Triangles aprox. |
|---|---|---|---|
| Mur de pedra recte | 2 × 2,8 × 0,4 | Cara exterior amb relleu de pedra, base lleugerament més ampla | 20–60 |
| Mur cantonada | 0,4 × 0,4 × 2,8 (+ braços) | Pedres alternes a la cantonada | 40–80 |
| Mur amb obertura de porta | 2 × 2,8 × 0,4 | Forat 1,0 × 2,0 | 40–80 |
| Porta de fusta | 1,0 × 2,0 | Taulons verticals, 2 tires de ferro, anella, llinda de fusta (1,4 d'ample) | 80–120 |
| Escales d'entrada | 1,4 × 0,6 × 0,3 | 2 esglaons (0,15 d'alçada) | 20 |
| Finestra amb porticons | 0,9 × 1,1 | Marc, 4–6 vidres foscos, ampit sortint 0,15 m, porticons oberts o tancats | 80–120 |
| Mòdul de teulada | 2 × 3 (pendent 30–35°) | Ràfec sortint 0,3 m, teula terracota | 40–100 |
| Xemeneia | 0,6 × 0,6 × 1,2 | Pedra, coronament sortint | 30 |
| **Casa petita muntada** | 6 × 5 m, 2 plantes (~5,4 m) | Combina els mòduls anteriors, 2–3 variants de façana | **≤ 1.500** |
| Casa amb balcó (prioritat 2) | 6 × 5 m | Balcó de fusta que sobresurt 1 m, barana de barrots, suports de biga | ≤ 2.000 |
| Empedrat (mòdul) | 4 × 4 | Ondulació suau (±3 cm), vora irregular | 200–400 |
| Fanal de paret | 0,4 × 0,5 braç | Braç de ferro amb voluta, llanterna de vidre, vidre emissiu | 100–150 |
| Barril | Ø 0,6 × 0,9 | 8 cares, panxa lleugera, 2–3 cèrcols de ferro | 80–120 |
| Caixa | 0,6 × 0,6 × 0,5 | Marc amb travesser en creu | 30–50 |
| Banc | 1,6 × 0,5 × 0,85 | Seient 0,45 m d'alçada, respatller de llistons | 100–150 |
| Tanca | mòdul 2 m, h 1,2 | Pals 0,2 × 0,2, 2 travessers | 50–60 |
| Font de pedra | Ø ~4 m, h ~1,8 | Vora de pedres, conca 0,6 m, pedestal de 3 peces, **sense aigua** | 500–800 |
| Església | façana ~8 m, campanar 4 × 4 m, h ~14 m | Porta d'arc 2,2 × 3,5, campana visible, creu | 3.000–4.500 |
| Arbre | h 5–7 m | Tronc gruixut, copa de 3–5 blocs arrodonits | 300–600 |
| Herba / heura | 0,3–0,5 m / franja 0,5 × 2,5 | Plans en creu amb alpha-test | 4–8 cada un |

*Els triangles són pressupostos orientatius; s'ajustaran a les proves de rendiment.*

---

## 10. Eines gratuïtes recomanades [PROPOSTA]

- **Blender**: models.
- **Aseprite** (de pagament) o alternatives gratuïtes **LibreSprite** o **Pixelorama**, i **Krita** per dibuixar les textures de píxel.
- **Pla de treball:** dibuixar primer els tiles d'empedrat, pedra de paret i fusta, i provar-los en una caixa a Three.js amb la resolució de 480×270 **abans** de modelar la resta. Si els píxels no es veuen bé, es canvia la resolució o la densitat.

---

## 11. Decisions pendents

1. **Resolució interna:** 480×270 (més detall) o 320×180 (més «chunky», més proper a les imatges).
2. **Color de la llanterna:** càlid crema (com les referències) o més clar i neutre (com diu literalment el Bible).
3. **Vídeo de referència:** no s'ha rebut. Si s'aporta, es revisarà aquesta guia.
