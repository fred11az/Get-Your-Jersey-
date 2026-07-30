# Assets à fournir

Ce dépôt fonctionne aujourd'hui avec des assets provisoires. Voici précisément ce
qu'il faut pour passer en qualité production, et où le déposer.

---

## 1. Photos de dos des maillots — sept kits restants

**Pourquoi :** le flocage se place au dos. Douze kits sur dix-neuf ont maintenant
une vraie photo de dos, fournie par le client. Les sept autres gardent un dos
**fabriqué** à partir de la face (`scripts/generate-back-mockups.ts`) : la couleur
et le motif sont réels, mais la silhouette est synthétique et cela se voit.

**Encore à fournir :** Portugal, Portugal extérieur, France, France extérieur,
Argentine, FC Barcelone, Real Madrid.

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

Puis renseigner dans `lib/kit-catalog.ts` le `sourceMarker` (face) et le
`backMarker` (dos) du kit — ce sont des fragments de nom de fichier. C'est le
`backMarker` qui bascule un kit du mockup généré à la vraie photo, et qui fait
mesurer la zone d'impression sur le dos. **Ne pas relancer `npm run kits:backs`**
après cela : ce script écraserait les vraies photos par des mockups générés.

**Une photo à remplacer :** celle de face d'Argentine extérieur est la seule prise
contre un mur, avec le cintre visible, au lieu du studio sur fond blanc des
autres. Le fond est ramené au blanc à l'import (`whitenBackdrop` dans le
catalogue), ce qui la rend présentable en grille, mais une vraie prise de vue
produit serait mieux.

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

### Animation — mannequin en mouvement

L'aperçu peut être **animé** : le mannequin marche, se balance ou bouge les bras,
et le flocage suit son dos image par image. C'est implémenté
(`components/builder/WornPlayer.tsx`) et vérifié avec une séquence de
démonstration visible dans le builder (« Porté — homme »).

**Comment ça marche :** la composition est faite dans le **navigateur**, en
canvas. Composer une cinquantaine d'images côté serveur prendrait une quinzaine
de secondes par aperçu, à refaire au moindre changement de configuration, et
dépasserait le budget d'une fonction Vercel. Côté client, les images sont
téléchargées une fois puis mises en cache : le coût serveur est nul et le rendu
instantané.

**Ce qu'il faut filmer :**

| Critère | Attendu |
| --- | --- |
| Durée | 2 à 4 s, en boucle naturelle (le premier et le dernier geste se raccordent) |
| Caméra | **fixe**, sur pied. Un mouvement de caméra rend le suivi bien plus lourd |
| Sujet | de dos, qui s'éloigne, se balance, ou bouge les bras |
| Fond | uni, sans passage de personnes |
| Cadence | 24 ou 30 i/s ; on n'en garde que 12 à 16 pour la boucle |
| Résolution | 1080 px de haut minimum |

**Ce qui marche bien et ce qui ne marche pas :**

- ✅ **marcher en s'éloignant**, balancement d'épaules, bras qui bougent : le dos
  reste face à l'objectif, le suivi est fiable et le rendu convaincant ;
- ⚠️ **rotation sur soi-même à 360°** : passé une quarantaine de degrés, le dos
  n'est plus face à l'objectif. Une approximation par rotation et échelle ne
  suffit plus, le visuel glisserait hors du dos. Ces images doivent être marquées
  `visible: false` — le flocage y disparaît, ce qui est le comportement réel
  puisque le dos n'est plus visible. Une vraie déformation en perspective
  demanderait WebGL.

**Traitement :** extraire les images avec `ffmpeg`, puis renseigner le `quad` de
chacune. En pratique on annote une image sur quatre et on interpole — un
balancement est régulier.

```bash
ffmpeg -i video.mp4 -vf fps=12,scale=-1:960 public/scenes/<id>/frame-%02d.jpg
```

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

Ajouter un bloc `sequence` pour animer (voir `public/scenes/demo-walk/` pour un
exemple complet généré par `scripts/generate-demo-scene.ts`).

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
photo**, dans l'ordre haut-gauche, haut-droit, bas-droit, bas-gauche. La zone
couvre **le nom ET le numéro** : le lecteur ne pose qu'une image par
quadrilatère, et le serveur lui fournit les deux réunis. C'est un
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

