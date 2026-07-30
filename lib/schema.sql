-- ---------------------------------------------------------------------------
-- GetYourJersey — schéma PostgreSQL (section 3 de docs/SPEC.md)
-- Idempotent : rejouable sans risque (npm run db:seed).
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CONFIG -------------------------------------------------------------------
-- Écart assumé avec la spec : pas de colonne `admin_token`. Le token admin vit
-- uniquement dans la variable d'environnement ADMIN_TOKEN (section 7 de la
-- spec). Deux sources de vérité pour un secret finissent toujours par diverger.
-- Ajout par rapport à la spec : iban_bic et iban_holder, exigés par le
-- formulaire admin décrit en section 10.
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  iban TEXT NOT NULL,
  iban_bic TEXT,
  iban_holder TEXT,
  whatsapp_number TEXT NOT NULL,
  whatsapp_template TEXT DEFAULT 'Bonjour, je veux cette commande...',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- COMMANDES ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
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
  kit_tier TEXT NOT NULL,
  size TEXT NOT NULL,
  jersey_name TEXT NOT NULL,
  jersey_number TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR',

  -- Design
  design_json JSONB NOT NULL,
  render_preview_url TEXT,
  render_pdf_url TEXT,

  -- Statut
  status TEXT DEFAULT 'PENDING',
  whatsapp_sent_at TIMESTAMP,
  paid_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT orders_status_check
    CHECK (status IN ('PENDING', 'PAID', 'SENT_TO_PRINTER', 'SHIPPED')),
  CONSTRAINT orders_tier_check
    CHECK (kit_tier IN ('supporter', 'authentique', 'joueur'))
);

-- ANALYTICS ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- INDEX --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
