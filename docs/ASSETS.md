# Assets à fournir

Ce dépôt fonctionne aujourd'hui avec des assets provisoires. Voici précisément ce
qu'il faut pour passer en qualité production, et où le déposer.

---

## 1. Photos de dos des maillots — priorité haute

**Pourquoi :** le flocage se place au dos. Les dix photos actuellement en
catalogue sont des vues de face ; les dos sont pour l'instant **fabriqués** à
partir d'elles (`scripts/generate-back-mockups.ts`). Ils gardent la couleur et le
motif réels, mais ce ne sont pas des photos.

**À fournir :** une photo de dos par maillot, cadrée comme la photo de face.

| Critère | Attendu |
| --- | --- |
| Cadrage | maillot entier, de dos, centré, à plat ou sur mannequin |
| Fond | uni et clair de préférence (la détection du vêtement est plus fiable) |
| Résolution | 1200 px de large minimum |
| Format | JPG ou PNG |
| Nommage | un identifiant reconnaissable du kit dans le nom de fichier |

**Comment les intégrer :**

```bash
npx tsx scripts/import-real-kits.ts <dossier-des-photos>
```

Puis mettre à jour `sourceMarker` dans `lib/kit-catalog.ts` si le nom de fichier
change. **Ne pas relancer `npm run kits:backs`** après cela : ce script écraserait
les vraies photos par des mockups générés.

---

## 2. Mises en situation portées — homme et femme

**Ce que c'est :** l'aperçu montre le maillot personnalisé **porté par une
personne réelle** au lieu d'être posé à plat. Le mécanisme est déjà implémenté
(`lib/scenes.ts`) : il s'active dès qu'une scène est déposée, sans modification
de code. Aucune scène n'étant présente, le builder n'affiche pas l'option.

### Photos à prendre

| Critère | Attendu |
| --- | --- |
| Cadrage | personne **de dos**, buste et dos entièrement visibles |
| Posture | debout, épaules à peu près horizontales, dos face à l'objectif |
| Maillot porté | uni et clair, **sans flocage existant** (il resterait visible sous le nôtre) |
| Éclairage | diffus, sans ombre forte en travers du dos |
| Résolution | 1500 px de haut minimum |
| Quantité | au moins une femme et un homme ; plusieurs morphologies est un plus |

Point important : la couleur du maillot porté sur la photo **ne suit pas** la
sélection du client. Deux options :

- **scène neutre** (`kitSlug: null`) : une seule paire de photos homme/femme,
  utilisée pour tous les kits. L'aperçu est alors indicatif sur la couleur mais
  juste sur le flocage. C'est le meilleur rapport effort/résultat pour démarrer.
- **scène par kit** (`kitSlug: "portugal"`) : le mannequin porte réellement ce
  maillot. Rendu exact, mais il faut deux photos par kit (20 au total).

### Structure à créer

```
public/scenes/
├── woman-neutral/
│   ├── photo.jpg
│   └── metadata.json
└── man-neutral/
    ├── photo.jpg
    └── metadata.json
```

`metadata.json` :

```json
{
  "id": "woman-neutral",
  "label": "Femme — studio",
  "gender": "woman",
  "photo": { "width": 1200, "height": 1600 },
  "quad": [
    { "x": 430, "y": 520 },
    { "x": 770, "y": 512 },
    { "x": 778, "y": 966 },
    { "x": 424, "y": 974 }
  ],
  "kitSlug": null,
  "blendOpacity": 0.94
}
```

`quad` = les quatre coins de la zone de flocage sur le dos, **en pixels de la
photo**, dans l'ordre haut-gauche, haut-droit, bas-droit, bas-gauche. C'est un
quadrilatère et non un rectangle parce qu'un dos réel n'est jamais parfaitement
de face : les quatre points permettent de suivre l'inclinaison des épaules.

Pour relever les coordonnées : ouvrir la photo dans n'importe quel éditeur
d'image et lire la position du curseur aux quatre coins de la zone où le flocage
doit apparaître.

**Limite technique assumée :** Sharp ne sait pas appliquer de transformation
perspective. Le quad est approché par une rotation et une mise à l'échelle
(`quadPlacement()`), ce qui suffit tant que le mannequin est photographié à peu
près de face. Un dos très incliné ou de trois-quarts demanderait une homographie
pixel par pixel, ou un rendu WebGL côté client.

---

## 3. Police de flocage officielle — optionnel

Le nom et le numéro utilisent Archivo Black (`public/fonts/jersey-display.woff`),
une approximation libre des polices de flocage. Pour le rendu exact d'un
équipementier : déposer le fichier de police dans `public/fonts/` et changer
`FONT_FILE` dans `lib/glyphs.ts`.

La police doit couvrir les chiffres, les capitales latines et les accents
FR/ES/DE/IT. `assertGlyphCoverage()` refuse tout caractère manquant plutôt que
d'imprimer un rectangle vide à la place.

---

## 4. Couleurs de flocage — à confirmer

Chaque kit déclare sa paire de couleurs dans `lib/kit-catalog.ts`
(`flocking.primary` / `flocking.secondary`). Les valeurs actuelles sont choisies
pour contraster avec le tissu de chaque maillot, dans la palette de l'équipe,
mais elles n'ont pas été validées avec l'atelier. À confirmer avant la première
production.
