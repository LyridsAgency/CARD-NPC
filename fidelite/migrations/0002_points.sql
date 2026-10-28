-- Récompenses choisies par le commerçant : tampons ou points, cadeaux, carte qui recommence ou s'arrête.
ALTER TABLE reglages ADD COLUMN mode TEXT;      -- tampons | points
ALTER TABLE reglages ADD COLUMN apres TEXT;     -- recommence | termine (après la récompense, en mode tampons)
ALTER TABLE reglages ADD COLUMN taux REAL;      -- points gagnés par euro dépensé
ALTER TABLE reglages ADD COLUMN cadeaux TEXT;   -- JSON : [{"nom":"Café offert","points":50}, …]
ALTER TABLE cartes ADD COLUMN terminee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE evenements ADD COLUMN valeur INTEGER; -- points gagnés ou dépensés
