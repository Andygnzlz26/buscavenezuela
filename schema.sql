-- BuscaVenezuela Schema
-- Venezuelan earthquake missing-persons registry
-- SQLite init script

CREATE TABLE IF NOT EXISTS ciudades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  affected_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ciudad TEXT NOT NULL,
  ultima_zona TEXT,
  descripcion TEXT,
  contacto_info TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Social contact columns (safe for new and existing databases)
ALTER TABLE personas ADD COLUMN contacto_whatsapp TEXT;
ALTER TABLE personas ADD COLUMN contacto_instagram TEXT;
ALTER TABLE personas ADD COLUMN contacto_email TEXT;

CREATE TABLE IF NOT EXISTS reportes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id INTEGER NOT NULL REFERENCES personas(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('estoy_bien', 'desaparecido', 'encontrado')),
  descripcion TEXT,
  contacto_info TEXT,
  fotos TEXT, -- JSON array of base64 strings
  created_at TEXT DEFAULT (datetime('now'))
);

-- Social contact columns (safe for new and existing databases)
ALTER TABLE reportes ADD COLUMN contacto_whatsapp TEXT;
ALTER TABLE reportes ADD COLUMN contacto_instagram TEXT;
ALTER TABLE reportes ADD COLUMN contacto_email TEXT;

-- Pre-seed ciudades
INSERT OR IGNORE INTO ciudades (name, label, affected_count) VALUES
  ('caracas', 'Caracas (Distrito Capital)', 0),
  ('la-guaira', 'La Guaira (Vargas)', 0),
  ('miranda', 'Miranda (Los Teques, Altos Mirandinos)', 0),
  ('sucre', 'Sucre (Estado Sucre)', 0),
  ('vargas', 'Vargas', 0),
  ('aragua', 'Aragua (Maracay)', 0),
  ('carabobo', 'Carabobo (Valencia)', 0);
