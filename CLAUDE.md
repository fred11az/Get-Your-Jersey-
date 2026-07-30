# GetYourJersey.com

## Référence principale

**Le cahier des charges complet du projet se trouve dans [`docs/SPEC.md`](docs/SPEC.md).**

Il faut le lire et s'y référer systématiquement avant toute tâche de développement sur
ce dépôt : il définit le stack technique, le schéma de base de données, la structure de
fichiers attendue, le parcours client en 6 étapes, le pipeline de rendu Sharp, le
dashboard admin, le multilangue, la charte UI et la checklist de finalisation.

En cas de divergence entre le code existant et `docs/SPEC.md`, signaler l'écart plutôt
que de deviner.

## Résumé rapide (détails dans docs/SPEC.md)

- **Produit** : plateforme e-commerce de personnalisation de maillots de football,
  avec aperçu généré localement (Sharp + rembg, aucune API générative).
- **Marchés** : Europe + USA.
- **Stack** : Next.js 15 (App Router) + TypeScript, Tailwind CSS, API Routes Node.js,
  PostgreSQL Vercel, next-intl (FR, EN, ES, DE, IT), déploiement Vercel.
- **Auth admin** : token simple via variable d'environnement `ADMIN_TOKEN`.
- **Paiement** : pas de traitement de paiement — affichage d'un IBAN configurable ou
  redirection vers un lien `https://wa.me/` pré-rempli.
- **Charte** : fond blanc, bleu primaire (`#1E40AF`), orange secondaire (`#FF9500`).

## Règles de travail

- Ne jamais committer `.env.local` ; maintenir `.env.example` à jour.
- Le rendu (aperçu WebP + PDF 300 dpi) reste local via Sharp : pas de dépendance à un
  service externe payant.
