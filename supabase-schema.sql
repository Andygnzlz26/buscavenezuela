-- BuscaVenezuela Schema
-- Venezuelan earthquake missing-persons registry
-- PostgreSQL / Supabase init script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if re-running
DROP TABLE IF EXISTS reportes CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS ciudades CASCADE;

CREATE TABLE ciudades (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  affected_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE personas (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ciudad TEXT NOT NULL REFERENCES ciudades(name),
  ultima_zona TEXT,
  descripcion TEXT,
  contacto_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reportes (
  id SERIAL PRIMARY KEY,
  persona_id INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('estoy_bien', 'desaparecido', 'encontrado')),
  descripcion TEXT,
  contacto_info TEXT,
  fotos TEXT, -- JSON array of base64 strings or Supabase Storage URLs
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for search
CREATE INDEX idx_personas_name ON personas USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_personas_ciudad ON personas(ciudad);
CREATE INDEX idx_reportes_persona ON reportes(persona_id);
CREATE INDEX idx_reportes_tipo ON reportes(tipo);

-- Pre-seed ciudades
INSERT INTO ciudades (name, label, affected_count) VALUES
  ('caracas', 'Caracas (Distrito Capital)', 0),
  ('la-guaira', 'La Guaira (Vargas)', 0),
  ('miranda', 'Miranda (Los Teques, Altos Mirandinos)', 0),
  ('sucre', 'Sucre (Estado Sucre)', 0),
  ('vargas', 'Vargas', 0),
  ('aragua', 'Aragua (Maracay)', 0),
  ('carabobo', 'Carabobo (Valencia)', 0)
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE ciudades ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all tables (this is a public registry)
CREATE POLICY "Allow public read ciudades" ON ciudades FOR SELECT USING (true);
CREATE POLICY "Allow public read personas" ON personas FOR SELECT USING (true);
CREATE POLICY "Allow public read reportes" ON reportes FOR SELECT USING (true);

-- Allow public insert (no auth needed — this is a disaster response tool)
CREATE POLICY "Allow public insert personas" ON personas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert reportes" ON reportes FOR INSERT WITH CHECK (true);

-- Create storage bucket for photos
-- Run this in Supabase SQL Editor too:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('personas_fotos', 'personas_fotos', true);
