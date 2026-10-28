-- ECRU Fidélité : base D1 (SQLite)
-- Une carte = un client final d'un commerce. Le commerce est identifié par le handle
-- de son entrée « Commerce ECRU » dans Shopify (ex. client-123456).

CREATE TABLE IF NOT EXISTS cartes (
  code TEXT PRIMARY KEY,              -- écrit dans la puce : /c/<code>
  commerce TEXT NOT NULL,             -- handle du métaobjet Shopify
  tampons INTEGER NOT NULL DEFAULT 0, -- tampons en cours
  visites INTEGER NOT NULL DEFAULT 0, -- total des tampons donnés
  recompenses INTEGER NOT NULL DEFAULT 0,
  terminee INTEGER NOT NULL DEFAULT 0, -- carte complétée (si le commerçant ne la fait pas recommencer)
  creee TEXT NOT NULL,
  derniere_visite TEXT
);
CREATE INDEX IF NOT EXISTS cartes_commerce ON cartes (commerce);

CREATE TABLE IF NOT EXISTS evenements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carte TEXT NOT NULL,
  commerce TEXT NOT NULL,
  type TEXT NOT NULL,                 -- tampon (une visite, en tampons ou en points) | retrait | recompense | vue
  a TEXT NOT NULL,                    -- date ISO
  valeur INTEGER                      -- points gagnés ou dépensés
);
CREATE INDEX IF NOT EXISTS evenements_commerce_a ON evenements (commerce, a);
CREATE INDEX IF NOT EXISTS evenements_carte_a ON evenements (carte, a);

-- Clé d'accès du commerçant (seul le hachage est gardé)
CREATE TABLE IF NOT EXISTS acces_pro (
  commerce TEXT PRIMARY KEY,
  cle_hash TEXT NOT NULL,
  creee TEXT NOT NULL
);

-- Réglages choisis par le commerçant dans son espace (sinon : valeurs de la fiche du commerce)
-- Le compteur cartes.tampons contient des tampons ou des points selon le mode.
CREATE TABLE IF NOT EXISTS reglages (
  commerce TEXT PRIMARY KEY,
  seuil INTEGER,
  recompense TEXT,
  mode TEXT,                          -- tampons | points
  apres TEXT,                         -- recommence | termine
  taux REAL,                          -- points par euro
  cadeaux TEXT,                       -- JSON [{"nom":…,"points":…}]
  couleur TEXT,                       -- couleur de la page (#rrggbb), choisie par le commerçant
  modifie TEXT NOT NULL
);

-- Fiches des commerces gérées directement ici (page /admin), sans dépendre d'un jeton Shopify.
-- Si un jeton Storefront Shopify est configuré, la fiche Shopify « Commerce ECRU » est utilisée à la place.
CREATE TABLE IF NOT EXISTS commerces (
  handle TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1,
  couleur TEXT NOT NULL DEFAULT '#0d0d0c',
  logo TEXT,
  accroche TEXT,
  recompense TEXT,
  seuil INTEGER NOT NULL DEFAULT 10,
  lien_menu TEXT,
  lien_avis TEXT,
  lien_reseaux TEXT,
  lien_site TEXT,
  modifie TEXT NOT NULL
);

-- Bases déjà créées : appliquer migrations/0002_points.sql
