# OASIS Local — Setup Guide

Versi OASIS yang berjalan 100% offline menggunakan Ollama. Tidak perlu API key cloud.

## Prerequisites

1. **Ollama** harus jalan di `http://localhost:11434`
   ```bash
   ollama serve  # di terminal terpisah
   ```

2. **Model untuk AI analysis:**
   ```bash
   ollama pull qwen2.5:7b       # Primary (7GB RAM)
   ```

   Optional (jika ada RAM):
   ```bash
   ollama pull llama3.1:8b      # Alternative
   ```

3. **Optional: Model vision untuk ekstraksi gambar (KYIC)**
   ```bash
   ollama pull qwen2.5vl:7b     # Qwen2.5 Vision Large
   ```
   Jika tidak ada, gambar di KYIC akan dilewati (tidak error).

## Environment Setup

File `.env.local` sudah tersedia dengan konfigurasi Ollama:
```
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_VISION_MODEL=qwen2.5vl:7b  # optional
```

**Supabase (sama seperti oasis-web):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Riwayat analisis disimpan ke **database Supabase yang sama** dengan versi web. Kedua versi bisa saling lihat hasil analisisnya.

## Jalankan

```bash
npm install    # Jika npm cache error, coba: npm cache clean --force
npm run dev    # Port 3010 (http://localhost:3010)
```

## Bagaimana Kerjanya

| Step | oasis-web (Cloud) | oasis-local (Ollama) |
|------|-------------------|----------------------|
| 1. Ekstrak data (PDF/Excel) | Claude 4.5 via OpenRouter | qwen2.5:7b lokal |
| 2. Hitung scorecard/rasio | Logic + rules | Logic + rules (sama) |
| 3. Cari regulasi (RAG) | Vector search Supabase + OpenAI embeddings | Vector search Supabase + OpenAI embeddings |
| 4. Compliance analysis | Claude 4.5 + POJK context | qwen2.5:7b + POJK context |
| 5. Risk mapping | Claude 4.5 + SEDK context | qwen2.5:7b + SEDK context |
| 6. Simpan hasil | Supabase (database) | Supabase (database — **sama**) |

**AI Layer:** Hanya Claude ↔ Ollama yang berubah. RAG, logic, database tetap sama.

## Performance (Expected)

| Model | Ekstraksi Data | Compliance | Risk Mapping | Total |
|-------|----------------|-----------|--------------|-------|
| qwen2.5:7b | 30–60s | 2–3 min | 2–3 min | **5–7 min/sesi** |
| llama3.1:8b | 20–40s | 1.5–2 min | 1.5–2 min | **4–5 min/sesi** |

oasis-web (Claude cloud): ~10–20 detik total, tapi butuh internet & API key.

## Troubleshooting

### Ollama tidak terkoneksi
```bash
curl http://localhost:11434/api/tags
# Jika error: jalankan `ollama serve` di terminal lain
```

### Model tidak tersedia
```bash
ollama list               # Cek model yang sudah di-pull
ollama pull qwen2.5:7b    # Download jika belum ada
```

### Port 3010 sudah pakai
Ubah di `package.json`:
```json
"dev": "next dev -p 3011"
```

### OOM (Out of Memory)
Ollama butuh ~6–8GB RAM idle untuk qwen2.5:7b. Jika MacBook Air RAM terbatas:
- Tutup aplikasi lain
- Gunakan `llama3.1:8b` yang lebih efisien
- Naikkan `num_ctx` di `src/lib/claude.ts` hanya kalau RAM &gt;16GB

## Perlu Hybrid (Ollama + Claude)?

Jika kualitas Ollama tidak cukup untuk modul tertentu, bisa setup hybrid:
1. Gunakan Ollama untuk ekstraksi data (tugas simpel)
2. Gunakan Claude untuk compliance/risk (tugas kompleks)

Edit `src/lib/claude.ts`: ganti `callOpenRouter` kembali ke OpenRouter + set `OPENROUTER_API_KEY` di `.env.local`.
