-- ============================================================
-- OASIS Production Schema
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Tabel sesi pemeriksaan
CREATE TABLE IF NOT EXISTS pemeriksaan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_entitas TEXT NOT NULL,
  jenis_usaha TEXT NOT NULL DEFAULT '',
  jenis_pemeriksaan TEXT NOT NULL DEFAULT 'compliance',
  dokumen_nama TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'selesai', 'error')),
  hasil_compliance TEXT,
  hasil_risk TEXT,
  pojk_context_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel vault masking (token <-> entitas asli, per sesi)
CREATE TABLE IF NOT EXISTS masking_vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES pemeriksaan_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_data JSONB NOT NULL DEFAULT '{}',
  entities_summary JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update trigger untuk updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pemeriksaan_sessions_updated_at
  BEFORE UPDATE ON pemeriksaan_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE pemeriksaan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE masking_vaults ENABLE ROW LEVEL SECURITY;

-- pemeriksaan_sessions: user hanya bisa akses data miliknya
CREATE POLICY "Users can manage own sessions"
  ON pemeriksaan_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- masking_vaults: user hanya bisa akses vault miliknya
CREATE POLICY "Users can manage own vaults"
  ON masking_vaults
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Aktifkan RLS di tabel CORE (pojk_list, pojk_chunks, pojk_relations)
-- Baca publik untuk semua user yang sudah login
-- ============================================================

ALTER TABLE pojk_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE pojk_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pojk_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pojk_list"
  ON pojk_list FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read pojk_chunks"
  ON pojk_chunks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read pojk_relations"
  ON pojk_relations FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- Full-text search index untuk pojk_chunks
-- ============================================================

CREATE INDEX IF NOT EXISTS pojk_chunks_content_fts
  ON pojk_chunks
  USING gin(to_tsvector('indonesian', content));
