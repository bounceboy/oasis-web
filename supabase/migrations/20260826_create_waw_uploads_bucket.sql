-- Buat bucket untuk file wawancara (bahan tayang, catatan)
-- File bisa besar (PPTX 5-50MB), jadi pakai direct upload dari browser
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'waw-uploads',
  'waw-uploads',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS: hanya service role yang bisa read (backend pakai service role key)
-- Upload via signed URL dihandle oleh service role di /api/onsite/wawancara/upload-url
CREATE POLICY "service role full access waw-uploads"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'waw-uploads')
WITH CHECK (bucket_id = 'waw-uploads');
