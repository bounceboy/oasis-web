'use client'

import { useState, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'

interface PdfFile {
  id: string
  name: string
  buffer: ArrayBuffer
  pageCount: number
}

export default function MergePdf() {
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddPdfs = async (files: File[]) => {
    const validFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'))

    for (const file of validFiles) {
      try {
        const buffer = await file.arrayBuffer()
        const pdfDoc = await PDFDocument.load(buffer)
        const pageCount = pdfDoc.getPageCount()

        setPdfFiles(prev => [...prev, {
          id: `${file.name}-${Date.now()}`,
          name: file.name,
          buffer,
          pageCount,
        }])
      } catch (err) {
        alert(`Gagal baca ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    }
  }

  const handleMerge = async () => {
    if (pdfFiles.length === 0) return

    setIsProcessing(true)
    try {
      const mergedPdf = await PDFDocument.create()

      for (const pdf of pdfFiles) {
        const srcPdf = await PDFDocument.load(pdf.buffer)
        const pages = await mergedPdf.copyPages(srcPdf, Array.from({ length: srcPdf.getPageCount() }, (_, i) => i))
        pages.forEach(page => mergedPdf.addPage(page))
      }

      const pdfBytes = await mergedPdf.save()
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `merged_${Date.now()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Gagal merge: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const removePdf = (id: string) => {
    setPdfFiles(pdfFiles.filter(p => p.id !== id))
  }

  const handleFileDragStart = (idx: number) => {
    setDraggedIdx(idx)
  }

  const handleFileDragOver = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault()
    if (idx !== dragOverIdx) setDragOverIdx(idx)
  }

  const handleFileDrop = (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null)
      setDragOverIdx(null)
      return
    }
    const next = [...pdfFiles]
    const [moved] = next.splice(draggedIdx, 1)
    next.splice(idx, 0, moved)
    setPdfFiles(next)
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  const handleFileDragEnd = () => {
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div>
      <div
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
          multiple
          accept=".pdf"
          onChange={e => handleAddPdfs(Array.from(e.currentTarget.files || []))}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Unggah PDF</div>
        <div style={{ fontSize: 12, color: '#aab4bc' }}>Drag beberapa PDF di sini atau klik untuk memilih</div>
      </div>

      {pdfFiles.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 11, color: '#aab4bc', marginBottom: 12 }}>
            Tarik untuk mengubah urutan — file paling atas akan digabung lebih dulu
          </div>
          {pdfFiles.map((pdf, idx) => (
            <div
              key={pdf.id}
              draggable
              onDragStart={() => handleFileDragStart(idx)}
              onDragOver={e => handleFileDragOver(e, idx)}
              onDrop={() => handleFileDrop(idx)}
              onDragEnd={handleFileDragEnd}
              style={{
                marginBottom: 12,
                padding: 16,
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 12,
                border: `1px solid ${
                  dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx
                    ? '#45e661'
                    : 'rgba(255,255,255,0.08)'
                }`,
                opacity: draggedIdx === idx ? 0.4 : 1,
                cursor: 'grab',
                transition: 'border-color 0.15s, opacity 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: '#828d96' }}>⠿</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#45e661',
                      background: 'rgba(69,230,97,0.12)',
                      borderRadius: 999,
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pdf.name}</div>
                    <div style={{ fontSize: 11, color: '#aab4bc', marginTop: 4 }}>{pdf.pageCount} halaman</div>
                  </div>
                </div>
                <button
                  onClick={() => removePdf(pdf.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,111,97,0.5)',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    color: '#ff6f61',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              onClick={handleMerge}
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
              {isProcessing ? 'Memproses...' : 'Merge & Download'}
            </button>
            <button
              onClick={() => setPdfFiles([])}
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
