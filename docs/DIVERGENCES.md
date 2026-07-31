# Écarts avec `docs/SPEC.md`

`CLAUDE.md` demande de signaler tout écart entre le code et le cahier des charges
plutôt que de deviner. Ce fichier les recense, avec la raison de chacun.

---

## 1. Pas de détourage des photos — écart majeur

**Spec :** sections 6 et 11 décrivent un détourage (`rembg`, puis après correction un
modèle WASM navigateur) avant l'intégration des photos dans le numéro.

**Réalité :** le maillot de référence fourni par le client
(`docs/reference/target-result.jpg`) n'utilise **aucun détourage**. Les photos sont des
rectangles entiers, empilés verticalement et découpés par la silhouette du chiffre. Le
fond de chaque photo (mur blanc, drap, fond gris) fait partie intégrante du visuel.

**Décision :** détourage retiré du pipeline.

Ce n'est pas seulement une simplification, c'est une correction : détourer les photos
percerait le chiffre de zones transparentes laissant apparaître le tissu du maillot, ce
qui casserait le rendu recherché. Le chiffre doit être plein.

**Conséquences :**

- dépendance `@imgly/background-removal` supprimée — elle est en **AGPL-3.0**, une
  licence copyleft réseau incompatible avec un site marchand propriétaire sans
  contrepartie. Le problème disparaît avec le besoin ;
- plus de téléchargement de 40 Mo de poids de modèle côté client ;
- plus de 2 à 8 s d'attente par photo ;
- les routes de rendu redeviennent du pur compositing Sharp.

Si un mode « détourage » est souhaité plus tard comme option produit, il devra être
réintroduit derrière un drapeau, avec un modèle sous licence permissive (BiRefNet MIT,
IS-Net Apache-2.0) — **jamais** BRIA RMBG, non commercial.

---

## 2. Sharp n'a pas de sortie `.pdf()`

**Spec initiale :** `sharp(...).pdf().toBuffer()`.

**Réalité :** Sharp n'encode que du raster. Le PDF est assemblé par `pdf-lib`
(`lib/print-pdf.ts`) à partir d'un PNG produit par Sharp. Corrigé dans la spec.

Deux pièges conservés en commentaire dans le code : `pdf-lib` n'embarque que PNG/JPEG
(jamais WebP), et les 300 dpi résultent du rapport pixels / taille physique, ils ne se
déclarent pas.

---

## 3. Dix-neuf kits réels au lieu de cinq kits fictifs

**Spec :** section 15, cinq kits (France, Spain, Germany, Brazil, UK) en placeholder.

**Réalité :** le client a fourni des photos produit réelles, par lots successifs. Elles
sont importées par `scripts/import-real-kits.ts` et cataloguées dans
`lib/kit-catalog.ts` : Portugal, Espagne, France, Angleterre, Brésil, Argentine et
États-Unis (domicile + extérieur pour chacun sauf le Portugal et l'Argentine côté
domicile), FC Barcelone, Real Madrid (+ extérieur), Paris Saint-Germain (+ extérieur).
Le générateur de placeholders SVG a été supprimé.

Le second lot est arrivé **avec les photos de dos**, ce qui lève l'écart §4 pour douze
des dix-neuf kits.

---

## 4. Mockups de dos dérivés des photos de face — levé pour 12 kits sur 19

> **État actuel.** Douze kits ont désormais une **vraie photo de dos** fournie par le
> client (champ `backMarker` dans `lib/kit-catalog.ts`) : Espagne, Espagne extérieur,
> Angleterre, Angleterre extérieur, Brésil, Brésil extérieur, Argentine extérieur,
> États-Unis, États-Unis extérieur, Real Madrid extérieur, PSG, PSG extérieur. Pour
> eux, `back.png` est la photo réelle et la zone d'impression est mesurée **sur le
> dos**, pas sur la face.
>
> Les sept autres (Portugal, Portugal extérieur, France, France extérieur, Argentine,
> FC Barcelone, Real Madrid) restent sur le mockup décrit ci-dessous, faute de photo de
> dos. C'est visible à l'œil sur la planche `npm run kits:board` : leur dos est une
> silhouette, pas une photo.

Le flocage se place au **dos** du maillot, mais les premières photos fournies étaient
des vues de face. Un mockup de face placerait le numéro sur la poitrine — faux.

Récupérer des photos de dos officielles sur le web est impossible depuis cet
environnement : la politique réseau refuse tout hôte hors registres de paquets (403 sur
CONNECT). Et utiliser des photos produit de marque sur un site marchand poserait de
toute façon une question de droits.

**Solution retenue :** `scripts/generate-back-mockups.ts` fabrique un dos par kit à
partir de la photo de face du client :

1. prélèvement d'une bande horizontale dans le torse (30–70 % de la largeur, 55–75 % de
   la hauteur) — sous l'écusson et le sponsor, hors des bras de mannequin ;
2. étirement vertical de cette bande dans une silhouette de dos. L'étirement vertical
   préserve les motifs verticaux : les rayures du Barça restent des rayures, les vagues
   du Portugal restent des vagues ;
3. col prélevé à sa position réelle, ombrage latéral, ourlet.

Le résultat garde la colorimétrie et le motif du maillot réel, et la géométrie de la
zone d'impression est exactement connue — ce qu'aucune photo trouvée ailleurs ne
garantirait. Les zones sont recentrées sur le dos par le même script.

**Quand de vraies photos de dos seront disponibles :** les déposer et relancer
`npm run kits:import`. Ne pas relancer `npm run kits:backs`, qui écraserait les vraies
photos par des mockups générés.

Piège rencontré au passage, documenté dans le code : `sharp().stats()` analyse l'image
d'entrée et **ignore** les opérations en attente du pipeline. Un `.extract().stats()`
renvoie les statistiques de l'image entière, fond blanc compris — d'où des couleurs
délavées et identiques d'un kit à l'autre. Il faut matérialiser l'extrait dans un buffer
avant de l'analyser.

Le même piège s'appliquait à `.metadata()` dans `import-real-kits.ts` :
`sharp(png).trim().metadata()` renvoyait 1200×1600, la taille du canevas d'entrée, et
non celle du vêtement détouré. La zone d'impression dégénérait donc en une fraction
constante du canevas, **identique pour tous les kits**, au lieu d'épouser la boîte du
vêtement. Corrigé en mesurant les pixels du canevas (`garmentBox()`), qui écarte au
passage le crochet du cintre : une ligne d'image ne compte comme vêtement que si elle
est large, ce qu'un crochet n'est jamais. Sans cela, la boîte démarrait en haut de
l'image et la zone remontait dans le col.

---

## 4 bis. Couleurs de flocage propres à chaque kit

La spec ne parle pas des couleurs du flocage ; une première version utilisait un
blanc + rouge générique pour les dix maillots. C'est faux, et pas seulement sur le plan
esthétique : une bordure blanche est **invisible** sur un Real Madrid ou un maillot
extérieur clair.

Chaque kit déclare donc sa paire dans `lib/kit-catalog.ts`, reportée dans
`metadata.flocking` à l'import :

- `primary` → remplissage du nom **et** bordure extérieure du numéro ;
- `secondary` → cerne du nom **et** liseré intérieur du numéro.

Deux couleurs suffisent parce que le maillot de référence les réutilise de façon croisée.
`renderJersey` les lit depuis le kit ; `DEFAULT_STYLE` ne sert plus que de repli, et une
surcharge explicite de l'appelant reste prioritaire.

Les paires sont choisies pour contraster avec le tissu du kit tout en restant dans la
palette de l'équipe (Portugal blanc/vert, Espagne jaune/navy, Barça jaune/navy, Real
Madrid navy/or, Brésil vert/bleu…). Elles restent des approximations à confirmer avec
l'atelier.

**Hauteur de flocage constante.** Le bloc nom est 1,6 fois plus large que la zone du
numéro — sur un vrai maillot le nom court d'une épaule à l'autre. La hauteur de lettre
est constante et les noms longs se **condensent** horizontalement jusqu'à 38 %, comme un
vrai flocage, au lieu de rétrécir. Sans cela « BELLINGHAM » faisait 36 px de haut contre
78 px pour « RODRI » (mesuré par `scripts/check-name-fit.ts`).

---

## 5. Zone d'impression : ajout de `width_mm` / `height_mm`

La spec ne donnait la `print_zone` qu'en pixels. Les pixels positionnent le visuel sur
le mockup, mais ne disent pas la taille physique imprimée — dont dépend la résolution
réelle du PDF. Chaque zone porte donc les deux, avec un rapport d'aspect identique
(vérifié à l'import).

---

## 6. Token admin : uniquement en variable d'environnement

**Spec :** la table `settings` porte une colonne `admin_token`, et la page de réglages
un champ pour l'éditer — alors que la section 7 dit que le token vit dans `ADMIN_TOKEN`.

**Décision :** la variable d'environnement est la seule source de vérité, la colonne
n'existe pas. Deux sources pour un même secret finissent par diverger, et un secret en
base est un secret de plus à protéger. Le champ correspondant a été retiré de la page
de réglages.

Ajouts par rapport à la spec, exigés par le formulaire de la section 10 :
`settings.iban_bic` et `settings.iban_holder`.

---

## 7. Nom et numéro vectorisés, pas de police système

**Spec :** `public/fonts/number-masks/` (fichiers SVG des numéros 0-99).

**Réalité :** une police d'affichage (`public/fonts/jersey-display.woff`, Archivo Black,
OFL) est convertie en chemins par `opentype.js`. Cela couvre les 100 numéros **et** les
noms arbitraires avec un seul asset.

Le runtime Vercel n'embarque quasiment aucune police : compter sur `font-family` dans
un SVG rendu par Sharp produirait silencieusement du vide en production. La
vectorisation supprime cette dépendance. `assertGlyphCoverage()` refuse explicitement un
caractère absent de la police, au lieu de laisser passer un `.notdef` — un maillot
imprimé avec des carrés à la place du nom.

Pour utiliser la police de flocage exacte d'un équipementier, déposer son fichier et
changer `FONT_FILE` dans `lib/glyphs.ts`.

---

## 8. Versions : Next.js 16, pas 15

La spec cite Next.js 15. Next 16 est la version stable courante (React 19.2), l'App
Router est inchangé sur ce qu'on utilise. TypeScript est resté en 5.9 plutôt qu'en 7.0
(compilateur natif encore jeune côté outillage).

---

## 9. Routes API : convention App Router

La spec liste `app/api/render/preview.ts`. L'App Router impose
`app/api/render/preview/route.ts`. Structure conservée, nommage adapté.

---

## 10. Trame demi-teinte et displacement map

- **Halftone :** Sharp n'a pas de filtre demi-teinte. `applyHalftone()` compose une
  grille de points SVG en `dest-in`. Le pas est **fixe**, non modulé par la luminance
  comme le serait une vraie trame AM. Désactivé par défaut (`halftone.size: 0`) : le
  visuel de référence n'est pas tramé.
- **Displacement map :** Sharp ne sait pas appliquer de displacement. L'effet « tissu »
  n'est pas implémenté ; il demanderait un remap pixel par pixel en `raw()` ou un rendu
  WebGL côté client.

---

## 11. Remplacement de tissu sur mannequin — actif

Le mannequin est photographié dans UN maillot, mais le client en choisit un autre. La
matière est donc remplacée dans la zone du vêtement, en réutilisant l'éclairage de la
photo (`lib/garment.ts`, masques par `scripts/build-garment-masks.ts`). Actif sur les
deux scènes via `"garmentMask"` dans leur `metadata.json`.

Trois obstacles ont été levés, tous tranchés par la mesure et non à l'œil :

1. **La segmentation du vêtement.** Aucun seuil de clarté ne peut isoler le fond : les
   bandes blanches d'un maillot se mesurent entre 233 et 255, le fond de studio entre
   246 et 253, les deux intervalles se chevauchent. Ce qui les sépare n'est pas la
   couleur mais la **connexité** — le fond touche le bord de l'image, une bande blanche
   non. Le masque part donc d'un remplissage depuis les bords, borné à l'ourlet : sans
   cette borne, le fond remonte la bande blanche par le short blanc et coupe le maillot
   en deux.
2. **Le masque ne découpait rien.** Il était composé en `dest-in`, qui multiplie les
   canaux ALPHA — or un PNG en niveaux de gris n'en a pas, le sien vaut 1 partout. Le
   tissu recouvrait donc la photo entière, décor et peau compris. Le masque est
   maintenant JOINT comme canal alpha (`joinChannel`).
3. **La couleur du maillot photographié teintait le maillot choisi.** Multiplier par la
   luminance brute donnait un Brésil olive sur un mannequin en maillot sombre. La carte
   d'éclairage est désormais RELATIVE à la luminance moyenne mesurée sous le masque, et
   son contraste est comprimé (`RELIEF = 0,45`) pour que l'imprimé d'origine — les
   vagues du maillot USA — ne transparaisse plus sous les couleurs du kit choisi.

Limites qui subsistent : le col et les bas de manches gardent leur teinte d'origine (le
masque s'arrête au col, ce qui vaut mieux qu'un débordement sur la peau et se lit comme
une finition contrastée) ; et le relief du tissu d'origine reste très légèrement
perceptible. Pour un rendu exact, il faut photographier le mannequin dans chaque
maillot (docs/ASSETS.md §2).
