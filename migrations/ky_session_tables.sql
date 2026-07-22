-- ky_session: satu sesi KYIC per perusahaan per periode
CREATE TABLE IF NOT EXISTS ky_session (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode          text NOT NULL,
  nama_entitas  text NOT NULL,
  jenis_usaha   text NOT NULL,
  periode       text NOT NULL,
  status        text NOT NULL DEFAULT 'draft',
  template_nama text,
  template_text text,           -- teks KYIC T-1 (max ~60k chars)
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ky_dokumen: dokumen pendukung per BAB per sesi
CREATE TABLE IF NOT EXISTS ky_dokumen (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES ky_session(id) ON DELETE CASCADE,
  bab_id        text NOT NULL,  -- 'kepemilikan' | 'kegiatan_bisnis' | dll
  nama_file     text NOT NULL,
  teks_ekstrak  text,           -- teks hasil ekstraksi (max ~50k chars)
  uploaded_by   uuid REFERENCES auth.users(id),
  uploaded_at   timestamptz DEFAULT now()
);

-- ky_analisis: hasil analisis AI per BAB per sesi
CREATE TABLE IF NOT EXISTS ky_analisis (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES ky_session(id) ON DELETE CASCADE,
  bab_id            text NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  catatan_pengawas  text,
  hasil_json        jsonb,
  analyzed_at       timestamptz,
  UNIQUE (session_id, bab_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS ky_session_created_by ON ky_session(created_by);
CREATE INDEX IF NOT EXISTS ky_dokumen_session_bab ON ky_dokumen(session_id, bab_id);
CREATE INDEX IF NOT EXISTS ky_analisis_session_bab ON ky_analisis(session_id, bab_id);

-- RLS (aktifkan jika diperlukan)
-- ALTER TABLE ky_session ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ky_dokumen ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ky_analisis ENABLE ROW LEVEL SECURITY;
