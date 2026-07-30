# Get-Your-Jersey-

Plateforme e-commerce de personnalisation de maillots de football
([getyourjersey.com](https://getyourjersey.com)) : le client choisit un kit, une
catégorie, ses détails (taille / nom / numéro), importe ses photos, et obtient un
aperçu du maillot personnalisé généré localement avec Sharp.

## Documentation

- **[docs/SPEC.md](docs/SPEC.md)** — cahier des charges complet : stack, schéma de base
  de données, structure de fichiers, parcours client en 6 étapes, pipeline de rendu,
  dashboard admin, multilangue, charte UI, checklist de finalisation.
- **[CLAUDE.md](CLAUDE.md)** — instructions pour les agents travaillant sur ce dépôt.

## Stack

| Domaine | Choix |
| --- | --- |
| Frontend | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS (blanc / bleu / orange) |
| Backend | Next.js API Routes (Node.js) |
| Base de données | PostgreSQL Vercel |
| Traitement d'image | Sharp (compositing) + pdf-lib (PDF 300 dpi) |
| Détourage photos | `@imgly/background-removal` — WASM/WebGPU, côté navigateur |
| Multilangue | next-intl (FR, EN, ES, DE, IT) |
| Déploiement | Vercel |

## État

Projet en phase d'initialisation — le code applicatif reste à implémenter en suivant
`docs/SPEC.md`.
