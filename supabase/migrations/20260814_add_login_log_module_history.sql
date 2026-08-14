-- Tabel login_log: track API key per direktorat
CREATE TABLE IF NOT EXISTS login_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  direktorat  TEXT NOT NULL,           -- 'DPSS', 'DAJI', 'DASR', 'DPJP'
  api_key_mask   TEXT,                 -- '****abc12345' (4 bintang + 8 char terakhir)
  api_key_prefix TEXT,                 -- 'sk-ant-api03-...' (20 char pertama, untuk dedup)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_log_direktorat_idx ON login_log(direktorat);

-- Tabel module_history: history analisis semua modul per direktorat
CREATE TABLE IF NOT EXISTS module_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  direktorat  TEXT NOT NULL,           -- 'DPSS', 'DAJI', 'DASR', 'DPJP'
  module      TEXT NOT NULL,           -- 'psak', 'lhptl', 'kyic', 'renbis'
  title       TEXT,                    -- e.g. 'PT Asuransi XYZ — Des 2025'
  input       JSONB,                   -- parameter input yang diisi user
  hasil       JSONB,                   -- output/hasil analisis
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS module_history_direktorat_idx ON module_history(direktorat);
CREATE INDEX IF NOT EXISTS module_history_module_idx ON module_history(module);
