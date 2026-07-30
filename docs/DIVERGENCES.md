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

## 3. Dix kits réels au lieu de cinq kits fictifs

**Spec :** section 15, cinq kits (France, Spain, Germany, Brazil, UK) en placeholder.

**Réalité :** le client a fourni dix photos produit réelles. Elles sont importées par
`scripts/import-real-kits.ts` et catalogées dans `lib/kit-catalog.ts` : Portugal (+
extérieur), Espagne (+ extérieur), France (+ extérieur), Brésil, Argentine, FC
Barcelone, Real Madrid. Le générateur de placeholders SVG a été supprimé.

---

## 4. Mockups de dos dérivés des photos de face

Le flocage se place au **dos** du maillot, mais les dix photos fournies sont des vues de
face. Un mockup de face placerait le numéro sur la poitrine — faux.

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
