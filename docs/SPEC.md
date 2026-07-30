# GetYourJersey.com - Prompt de Développement Complet pour Claude Opus

## 1. CONTEXTE & OBJECTIF

Tu es un développeur full-stack senior spécialisé en architectures modernes et scalables.

**Ton objectif :** Construire un MVP complet d'une plateforme e-commerce de personnalisation de maillots de football avec aperçu par IA (via Sharp, pas d'API générative).

**Site :** getyourjersey.com
**Marchés cibles :** Europe + USA uniquement
**Objectif business :** Générer du trafic et des ventes rapidement pour valider le marché
**Déploiement :** Vercel + PostgreSQL Vercel

---

## 2. STACK TECHNIQUE

- **Frontend :** Next.js 15 (App Router) + TypeScript
- **Styling :** Tailwind CSS (blanc, bleu/orange primaires)
- **Backend :** Next.js API Routes (Node.js)
- **Base de données :** PostgreSQL Vercel
- **Image processing :** Sharp (compositing) + pdf-lib (PDF 300 dpi) côté serveur ;
  détourage WASM/WebGPU côté navigateur (voir sections 6 et 11)
- **Multilangue :** next-intl (FR, EN, ES, DE, IT)
- **Auth admin :** Token simple (variable d'environnement)
- **Déploiement :** Vercel (avec Vercel Postgres)
- **Envs :** .env.local (local), variables d'environnement Vercel (prod)

---

## 3. SCHÉMA DE BASE DE DONNÉES

```sql
-- CONFIG
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  iban TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  whatsapp_template TEXT DEFAULT 'Bonjour, je veux cette commande...',
  admin_token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- COMMANDES
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Données client
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  
  -- Détails commande
  language TEXT NOT NULL DEFAULT 'en',
  kit_slug TEXT NOT NULL,
  kit_tier TEXT NOT NULL, -- supporter, authentique, joueur
  size TEXT NOT NULL,
  jersey_name TEXT NOT NULL,
  jersey_number TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  
  -- Design
  design_json JSONB NOT NULL, -- {photos: [urls des PNG RGBA détourés], layout: {...}}
  render_preview_url TEXT, -- aperçu WebP
  render_pdf_url TEXT, -- PDF 300dpi production
  
  -- Statut
  status TEXT DEFAULT 'PENDING', -- PENDING | PAID | SENT_TO_PRINTER | SHIPPED
  whatsapp_sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ANALYTICS
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL, -- STEP_1_VIEWED, STEP_2_SELECTED, CLICK_PREVIEW, CLICK_ORDER, etc.
  order_id UUID REFERENCES orders(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- INDEX
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created ON events(created_at DESC);
```

---

## 4. STRUCTURE DE FICHIERS

```
getyourjersey/
├── app/
│   ├── [locale]/
│   │   ├── page.tsx (Home)
│   │   ├── layout.tsx
│   │   ├── builder/
│   │   │   ├── page.tsx (Le builder en 6 étapes)
│   │   │   └── layout.tsx
│   │   └── checkout/
│   │       ├── page.tsx (Récapitulatif + paiement)
│   │       └── confirmation/page.tsx
│   ├── api/
│   │   ├── render/
│   │   │   ├── preview.ts (Sharp: aperçu WebP)
│   │   │   └── pdf.ts (Sharp: export PDF 300dpi)
│   │   ├── orders/
│   │   │   ├── create.ts
│   │   │   ├── [id]/status.ts
│   │   │   └── export.ts (récupère design JSON)
│   │   ├── settings/
│   │   │   ├── get.ts
│   │   │   └── update.ts (protégé par token)
│   │   └── auth/
│   │       └── verify-token.ts
│   ├── admin/
│   │   ├── page.tsx (Dashboard)
│   │   ├── settings/page.tsx
│   │   └── layout.tsx (avec vérification token)
│   └── middleware.ts (routing multilingue + auth admin)
│
├── components/
│   ├── builder/
│   │   ├── Step1KitSelection.tsx
│   │   ├── Step2TierSelection.tsx
│   │   ├── Step3Details.tsx
│   │   ├── Step4PhotoUpload.tsx
│   │   ├── Step5Preview.tsx
│   │   ├── Step6Checkout.tsx
│   │   └── ProgressBar.tsx
│   ├── admin/
│   │   ├── OrdersTable.tsx
│   │   ├── SettingsForm.tsx
│   │   ├── DashboardStats.tsx
│   │   └── AdminNav.tsx
│   └── shared/
│       ├── Header.tsx
│       ├── Footer.tsx
│       ├── LanguageSwitcher.tsx
│       └── Button.tsx
│
├── lib/
│   ├── db.ts (connexion PostgreSQL)
│   ├── render.ts (orchestration Sharp : masque, collage, trame, aperçu WebP)
│   ├── print-pdf.ts (assemblage du PDF 300 dpi via pdf-lib)
│   ├── background-removal.client.ts (détourage navigateur, WASM/WebGPU)
│   ├── whatsapp.ts (génère lien WhatsApp pré-rempli)
│   ├── analytics.ts (track events)
│   └── auth.ts (token verification)
│
├── public/
│   ├── kits/
│   │   ├── france/
│   │   │   ├── front.png (mockup vierge)
│   │   │   ├── back.png
│   │   │   ├── displacement.png
│   │   │   └── metadata.json {dimensions, print_zone}
│   │   ├── spain/ ... (etc)
│   │   └── (4 autres kits)
│   ├── fonts/
│   │   └── number-masks/ (fichiers SVG ou données des numéros 0-99)
│   ├── models/
│   │   └── background-removal/ (poids ONNX + WASM auto-hébergés, ~40 Mo)
│   └── locales/
│       └── (fichiers JSON de traduction)
│
├── .env.local (dev)
├── .env.example
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
├── package.json
└── README.md
```

---

## 5. PARCOURS CLIENT (6 ÉTAPES)

### Étape 1 : Sélection du Kit
- Affiche 5 kits (France, Spain, Germany, UK, USA)
- Chaque kit = image mockup + description
- Utilisateur clique sur un kit
- **Track event :** STEP_1_SELECTED

### Étape 2 : Sélection de la Catégorie
- 3 options : Supporter | Authentique | Joueur
- Affiche prix pour chaque catégorie (configurable)
- **Track event :** STEP_2_SELECTED

### Étape 3 : Détails (Taille, Nom, Numéro)
- Dropdown Taille (XS à XXL)
- Input Nom (max 15 caractères)
- Input Numéro (0-99 ou lettres)
- **Validation :** Nom/Numéro non vides
- **Track event :** STEP_3_COMPLETED

### Étape 4 : Import Photos
- Drag & drop ou clic pour upload
- Support 1-3 photos (redimensionnement auto)
- Aperçu des photos uploadées
- **Validation :** Au moins 1 photo
- **Track event :** STEP_4_PHOTOS_UPLOADED

### Étape 5 : Aperçu (Rendu Sharp)
- Affiche l'aperçu du maillot personnalisé (généré par Sharp)
- Les photos sont intégrées dans le masque du numéro
- Options : "Modifier" (revenir à l'étape 4) | "Valider" (aller à l'étape 6)
- **Rendu :** API `/api/render/preview` (Sharp, instantané)
- **Track event :** STEP_5_PREVIEW_GENERATED

### Étape 6 : Paiement & Données de Livraison
- Formulaire de livraison :
  - Prénom, Nom
  - Email (validation)
  - Téléphone
  - Pays (dropdown EU + USA)
  - Adresse complète
  - Code postal
  - Ville
  
- Affichage du montant total (IBAN ou WhatsApp)
  
- **Bouton "Commander"** :
  - Crée la commande en base (status = PENDING)
  - Exporte le design en JSON
  - Génère le PDF 300dpi pour l'imprimeur
  - **Option A :** Affiche l'IBAN configurable (avec message "Virer ce montant")
  - **Option B :** Redirige vers WhatsApp avec lien pré-rempli (design + montant)
  
- **Track event :** STEP_6_ORDER_CREATED

---

## 6. PIPELINE DE RENDU (Sharp + pdf-lib)

### Répartition client / serveur

Le détourage tourne **dans le navigateur du client** (WebAssembly / WebGPU), pas dans la
fonction Vercel — voir section 11 pour la justification et le choix du modèle. La
fonction serverless ne fait donc que du compositing Sharp et de l'assemblage PDF via
pdf-lib : deux dépendances légères, aucun runtime Python, aucun `onnxruntime` natif.

| Étape | Où ça tourne | Techno |
| --- | --- | --- |
| Détourage des photos | Navigateur (pendant l'étape 4) | `@imgly/background-removal` (WASM/WebGPU) |
| Upload des PNG détourés (RGBA) | Navigateur → Vercel Blob | `fetch` + `@vercel/blob` |
| Masque du numéro | Serveur | SVG rastérisé par Sharp |
| Collage des photos dans le masque | Serveur | Sharp |
| Aperçu écran | Serveur | Sharp → WebP |
| Fichier imprimeur 300 dpi | Serveur | Sharp → PNG, puis **pdf-lib** |

**Conséquence sur le contrat d'API :** le serveur ne reçoit jamais de photo brute mais
des PNG **déjà détourés avec canal alpha**. `design_json.photos` stocke ces URLs de
cutouts. Le serveur vérifie la présence d'un alpha non trivial et refuse la requête
sinon (garde-fou `assertCutout()` ci-dessous) — il ne tente aucun détourage de secours.

### Workflow Détaillé

```javascript
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

// Input :
// - cutoutUrls: string[]  (1-3 PNG RGBA déjà détourés côté navigateur)
// - jerseyNumber: string  (le numéro du maillot, ex: "7")
// - kitSlug: string       (ex: "france")
// - jerseyTier: string    (ex: "supporter")

// Output :
// - previewWebP: Buffer   (aperçu pour affichage client)
// - productionPDF: Buffer (prêt pour l'imprimeur, 300 dpi, taille physique réelle)

async function renderJersey({ cutoutUrls, jerseyNumber, kitSlug, jerseyTier }) {

  // 1. Récupérer les cutouts (aucun détourage serveur) + garde-fou
  const cutouts = await Promise.all(
    cutoutUrls.map(async (url) => {
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      await assertCutout(buf);
      return buf;
    })
  );

  // 2. Metadata du kit : zone d'impression en px (mockup) ET en mm (impression)
  const kitMeta = JSON.parse(
    await readFile(`public/kits/${kitSlug}/metadata.json`, 'utf8')
  );
  const zone = kitMeta.tiers[jerseyTier].print_zone;
  // { x: 450, y: 300, width: 300, height: 400, width_mm: 210, height_mm: 280 }

  // 3. Masque du numéro : SVG rastérisé par Sharp, l'alpha = la surface imprimée
  const numberMask = await sharp(Buffer.from(numberMaskSvg(jerseyNumber, zone)))
    .png()
    .toBuffer();

  // 4. Layout vertical des photos, découpé par le masque
  //    (border blanc + trait rouge : paramètres configurables)
  const collage = await compositePhotosInMask(cutouts, numberMask, zone);

  // 5. Trame demi-teinte
  const artwork = await applyHalftone(collage, { angle: 45, size: 2 });

  // 6. Aperçu écran : compositing sur le mockup vierge
  const previewWebP = await sharp(`public/kits/${kitSlug}/front.png`)
    .composite([{ input: artwork, left: zone.x, top: zone.y }])
    .webp({ quality: 85 })
    .toBuffer();

  // 7. Fichier imprimeur : Sharp produit le raster, pdf-lib fabrique le PDF
  const productionPDF = await buildPrintPdf({ artwork, zone, mockup: previewWebP });

  return { previewWebP, productionPDF };
}
```

### Génération du PDF 300 dpi (pdf-lib)

`sharp` **n'a pas** de sortie `.pdf()` : il n'encode que raster (PNG, JPEG, WebP, AVIF,
TIFF) et vectoriel en entrée seulement. Le PDF est donc assemblé par `pdf-lib` (pur JS,
MIT, aucune dépendance native → fonctionne tel quel sur Vercel).

Deux contraintes à respecter :

1. **pdf-lib n'embarque que du PNG ou du JPEG** (`embedPng` / `embedJpg`) — jamais de
   WebP. Le buffer destiné au PDF doit donc sortir de Sharp en `.png()`.
2. Le « 300 dpi » ne se déclare pas dans le PDF : il résulte du rapport entre les pixels
   de l'image embarquée et la taille physique de la page. On rastérise à
   `mm → px @ 300 dpi`, puis on dessine à `mm → pt`. Le ratio donne 300 dpi.

```javascript
const mmToPt = (mm) => (mm / 25.4) * 72;            // unité PDF = point
const mmToPx = (mm, dpi = 300) => Math.round((mm / 25.4) * dpi);

async function buildPrintPdf({ artwork, zone, mockup }) {
  // Raster à la résolution d'impression exacte
  const artworkPng = await sharp(artwork)
    .resize(mmToPx(zone.width_mm), mmToPx(zone.height_mm), { fit: 'fill' })
    .png()
    .toBuffer();

  const pdf = await PDFDocument.create();

  // Page 1 — le visuel à imprimer, à sa taille physique réelle, rien d'autre.
  const art = await pdf.embedPng(artworkPng);
  const w = mmToPt(zone.width_mm);
  const h = mmToPt(zone.height_mm);
  pdf.addPage([w, h]).drawImage(art, { x: 0, y: 0, width: w, height: h });

  // Page 2 — mockup de contrôle : où le visuel se place sur le maillot.
  const refPng = await sharp(mockup).png().toBuffer(); // WebP → PNG obligatoire
  const ref = await pdf.embedPng(refPng);
  const a4 = pdf.addPage([mmToPt(210), mmToPt(297)]);
  const scale = Math.min(a4.getWidth() / ref.width, a4.getHeight() / ref.height) * 0.9;
  a4.drawImage(ref, {
    x: (a4.getWidth() - ref.width * scale) / 2,
    y: (a4.getHeight() - ref.height * scale) / 2,
    width: ref.width * scale,
    height: ref.height * scale,
  });

  pdf.setTitle(`GetYourJersey — ${zone.width_mm}×${zone.height_mm} mm @ 300 dpi`);
  return Buffer.from(await pdf.save());
}
```

> **Note atelier :** la page 1 contient le visuel seul à la bonne taille physique —
> c'est ce dont l'imprimeur a besoin. Le mockup n'est qu'une page de contrôle. Un PDF
> qui ne contiendrait que le mockup composité ne serait pas imprimable.

### Fonctions utilitaires

```javascript
// Refuse une photo qui n'a pas été détourée côté client.
async function assertCutout(buf) {
  const { hasAlpha } = await sharp(buf).metadata();
  if (!hasAlpha) throw new HttpError(422, 'PHOTO_NOT_CUT_OUT');
  const { isOpaque } = await sharp(buf).stats();
  if (isOpaque) throw new HttpError(422, 'PHOTO_NOT_CUT_OUT'); // alpha 100 % opaque
}

// Sharp n'expose pas de filtre halftone. On génère une grille de points SVG à
// l'angle voulu et on l'applique en masque de destination sur le collage.
async function applyHalftone(input, { angle, size }) {
  const { width, height } = await sharp(input).metadata();
  const screen = `<svg width="${width}" height="${height}"
      xmlns="http://www.w3.org/2000/svg"><defs>
      <pattern id="d" width="${size * 2}" height="${size * 2}"
        patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
        <circle cx="${size}" cy="${size}" r="${size * 0.62}" fill="#fff"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="url(#d)"/></svg>`;
  return sharp(input)
    .composite([{ input: Buffer.from(screen), blend: 'dest-in' }])
    .png()
    .toBuffer();
}
```

> **Limite assumée :** cette trame a un pas fixe. Une vraie trame AM (taille de point
> modulée par la luminance) demande un traitement pixel par pixel via `sharp().raw()`.
> À faire seulement si l'imprimeur juge le rendu insuffisant.

> **Displacement map :** Sharp ne sait pas appliquer de displacement map. Le
> `displacement.png` des kits reste donc inutilisé au MVP ; l'effet « tissu » demanderait
> un passage en `raw()` avec remap manuel des pixels, ou un rendu WebGL côté client.

### API Routes Dédiées

Les deux routes doivent tourner sur le runtime Node.js — Sharp ne fonctionne pas sur
l'Edge Runtime :

```javascript
export const runtime = 'nodejs';
export const maxDuration = 30;
```

**POST /api/render/preview**
- Input: `{ cutoutUrls, jerseyNumber, kitSlug, jerseyTier }`
- Output: `{ previewUrl, generationTime }`
- Cache: 5 min, clé = hash du payload
- Le détourage étant déjà fait côté client, cette route est du pur compositing
  (quelques centaines de ms).

**POST /api/render/pdf**
- Input: `{ orderId }` (récupère le design depuis la DB)
- Output: `{ pdfUrl }` (URL temporaire, 1h d'expiration)

---

## 7. DASHBOARD ADMIN

**Route :** `/admin` (protégé par token)

### Pages Requises

**1. Dashboard Principal**
- Stat cards :
  - Commandes totales (count)
  - Commandes en attente (count)
  - Commandes payées (count)
  - Revenue total (sum amount)
  
- Graphique : commandes par jour (derniers 30 jours)
- Tableau : dernières 10 commandes (email, montant, statut, actions)

**2. Page Commandes**
- Filtre : statut (Pending, Paid, Sent, Shipped)
- Filtre : date range
- Table avec colonnes : 
  - Client (email)
  - Montant
  - Kit
  - Numéro
  - Photos (preview miniature)
  - Statut
  - Actions (Marquer payée | Voir détail | Exporter PDF | Supprimer)

**3. Page Settings**
- Input IBAN (texte, affiché au client au checkout)
- Input Numéro WhatsApp (format international, ex: +33612345678)
- Textarea Template WhatsApp (message pré-rempli pour les clients)
- Input Admin Token (pour se logger)
- Bouton Save (valide + update DB)

**4. Page Analytique** (optionnel, simple)
- Événements par type (STEP_1_VIEWED, etc.)
- Tableau événements (timestamp, type, order_id)

### Auth Admin
- Simple : token stocké en env variable `ADMIN_TOKEN`
- Login : page `/admin/login` avec input token
- Cookie de session (httpOnly)

---

## 8. MULTILANGUE (5 langues)

**Langues :** FR, EN, ES, DE, IT

**Implémentation :** next-intl

**Structure des traductions :**
```
public/locales/
├── fr.json
├── en.json
├── es.json
├── de.json
└── it.json
```

**Utilisé dans :** 
- Toutes les pages (automatique via middleware)
- Tous les boutons, formulaires, messages d'erreur
- Sélecteur de langue en header (petit flag + dropdown)

**Routing :** `/fr/builder`, `/en/builder`, etc.

---

## 9. DESIGN UI

### Couleurs
- **Primaire :** Bleu vif (`#1E40AF` ou similaire)
- **Secondaire :** Orange dynamique (`#FF9500` ou similaire)
- **Background :** Blanc propre
- **Text :** Gris foncé (#333)
- **Borders :** Gris léger (#E5E7EB)

### Composants
- **Boutons :** Bleu/Orange, arrondi (border-radius: 8px), hover shadowed
- **Inputs :** Border gris, focus ring bleu
- **Cards :** Fond blanc, border léger, shadow subtle
- **Étapes :** Progressbar (bleu pour complété, gris pour pending)

### Spacing
- Sections : gap 3-4 rem
- Éléments : gap 1-2 rem
- Padding : 1.5-2 rem sur les cards

### Tipographie
- Police : System stack (Inter / -apple-system / Segoe UI)
- Headings (H1) : 2.5 rem, bold
- Headings (H2) : 2 rem, bold
- Body : 1 rem, regular
- Small : 0.875 rem

---

## 10. FORMULAIRES

### Formulaire Checkout (Étape 6)

```
Données de Livraison
├─ Prénom * (text input, required)
├─ Nom * (text input, required)
├─ Email * (email input, required, validation)
├─ Téléphone * (tel input, required)
├─ Pays * (select dropdown, EU + USA, required)
├─ Adresse * (text input, required)
├─ Code Postal * (text input, required)
└─ Ville * (text input, required)

Résumé Commande
├─ Kit : [nom]
├─ Catégorie : [tier]
├─ Taille : [size]
├─ Nom sur maillot : [nom]
├─ Numéro : [numéro]
├─ Montant : [currency] [amount]
└─ Aperçu du design : [image]

Paiement
├─ [IBAN Option]
│  └─ "Effectuez un virement à : [IBAN configurable]"
│     "Montant : [amount] EUR"
│
└─ [WhatsApp Option]
   └─ Bouton "Commander via WhatsApp"
      (redirige vers lien WhatsApp avec design + montant)
```

### Formulaire Settings (Admin)

```
IBAN Configuration
├─ Label : "Comptes bancaires pour les virements clients"
├─ Input IBAN * (max 34 chars, validation IBAN)
├─ Input BIC (optionnel)
└─ Input Titulaire * (text)

WhatsApp Configuration
├─ Label : "Lien WhatsApp pour les commandes"
├─ Input Numéro * (format +33612345678, required)
├─ Textarea Template (texte pré-rempli pour les clients)
│  Par défaut : "Bonjour, je veux cette commande..."
└─ Prévisualisation du lien

Admin Token
├─ Input Token * (masked, copy button)
└─ Info : "Change ce token pour sécuriser l'accès admin"

Bouton Save (bleu) + Cancel (gris)
```

---

## 11. INTÉGRATIONS EXTERNES

### Détourage : modèle de segmentation exécuté dans le navigateur

**Décision : le détourage tourne côté client en WebAssembly / WebGPU, pas dans la
fonction Vercel.**

#### Pourquoi pas `rembg` dans une fonction serverless

- `rembg` n'est **pas** un package npm : c'est un outil Python (PyPI). Il n'y a rien à
  `npm install`.
- L'équivalent Node (`onnxruntime-node` + poids du modèle) empile un binaire natif
  d'environ 100 Mo et un modèle de 40 à 170 Mo, à mettre dans le même bundle que Sharp.
  On frôle ou dépasse la limite de 250 Mo décompressés d'une fonction Vercel.
- Le modèle est rechargé à chaque cold start : plusieurs secondes avant même de traiter
  la première image, sur un chemin critique du parcours d'achat.
- On paie du temps d'exécution GPU-less pour un travail qui tient très bien sur la
  machine du client.

#### Solution retenue

| | |
| --- | --- |
| **Package** | `@imgly/background-removal` (build navigateur) |
| **Modèle** | IS-Net *general use* — segmentation d'objet saillant générique |
| **Exécution** | WebGPU si disponible, sinon WASM multi-thread (SIMD) |
| **Poids** | ~40 Mo en `quint8`, mis en cache par le navigateur après le 1er usage |
| **Coût** | 0 € — aucun appel réseau vers un tiers, aucune limite de volume |
| **Serveur** | Aucune charge : la fonction Vercel ne reçoit que des PNG RGBA |

**Traite n'importe quelle photo.** IS-Net *general use* est un modèle de segmentation
d'objet saillant généraliste — personnes, objets, animaux, arrière-plans complexes. Ce
n'est pas un chroma key : aucune hypothèse sur la couleur du fond. Il n'y a **pas** de
mode dégradé « fond blanc uniquement » dans cette spec.

#### Intégration

- Auto-héberger les poids : servir les assets depuis `/public/models/background-removal/`
  et pointer `config.publicPath` dessus. Évite la dépendance à un CDN tiers et tout
  transfert de données vers un domaine externe (RGPD).
- Lancer le détourage **dès l'étape 4**, en tâche de fond, pendant que le client
  continue à remplir le formulaire : à l'étape 5 les cutouts sont prêts et l'aperçu est
  quasi instantané. Afficher une progression par photo (`config.progress`).
- Compter 2 à 8 s par photo en WASM sur desktop, moins en WebGPU, davantage sur mobile
  d'entrée de gamme. Limiter les photos à 3 (déjà dans la spec) et redimensionner à
  ~1500 px sur le grand côté avant traitement.
- Uploader le PNG RGBA résultant vers Vercel Blob ; stocker l'URL dans
  `design_json.photos`.

#### Licences — à vérifier avant la mise en production

Point commercial important : plusieurs modèles de détourage populaires sont en licence
**non commerciale**, ce qui les exclut d'un site marchand.

| Modèle | Licence | Utilisable ici |
| --- | --- | --- |
| IS-Net / DIS (*general use*) | Apache-2.0 | ✅ |
| BiRefNet | MIT | ✅ (alternative) |
| U²-Net | Apache-2.0 | ✅ |
| MODNet | Apache-2.0 | ⚠️ portraits humains uniquement |
| **BRIA RMBG 1.4 / 2.0** | Non commerciale sans accord payant | ❌ **à éviter** |

Vérifier séparément (a) la licence du code du package et (b) celle des poids du modèle,
et refaire ce contrôle au moment du choix définitif : ces licences changent.

#### Repli si le navigateur ne peut pas exécuter le modèle

Cas résiduel : appareil très ancien, WASM désactivé, mémoire insuffisante. Alors :

1. Détecter l'échec côté client et le remonter comme un vrai état d'erreur.
2. Si `BACKGROUND_REMOVAL_FALLBACK_URL` est configurée, poster la photo à ce
   microservice (conteneur `rembg` auto-hébergé sur Hugging Face Spaces, Fly.io, Render
   — hors Vercel, là où un runtime Python et un modèle lourd sont à leur place).
3. Sinon, message explicite : « le détourage n'a pas pu s'exécuter sur cet appareil,
   essayez depuis un autre navigateur ». Mieux vaut ce message qu'un maillot imprimé
   avec un fond parasite.

Ce repli est **désactivé par défaut** et n'est pas nécessaire au MVP.

### WhatsApp
- **Pas d'API WhatsApp Business** ; juste des liens `https://wa.me/`
- Format : `https://wa.me/33612345678?text=...` (URL encoded)
- Le text contient : numéro de commande + montant + lien download design

### PostgreSQL Vercel
- Connexion string fournie par Vercel lors du setup
- Stocke dans `.env.local` en dev
- En prod, Vercel la fournit automatiquement

---

## 12. VARIABLES D'ENVIRONNEMENT

```
# .env.local (dev)
DATABASE_URL=postgresql://...
ADMIN_TOKEN=supersecret123
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
# Chemin des poids du modèle de détourage, servis depuis notre propre domaine
NEXT_PUBLIC_BG_REMOVAL_PUBLIC_PATH=/models/background-removal/
# Repli de détourage serveur (optionnel, désactivé si vide — voir section 11)
BACKGROUND_REMOVAL_FALLBACK_URL=

# Vercel (prod)
DATABASE_URL=postgresql://...
ADMIN_TOKEN=supersecret123_prod
NEXT_PUBLIC_SITE_URL=https://getyourjersey.com
BLOB_READ_WRITE_TOKEN=(fourni par Vercel Blob)
NEXT_PUBLIC_BG_REMOVAL_PUBLIC_PATH=/models/background-removal/
BACKGROUND_REMOVAL_FALLBACK_URL=
```

---

## 13. FONCTIONNALITÉS ESSENTIELLES

### MVP (Must Have)
- ✓ Builder 6 étapes (UI complète + multilangue)
- ✓ Rendu Sharp (aperçu + PDF 300dpi)
- ✓ Checkout avec formulaire livraison
- ✓ Paiement IBAN configurable (affichage)
- ✓ Redirection WhatsApp (avec design JSON)
- ✓ Dashboard admin (commandes + settings)
- ✓ PostgreSQL Vercel (schema complet)
- ✓ Analytics basique (track events)
- ✓ Multilangue (5 langues)
- ✓ Design blanc + bleu/orange

### À Ajouter Plus Tard
- [ ] Authentification client (login)
- [ ] Historique commandes client
- [ ] Webhook fulfillment (envoi auto au partenaire)
- [ ] Paiement réel (Stripe via intermédiaire, Wise, etc.)
- [ ] Email confirmations
- [ ] Tracking shipping
- [ ] Exports CSV (admin)

---

## 14. DÉPLOIEMENT VERCEL

1. Crée un repo GitHub privé
2. Lie le repo à Vercel
3. Configure les env vars dans Vercel Dashboard
4. Crée une PostgreSQL database via Vercel (clic 1x)
5. Déploie (git push déclenche le build auto)

**Résultat :** Site live sur `getyourjersey.vercel.app` (ou domaine custom après)

---

## 15. KITS DE DÉMARRAGE (Maillots)

### Pour chaque kit, tu fournis :
1. **front.png** - Mockup du maillot face avant (1200x1600px)
2. **back.png** - Mockup du maillot face arrière (1200x1600px)
3. **displacement.png** - Map de déformation (optionnel pour effet 3D)
4. **metadata.json** :
   ```json
   {
     "name": "France",
     "color_hex": "#1E40AF",
     "tiers": {
       "supporter": {
         "print_zone": {
           "x": 450, "y": 300, "width": 300, "height": 400,
           "width_mm": 210, "height_mm": 280
         },
         "price_eur": 35.00,
         "price_usd": 38.00
       },
       "authentique": { ... },
       "joueur": { ... }
     }
   }
   ```

   `x` / `y` / `width` / `height` sont en **pixels du mockup** (positionnement de
   l'aperçu). `width_mm` / `height_mm` sont la **taille physique imprimée** : c'est
   d'elles que découle la résolution réelle du PDF 300 dpi (section 6). Les deux jeux de
   valeurs doivent garder le même rapport d'aspect, sinon le visuel sera déformé entre
   l'aperçu et l'impression.

### KIts Recommandés pour MVP :
1. **France** (Bleu foncé)
2. **Spain** (Rojo)
3. **Germany** (Noir/Blanc)
4. **Brazil** (Jaune/Vert)
5. **UK** (Blanc)

**Placeholders :** Pour le dev initial, utilise des images simples (maillots vierges). Remplace par les vrais designs après.

---

## 16. CHECKLIST DE FINALISATION

- [ ] Repo GitHub créé + structuré
- [ ] `.env.example` complété
- [ ] PostgreSQL Vercel connectée
- [ ] Seed DB initiale (settings, kits)
- [ ] Tous les fichiers de traduction (FR, EN, ES, DE, IT)
- [ ] Tous les assets maillots (/public/kits/)
- [ ] Builder complètement fonctionnel (6 étapes, rendu live)
- [ ] Admin dashboard complètement fonctionnel
- [ ] Render API (Sharp) testée
- [ ] WhatsApp redirect testée (lien valide)
- [ ] Multilangue testé (au moins FR/EN)
- [ ] Responsive design (mobile + desktop)
- [ ] Performance : Lighthouse > 80
- [ ] Déployé sur Vercel + domaine custom
- [ ] Documentation README complète

---

## 17. NOTES IMPORTANTES

1. **Sharp est local** : Pas d'API externe, donc coût zéro et vitesse optimale.
2. **Détourage** : exécuté dans le navigateur du client (WASM/WebGPU), donc coût zéro et
   aucune charge serveur. `rembg` n'existe pas sur npm et n'a pas sa place dans une
   fonction Vercel — voir section 11.
3. **IBAN** : Affiché en clair au client (pas de traitement = pas de PCI). Le client vire manuellement.
4. **WhatsApp** : Juste des liens HTTP, pas d'API. Le commercial répond manuellement.
5. **PostgreSQL** : Crée les tables au premier déploiement (via seed ou migrations).
6. **Env vars** : JAMAIS commit `.env.local` en git ; toujours utiliser `.env.example`.
7. **Images clients** : Upload vers `/tmp` ou service de stockage (Vercel Blob optionnel).

---

## 18. POINT DE DÉPART

**Tu starts ici :**

```bash
npx create-next-app@latest getyourjersey --typescript --tailwind --app
cd getyourjersey

# Serveur : compositing + PDF + DB + i18n (aucune dépendance native lourde)
npm install sharp pdf-lib pg next-intl @vercel/blob

# Navigateur : détourage WASM/WebGPU
npm install @imgly/background-removal
```

⚠️ **Ne pas exécuter `npm install rembg`** : ce package n'existe pas sur npm (`rembg` est
un outil Python). Voir section 11.

⚠️ **`pdf-lib` n'est pas optionnel** : Sharp n'a pas de sortie `.pdf()`. Tout le PDF
300 dpi passe par `pdf-lib`, alimenté par un PNG produit par Sharp. Voir section 6.

Puis crée la structure de fichiers décrite plus haut, seed la DB, et commence par les 6 étapes du builder.

---

**FIN DU PROMPT**

Tu as toutes les infos pour terminer ce projet seul. Bonne chance ! 🚀
