-- ============================================================
-- OASIS Migration 002 — Offsite Modules + SEDK + Skills Config
-- Jalankan di Supabase SQL Editor
-- AMAN: tidak mengubah tabel yang sudah ada
-- ============================================================

-- Enable pgvector untuk semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- DATABASE PERATURAN / KETENTUAN
-- Shared — digunakan semua modul
-- ============================================================

-- Chunks SEDK umum (semua modul kecuali Renbis)
CREATE TABLE IF NOT EXISTS sedk_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sedk_id     TEXT NOT NULL,           -- identifikasi SEDK (misal: SEDK-2023-001)
  source      TEXT NOT NULL,           -- nama file sumber
  bab         TEXT,
  pasal       TEXT,
  content     TEXT NOT NULL,
  embedding   vector(1536),            -- OpenAI text-embedding-3-small
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Chunks SEDK khusus Renbis
CREATE TABLE IF NOT EXISTS sedk_renbis_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sedk_id     TEXT NOT NULL,
  source      TEXT NOT NULL,
  bab         TEXT,
  pasal       TEXT,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indikator penilaian PSAK 117
CREATE TABLE IF NOT EXISTS psak117_indicators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode        TEXT NOT NULL UNIQUE,    -- misal: PSK-A1, PSK-B2
  kategori    TEXT NOT NULL,           -- misal: Pengukuran, Penyajian, Pengungkapan
  jenis_usaha TEXT NOT NULL DEFAULT 'both', -- 'umum', 'jiwa', 'both'
  deskripsi   TEXT NOT NULL,
  bobot       NUMERIC(4,2) DEFAULT 1.0,
  aktif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance matrix — template temuan per modul
CREATE TABLE IF NOT EXISTS compliance_matrix (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modul       TEXT NOT NULL CHECK (modul IN ('onsite','psak117','lhptl','kynbfi','renbis')),
  kode        TEXT NOT NULL,
  kategori    TEXT NOT NULL,
  deskripsi   TEXT NOT NULL,
  referensi   TEXT,                    -- pasal POJK/SEDK terkait
  tingkat     TEXT DEFAULT 'sedang' CHECK (tingkat IN ('rendah','sedang','tinggi','kritis')),
  aktif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(modul, kode)
);

-- Skills / parameter per modul (editable oleh pengawas)
CREATE TABLE IF NOT EXISTS skills_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modul        TEXT NOT NULL CHECK (modul IN ('onsite','psak117','lhptl','kynbfi','renbis')),
  skill_key    TEXT NOT NULL,          -- misal: 'prompt_compliance', 'bobot_risiko_likuiditas'
  label        TEXT NOT NULL,          -- label tampil di UI
  deskripsi    TEXT,
  tipe         TEXT NOT NULL DEFAULT 'text' CHECK (tipe IN ('text','textarea','number','boolean','select')),
  nilai        TEXT NOT NULL,          -- nilai saat ini (disimpan sebagai text)
  nilai_default TEXT NOT NULL,         -- nilai awal (untuk reset)
  opsi         JSONB,                  -- untuk tipe 'select': array of {value, label}
  updated_by   UUID REFERENCES auth.users(id),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(modul, skill_key)
);

-- ============================================================
-- OFFSITE — Tabel Induk Sesi
-- ============================================================

CREATE TABLE IF NOT EXISTS offsite_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modul           TEXT NOT NULL CHECK (modul IN ('psak117','lhptl','kynbfi','renbis')),
  nama_entitas    TEXT NOT NULL,
  jenis_usaha     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','processing','selesai','error')),
  hasil           JSONB,               -- output analisis (struktur bervariasi per modul)
  catatan_pengawas TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER offsite_sessions_updated_at
  BEFORE UPDATE ON offsite_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- OFFSITE — LHPTL
-- ============================================================

CREATE TABLE IF NOT EXISTS lhptl_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode        TEXT NOT NULL UNIQUE,
  nama        TEXT NOT NULL,
  deskripsi   TEXT,
  rules_json  JSONB NOT NULL DEFAULT '{}',
  versi       TEXT DEFAULT '1.0',
  aktif       BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER lhptl_rules_updated_at
  BEFORE UPDATE ON lhptl_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- OFFSITE — KYNBFI (multi-dokumen incremental)
-- ============================================================

CREATE TABLE IF NOT EXISTS kynbfi_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offsite_id      UUID NOT NULL REFERENCES offsite_sessions(id) ON DELETE CASCADE,
  tahun_penilaian INT NOT NULL,
  skor_risiko     NUMERIC(5,2),
  skor_tks        NUMERIC(5,2),
  profil_risiko   TEXT CHECK (profil_risiko IN ('rendah','sedang','tinggi','sangat_tinggi')),
  judgement       TEXT,                -- input final pengawas
  locked_at       TIMESTAMPTZ,         -- null = masih bisa diedit
  locked_by       UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER kynbfi_sessions_updated_at
  BEFORE UPDATE ON kynbfi_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS kynbfi_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kynbfi_id       UUID NOT NULL REFERENCES kynbfi_sessions(id) ON DELETE CASCADE,
  nama_file       TEXT NOT NULL,
  tipe_dokumen    TEXT NOT NULL,       -- misal: lapkeu, akta, direksi, risiko
  storage_path    TEXT,               -- path di Supabase Storage
  content_text    TEXT,               -- teks hasil ekstraksi
  analisis        JSONB,              -- hasil analisis parsial dokumen ini
  urutan          INT DEFAULT 0,      -- urutan upload
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OFFSITE — Renbis
-- ============================================================

CREATE TABLE IF NOT EXISTS renbis_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offsite_id      UUID NOT NULL REFERENCES offsite_sessions(id) ON DELETE CASCADE,
  tahun_renbis    INT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER renbis_sessions_updated_at
  BEFORE UPDATE ON renbis_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS renbis_kertas_kerja (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renbis_id       UUID NOT NULL REFERENCES renbis_sessions(id) ON DELETE CASCADE,
  nama_file       TEXT NOT NULL,
  tipe            TEXT NOT NULL CHECK (tipe IN ('renbis','kertas_kerja')),
  storage_path    TEXT,
  content_text    TEXT,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VECTOR SEARCH — Fungsi semantic search untuk SEDK
-- ============================================================

CREATE OR REPLACE FUNCTION search_sedk(
  query_embedding vector(1536),
  match_count      INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id        UUID,
  sedk_id   TEXT,
  bab       TEXT,
  pasal     TEXT,
  content   TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, sedk_id, bab, pasal, content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM sedk_chunks
  WHERE 1 - (embedding <=> query_embedding) > similarity_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION search_sedk_renbis(
  query_embedding vector(1536),
  match_count      INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id        UUID,
  sedk_id   TEXT,
  bab       TEXT,
  pasal     TEXT,
  content   TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, sedk_id, bab, pasal, content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM sedk_renbis_chunks
  WHERE 1 - (embedding <=> query_embedding) > similarity_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- INDEX untuk vector search (HNSW — cepat untuk produksi)
-- ============================================================

CREATE INDEX IF NOT EXISTS sedk_chunks_embedding_idx
  ON sedk_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS sedk_renbis_chunks_embedding_idx
  ON sedk_renbis_chunks USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE sedk_chunks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sedk_renbis_chunks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE psak117_indicators   ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_matrix    ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE offsite_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lhptl_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE kynbfi_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kynbfi_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE renbis_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE renbis_kertas_kerja  ENABLE ROW LEVEL SECURITY;

-- Tabel knowledge (read-only untuk semua user login)
CREATE POLICY "Auth read sedk_chunks"
  ON sedk_chunks FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Auth read sedk_renbis_chunks"
  ON sedk_renbis_chunks FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Auth read psak117_indicators"
  ON psak117_indicators FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Auth read compliance_matrix"
  ON compliance_matrix FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Auth read skills_config"
  ON skills_config FOR SELECT USING (auth.role() = 'authenticated');

-- skills_config: hanya supervisor/admin yang bisa update
CREATE POLICY "Supervisor write skills_config"
  ON skills_config FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- lhptl_rules: read semua, write hanya admin
CREATE POLICY "Auth read lhptl_rules"
  ON lhptl_rules FOR SELECT USING (auth.role() = 'authenticated');

-- offsite_sessions: user hanya bisa akses miliknya
CREATE POLICY "Users manage own offsite_sessions"
  ON offsite_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- kynbfi_sessions: via offsite_sessions
CREATE POLICY "Users manage own kynbfi_sessions"
  ON kynbfi_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM offsite_sessions
      WHERE offsite_sessions.id = kynbfi_sessions.offsite_id
        AND offsite_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own kynbfi_documents"
  ON kynbfi_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM kynbfi_sessions ks
      JOIN offsite_sessions os ON os.id = ks.offsite_id
      WHERE ks.id = kynbfi_documents.kynbfi_id
        AND os.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own renbis_sessions"
  ON renbis_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM offsite_sessions
      WHERE offsite_sessions.id = renbis_sessions.offsite_id
        AND offsite_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own renbis_kertas_kerja"
  ON renbis_kertas_kerja FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM renbis_sessions rs
      JOIN offsite_sessions os ON os.id = rs.offsite_id
      WHERE rs.id = renbis_kertas_kerja.renbis_id
        AND os.user_id = auth.uid()
    )
  );

-- ============================================================
-- SKILLS CONFIG — Seed data default
-- ============================================================

INSERT INTO skills_config (modul, skill_key, label, deskripsi, tipe, nilai, nilai_default) VALUES
-- Onsite
('onsite', 'prompt_compliance', 'Prompt Compliance Check', 'Template prompt untuk analisis kepatuhan onsite', 'textarea',
 'Analisis dokumen pemeriksaan berikut dari perspektif kepatuhan terhadap regulasi IKNB. Identifikasi: 1) Temuan kepatuhan, 2) Pasal yang dilanggar, 3) Tingkat risiko, 4) Rekomendasi. Referensi regulasi: {pojk_context}',
 'Analisis dokumen pemeriksaan berikut dari perspektif kepatuhan terhadap regulasi IKNB. Identifikasi: 1) Temuan kepatuhan, 2) Pasal yang dilanggar, 3) Tingkat risiko, 4) Rekomendasi. Referensi regulasi: {pojk_context}'),
('onsite', 'prompt_risk', 'Prompt Risk Assessment', 'Template prompt untuk analisis risiko onsite', 'textarea',
 'Lakukan penilaian risiko terhadap dokumen pemeriksaan berikut. Nilai dimensi: risiko kredit, risiko pasar, risiko likuiditas, risiko operasional, risiko kepatuhan. Berikan skor 1-5 tiap dimensi beserta justifikasi.',
 'Lakukan penilaian risiko terhadap dokumen pemeriksaan berikut. Nilai dimensi: risiko kredit, risiko pasar, risiko likuiditas, risiko operasional, risiko kepatuhan. Berikan skor 1-5 tiap dimensi beserta justifikasi.'),
('onsite', 'max_doc_size_mb', 'Ukuran Dokumen Maksimal (MB)', 'Batas ukuran file upload onsite', 'number', '50', '50'),
-- PSAK 117
('psak117', 'prompt_analisis', 'Prompt Analisis PSAK 117', 'Template prompt untuk penilaian PSAK 117', 'textarea',
 'Analisis data keuangan berikut terhadap indikator PSAK 117. Untuk setiap indikator berikan: status (patuh/tidak patuh/perlu klarifikasi), nilai aktual, nilai seharusnya, dan rekomendasi koreksi.',
 'Analisis data keuangan berikut terhadap indikator PSAK 117. Untuk setiap indikator berikan: status (patuh/tidak patuh/perlu klarifikasi), nilai aktual, nilai seharusnya, dan rekomendasi koreksi.'),
-- LHPTL
('lhptl', 'prompt_lhptl', 'Prompt LHPTL', 'Template prompt untuk generate LHPTL', 'textarea',
 'Berdasarkan data laporan keuangan audited dan rules pemeriksaan berikut, susun Laporan Hasil Pemeriksaan Tahunan (LHPTL) yang terstruktur. Sertakan: pendahuluan, temuan per area, kesimpulan, dan rekomendasi.',
 'Berdasarkan data laporan keuangan audited dan rules pemeriksaan berikut, susun Laporan Hasil Pemeriksaan Tahunan (LHPTL) yang terstruktur. Sertakan: pendahuluan, temuan per area, kesimpulan, dan rekomendasi.'),
-- KYNBFI
('kynbfi', 'prompt_profil', 'Prompt Profil Entitas', 'Template prompt untuk analisis profil KYNBFI', 'textarea',
 'Berdasarkan dokumen-dokumen berikut, susun profil risiko entitas IKNB. Nilai setiap dimensi: governance, keuangan, operasional, kepatuhan, reputasi. Berikan skor TKS dan justifikasi.',
 'Berdasarkan dokumen-dokumen berikut, susun profil risiko entitas IKNB. Nilai setiap dimensi: governance, keuangan, operasional, kepatuhan, reputasi. Berikan skor TKS dan justifikasi.'),
('kynbfi', 'dimensi_penilaian', 'Dimensi Penilaian', 'Dimensi yang dinilai dalam KYNBFI (pisahkan dengan koma)', 'text',
 'governance,keuangan,operasional,kepatuhan,reputasi',
 'governance,keuangan,operasional,kepatuhan,reputasi'),
-- Renbis
('renbis', 'prompt_renbis', 'Prompt Analisis Renbis', 'Template prompt untuk analisis rencana bisnis', 'textarea',
 'Analisis rencana bisnis perusahaan IKNB berikut terhadap ketentuan POJK dan SEDK yang berlaku. Identifikasi: 1) Gap kepatuhan, 2) Potensi risiko pelaksanaan, 3) Rekomendasi penyesuaian. Referensi regulasi: {sedk_context} {pojk_context}',
 'Analisis rencana bisnis perusahaan IKNB berikut terhadap ketentuan POJK dan SEDK yang berlaku. Identifikasi: 1) Gap kepatuhan, 2) Potensi risiko pelaksanaan, 3) Rekomendasi penyesuaian. Referensi regulasi: {sedk_context} {pojk_context}')
ON CONFLICT (modul, skill_key) DO NOTHING;
