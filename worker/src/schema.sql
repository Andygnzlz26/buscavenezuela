-- BuscaVenezuela D1 Schema
-- Cloudflare D1 (SQLite-compatible)
-- Venezuelan earthquake missing-persons registry

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
  contacto_whatsapp TEXT,
  contacto_instagram TEXT,
  contacto_email TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reportes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id INTEGER NOT NULL REFERENCES personas(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('estoy_bien', 'desaparecido', 'encontrado')),
  descripcion TEXT,
  contacto_info TEXT,
  contacto_whatsapp TEXT,
  contacto_instagram TEXT,
  contacto_email TEXT,
  fotos TEXT DEFAULT '[]',  -- JSON array of R2 URLs
  created_at TEXT DEFAULT (datetime('now'))
);

-- Pre-seed ciudades
INSERT OR IGNORE INTO ciudades (name, label, affected_count) VALUES
  ('caracas', 'Caracas (Distrito Capital)', 0),
  ('la-guaira', 'La Guaira (Vargas)', 0),
  ('miranda', 'Miranda (Los Teques, Altos Mirandinos)', 0),
  ('sucre', 'Sucre (Estado Sucre)', 0),
  ('vargas', 'Vargas', 0),
  ('aragua', 'Aragua (Maracay)', 0),
  ('carabobo', 'Carabobo (Valencia)', 0);
