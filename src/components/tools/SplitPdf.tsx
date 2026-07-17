'use client'

import { useState, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'

interface PageItem {
  index: number
  thumbnail: string | null
}

export default function SplitPdf() {
  const [fileName, setFileName] = useState<string>('')
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [splitAfter, setSplitAfter] = useState<Set<number>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
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

        setPages(prev => prev.map(p => (p.index === i - 1 ? { ...p, thumbnail: dataUrl } : p)))
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

      if (pageCount < 2) {
        alert('PDF minimal harus punya 2 halaman untuk bisa displit')
        return
      }

      setFileName(file.name)
      setBuffer(buf)
      setPages(Array.from({ length: pageCount }, (_, i) => ({ index: i, thumbnail: null })))
      setSplitAfter(new Set())
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

  const toggleSplit = (afterIndex: number) => {
    setSplitAfter(prev => {
      const next = new Set(prev)
      if (next.has(afterIndex)) next.delete(afterIndex)
      else next.add(afterIndex)
      return next
    })
  }

  // Hitung segmen berdasarkan titik split yang dipilih
  const getSegments = (): number[][] => {
    const points = [...splitAfter].sort((a, b) => a - b)
    const segments: number[][] = []
    let start = 0
    for (const p of points) {
      segments.push(Array.from({ length: p - start + 1 }, (_, i) => start + i))
      start = p + 1
    }
    segments.push(Array.from({ length: pages.length - start }, (_, i) => start + i))
    return segments
  }

  const segments = getSegments()

  const handleSplit = async () => {
    if (!buffer) return
    if (splitAfter.size === 0) {
      alert('Pilih minimal 1 titik split (klik ikon gunting antar halaman)')
      return
    }

    setIsProcessing(true)
    try {
      const srcPdf = await PDFDocument.load(buffer)
      const baseName = fileName.replace(/\.pdf$/i, '')

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const newPdf = await PDFDocument.create()
        const copiedPages = await newPdf.copyPages(srcPdf, seg)
        copiedPages.forEach(page => newPdf.addPage(page))

        const pdfBytes = await newPdf.save()
        const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}_bagian${i + 1}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        // Jeda kecil supaya browser tidak block multiple download sekaligus
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    } catch (err) {
      alert(`Gagal split: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReset = () => {
    setFileName('')
    setBuffer(null)
    setPages([])
    setSplitAfter(new Set())
  }

  return (
    <div>
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
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{fileName}</div>
              <div style={{ fontSize: 11, color: '#aab4bc', marginTop: 4 }}>
                {pages.length} halaman — akan jadi {segments.length} file
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

          <div style={{ fontSize: 11, color: '#828d96', marginBottom: 16 }}>
            Klik ikon ✂️ di antara dua halaman untuk menandai titik split. Bisa pilih lebih dari 1 titik.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, marginBottom: 24, alignItems: 'stretch' }}>
            {pages.map((page, idx) => {
              const isLast = idx === pages.length - 1
              const segIdx = segments.findIndex(seg => seg.includes(page.index))
              const segColor = segIdx % 2 === 0 ? 'rgba(69,230,97,0.06)' : 'rgba(255,255,255,0.03)'

              return (
                <div key={page.index} style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 130,
                      padding: 10,
                      textAlign: 'center',
                      background: segColor,
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
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
                          alt={`Halaman ${page.index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <div style={{ fontSize: 10, color: '#828d96' }}>Memuat...</div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#aab4bc' }}>
                      Hal. {page.index + 1}
                    </div>
                  </div>

                  {!isLast && (
                    <button
                      onClick={() => toggleSplit(page.index)}
                      title={splitAfter.has(page.index) ? 'Batal split di sini' : 'Split di sini'}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        border: `1px solid ${splitAfter.has(page.index) ? '#45e661' : 'rgba(255,255,255,0.15)'}`,
                        background: splitAfter.has(page.index) ? '#45e661' : 'rgba(0,0,0,0.3)',
                        color: splitAfter.has(page.index) ? '#04070b' : '#aab4bc',
                        cursor: 'pointer',
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 -1px',
                        flexShrink: 0,
                        zIndex: 1,
                        transition: 'background-color 0.15s, border-color 0.15s',
                      }}
                    >
                      ✂️
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleSplit}
              disabled={isProcessing || splitAfter.size === 0}
              style={{
                flex: 1,
                background: '#45e661',
                border: 'none',
                borderRadius: 999,
                padding: '10px 24px',
                fontSize: 13,
                fontWeight: 500,
                color: '#04070b',
                cursor: isProcessing || splitAfter.size === 0 ? 'not-allowed' : 'pointer',
                opacity: isProcessing || splitAfter.size === 0 ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isProcessing ? 'Memproses...' : `Split & Download ${segments.length} File`}
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
