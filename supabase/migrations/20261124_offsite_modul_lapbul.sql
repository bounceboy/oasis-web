-- Modul Analisis Lapbul Penjaminan: izinkan modul 'lapbul' di offsite_sessions
alter table public.offsite_sessions drop constraint if exists offsite_sessions_modul_check;
alter table public.offsite_sessions add constraint offsite_sessions_modul_check
  check (modul = any (array['psak117'::text, 'lhptl'::text, 'renbis'::text, 'kyic'::text, 'lapbul'::text]));
