'use client'

import { useState, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'

interface PageItem {
  originalIndex: number
  removed: boolean
  thumbnail: string | null
}

export default function PdfPageEditor() {
  const [fileName, setFileName] = useState<string>('')
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [mode, setMode] = useState<'remove' | 'rearrange'>('remove')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const renderThumbnails = async (buf: ArrayBuffer, pageCount: number) => {
    setIsRendering(true)
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

      const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 0.3 })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const context = canvas.getContext('2d')
        if (!context) continue

        await page.render({ canvas, canvasContext: context, viewport }).promise
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)

        setPages(prev => prev.map(p => (p.originalIndex === i - 1 ? { ...p, thumbnail: dataUrl } : p)))
      }
    } catch (err) {
      console.error('Gagal render thumbnail:', err)
    } finally {
      setIsRendering(false)
    }
  }

  const handleAddPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Format file harus PDF')
      return
    }

    try {
      const buf = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(buf)
      const pageCount = pdfDoc.getPageCount()

      setFileName(file.name)
      setBuffer(buf)
      setPages(Array.from({ length: pageCount }, (_, i) => ({ originalIndex: i, removed: false, thumbnail: null })))
      renderThumbnails(buf, pageCount)
    } catch (err) {
      alert(`Gagal baca ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.style.background = 'rgba(69,230,97,0.15)'
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = 'transparent'
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.style.background = 'transparent'
    const file = e.dataTransfer.files[0]
    if (file) handleAddPdf(file)
  }

  const toggleRemove = (idx: number) => {
    setPages(pages.map((p, i) => (i === idx ? { ...p, removed: !p.removed } : p)))
  }

  const handlePageDragStart = (idx: number) => {
    setDraggedIdx(idx)
  }

  const handlePageDragOver = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault()
    if (idx !== dragOverIdx) setDragOverIdx(idx)
  }

  const handlePageDrop = (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null)
      setDragOverIdx(null)
      return
    }
    const next = [...pages]
    const [moved] = next.splice(draggedIdx, 1)
    next.splice(idx, 0, moved)
    setPages(next)
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  const handlePageDragEnd = () => {
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  const handleApply = async () => {
    if (!buffer) return

    const remainingPages = pages.filter(p => !p.removed)
    if (remainingPages.length === 0) {
      alert('Minimal harus ada 1 halaman tersisa')
      return
    }

    setIsProcessing(true)
    try {
      const srcPdf = await PDFDocument.load(buffer)
      const newPdf = await PDFDocument.create()
      const copiedPages = await newPdf.copyPages(srcPdf, remainingPages.map(p => p.originalIndex))
      copiedPages.forEach(page => newPdf.addPage(page))

      const pdfBytes = await newPdf.save()
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = mode === 'remove' ? `edited_${fileName}` : `rearranged_${fileName}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Gagal memproses: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReset = () => {
    setFileName('')
    setBuffer(null)
    setPages([])
  }

  const removedCount = pages.filter(p => p.removed).length

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        {[
          { id: 'remove', label: 'Remove Page', desc: 'Hapus halaman tertentu dari PDF' },
          { id: 'rearrange', label: 'Rearrange Page', desc: 'Susun ulang urutan halaman PDF' },
        ].map((m: any) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            style={{
              flex: 1,
              background: mode === m.id ? 'rgba(69,230,97,0.15)' : 'transparent',
              border: `1px solid ${mode === m.id ? '#45e661' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 12,
              padding: 16,
              cursor: 'pointer',
              transition: 'background-color 0.2s, border-color 0.2s',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: '#aab4bc' }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {!buffer && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '1px dashed rgba(69,230,97,0.45)',
            borderRadius: 16,
            padding: 48,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={e => {
              const file = e.currentTarget.files?.[0]
              if (file) handleAddPdf(file)
            }}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Unggah PDF</div>
          <div style={{ fontSize: 12, color: '#aab4bc' }}>Drag PDF di sini atau klik untuk memilih</div>
        </div>
      )}

      {buffer && (
        <div style={{ marginTop: buffer ? 0 : 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{fileName}</div>
              <div style={{ fontSize: 11, color: '#aab4bc', marginTop: 4 }}>
                {pages.length} halaman{mode === 'remove' && removedCount > 0 ? ` — ${removedCount} akan dihapus` : ''}
                {isRendering ? ' — memuat preview...' : ''}
              </div>
            </div>
            <button
              onClick={handleReset}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 999,
                padding: '6px 16px',
                fontSize: 12,
                color: '#aab4bc',
                cursor: 'pointer',
              }}
            >
              Ganti File
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 14, marginBottom: 24 }}>
            {pages.map((page, idx) => (
              <div
                key={`${page.originalIndex}-${idx}`}
                draggable={mode === 'rearrange'}
                onDragStart={() => handlePageDragStart(idx)}
                onDragOver={e => handlePageDragOver(e, idx)}
                onDrop={() => handlePageDrop(idx)}
                onDragEnd={handlePageDragEnd}
                style={{
                  position: 'relative',
                  padding: 10,
                  textAlign: 'center',
                  background: page.removed ? 'rgba(255,111,97,0.1)' : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${
                    dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx
                      ? '#45e661'
                      : page.removed ? 'rgba(255,111,97,0.4)' : 'rgba(255,255,255,0.08)'
                  }`,
                  borderRadius: 10,
                  opacity: page.removed ? 0.5 : draggedIdx === idx ? 0.4 : 1,
                  cursor: mode === 'rearrange' ? 'grab' : 'default',
                  transition: 'border-color 0.15s, opacity 0.15s',
                }}
              >
                <div
                  style={{
                    aspectRatio: '1 / 1.35',
                    background: 'rgba(0,0,0,0.35)',
                    borderRadius: 6,
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {page.thumbnail ? (
                    <img
                      src={page.thumbnail}
                      alt={`Halaman ${page.originalIndex + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ fontSize: 10, color: '#828d96' }}>Memuat...</div>
                  )}
                </div>

                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: '#aab4bc' }}>
                  Hal. {page.originalIndex + 1}
                </div>

                {mode === 'remove' && (
                  <button
                    onClick={() => toggleRemove(idx)}
                    style={{
                      background: page.removed ? 'rgba(255,111,97,0.2)' : 'transparent',
                      border: '1px solid rgba(255,111,97,0.5)',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 11,
                      color: '#ff6f61',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    {page.removed ? 'Batal' : 'Hapus'}
                  </button>
                )}

                {mode === 'rearrange' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '4px 0',
                      fontSize: 11,
                      color: '#828d96',
                      cursor: 'grab',
                    }}
                  >
                    <span style={{ fontSize: 13, letterSpacing: 1 }}>⠿</span>
                    Tarik untuk pindah
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleApply}
              disabled={isProcessing}
              style={{
                flex: 1,
                background: '#45e661',
                border: 'none',
                borderRadius: 999,
                padding: '10px 24px',
                fontSize: 13,
                fontWeight: 500,
                color: '#04070b',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isProcessing ? 'Memproses...' : mode === 'remove' ? 'Terapkan & Download' : 'Simpan Urutan & Download'}
            </button>
            <button
              onClick={handleReset}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 999,
                padding: '10px 24px',
                fontSize: 13,
                color: '#aab4bc',
                cursor: 'pointer',
              }}
            >
              Bersihkan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
