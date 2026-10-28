-- ECRU Fidélité : base D1 (SQLite)
-- Une carte = un client final d'un commerce. Le commerce est identifié par le handle
-- de son entrée « Commerce ECRU » dans Shopify (ex. client-123456).

CREATE TABLE IF NOT EXISTS cartes (
  code TEXT PRIMARY KEY,              -- écrit dans la puce : /c/<code>
  commerce TEXT NOT NULL,             -- handle du métaobjet Shopify
  tampons INTEGER NOT NULL DEFAULT 0, -- tampons en cours
  visites INTEGER NOT NULL DEFAULT 0, -- total des tampons donnés
  recompenses INTEGER NOT NULL DEFAULT 0,
  creee TEXT NOT NULL,
  derniere_visite TEXT
);
CREATE INDEX IF NOT EXISTS cartes_commerce ON cartes (commerce);

CREATE TABLE IF NOT EXISTS evenements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carte TEXT NOT NULL,
  commerce TEXT NOT NULL,
  type TEXT NOT NULL,                 -- tampon | retrait | recompense | vue
  a TEXT NOT NULL                     -- date ISO
);
CREATE INDEX IF NOT EXISTS evenements_commerce_a ON evenements (commerce, a);
CREATE INDEX IF NOT EXISTS evenements_carte_a ON evenements (carte, a);

-- Clé d'accès du commerçant (seul le hachage est gardé)
CREATE TABLE IF NOT EXISTS acces_pro (
  commerce TEXT PRIMARY KEY,
  cle_hash TEXT NOT NULL,
  creee TEXT NOT NULL
);

-- Réglages modifiés par le commerçant (sinon : valeurs de la fiche Shopify)
CREATE TABLE IF NOT EXISTS reglages (
  commerce TEXT PRIMARY KEY,
  seuil INTEGER,
  recompense TEXT,
  modifie TEXT NOT NULL
);
