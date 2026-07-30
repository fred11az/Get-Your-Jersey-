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
- **Image processing :** Sharp + rembg
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
  design_json JSONB NOT NULL, -- {photos: [urls], layout: {...}}
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
│   ├── render.ts (Sharp + rembg orchestration)
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

## 6. PIPELINE DE RENDU (Sharp)

### Workflow Détaillé

```javascript
// Input :
// - photoUrls: [string] (1-3 URLs de photos uploadées)
// - jerseyNumber: string (le numéro du maillot, ex: "7")
// - kitSlug: string (ex: "france")
// - jerseyTier: string (ex: "supporter")

// Output :
// - previewWebP: Buffer (aperçu pour affichage client)
// - productionPDF: Buffer (prêt pour l'imprimeur 300dpi)

async function renderJersey(input) {
  
  // 1. Détourage des photos (rembg)
  const detoureredPhotos = await Promise.all(
    photoUrls.map(url => removeBackground(url))
  );
  
  // 2. Charger le mockup du kit (vierge)
  const mockupFront = await sharp(`/public/kits/${kitSlug}/front.png`);
  
  // 3. Charger la metadata du kit (dimensions, print zone)
  const kitMeta = require(`/public/kits/${kitSlug}/metadata.json`);
  const printZone = kitMeta.print_zones[jerseyTier];
  // { x: 500, y: 300, width: 400, height: 600, dpi: 300 }
  
  // 4. Créer le masque vectoriel du numéro
  const numberMask = await generateNumberMask(jerseyNumber, {
    width: printZone.width,
    height: printZone.height
  });
  
  // 5. Layout vertical des photos DANS le masque
  const photoLayout = await compositePhotosInMask(detoureredPhotos, numberMask);
  // Ajoute border blanc + trait rouge (paramètres configurables)
  
  // 6. Appliquer trame/texture (demi-teinte)
  const texturedPhoto = await applyHalfTone(photoLayout, {
    angle: 45,
    size: 2
  });
  
  // 7. Compose sur le mockup avec displacement map
  const finalPreview = await sharp(mockupFront)
    .composite([
      {
        input: texturedPhoto,
        left: printZone.x,
        top: printZone.y,
        blend: 'multiply' // ou 'overlay'
      }
    ])
    .webp({ quality: 85 })
    .toBuffer();
  
  // 8. Export PDF 300dpi pour l'imprimeur
  const finalPDF = await sharp(mockupFront)
    .resize(... DPI_SETTINGS)
    .composite([...])
    .pdf()
    .toBuffer();
  
  return { previewWebP: finalPreview, productionPDF: finalPDF };
}
```

### API Routes Dédiées

**POST /api/render/preview**
- Input: `{ photoUrls, jerseyNumber, kitSlug, jerseyTier }`
- Output: `{ previewUrl, generationTime }`
- Cache: 5 min (Redis ou Memory)

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

### Rembg (Détourage)
- **API gratuite :** https://api.remove.bg ou **local model** (plus recommandé)
- Pour MVP : utilise `rembg` npm package (Python sous le capot, mais wrappé)
- Alternative : simple background removal avec couleur unie

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
NEXT_PUBLIC_WHATSAPP_API_KEY=(optionnel)

# Vercel (prod)
DATABASE_URL=postgresql://...
ADMIN_TOKEN=supersecret123_prod
NEXT_PUBLIC_SITE_URL=https://getyourjersey.com
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
         "print_zone": { "x": 450, "y": 300, "width": 300, "height": 400 },
         "price_eur": 35.00,
         "price_usd": 38.00
       },
       "authentique": { ... },
       "joueur": { ... }
     }
   }
   ```

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
2. **Rembg** : Utilise le package npm. Si slow, passe à rembg API (payant) après MVP.
3. **IBAN** : Affiché en clair au client (pas de traitement = pas de PCI). Le client vire manuellement.
4. **WhatsApp** : Juste des liens HTTP, pas d'API. Le commercial répond manuellement.
5. **PostgreSQL** : Crée les tables au premier déploiement (via seed ou migrations).
6. **Env vars** : JAMAIS commit `.env.local` en git ; toujours utiliser `.env.example`.
7. **Images clients** : Upload vers `/tmp` ou service de stockage (Vercel Blob optionnel).

---

## 18. POINT DE DÉPART

**Tu starts ici :**

```bash
npx create-next-app@latest getyourjersey --typescript --tailwind
cd getyourjersey
npm install sharp rembg next-intl pg
```

Puis crée la structure de fichiers décrite plus haut, seed la DB, et commence par les 6 étapes du builder.

---

**FIN DU PROMPT**

Tu as toutes les infos pour terminer ce projet seul. Bonne chance ! 🚀
