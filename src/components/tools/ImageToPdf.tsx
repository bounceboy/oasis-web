'use client'

import { useState, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'

export default function ImageToPdf() {
  const [images, setImages] = useState<Array<{ file: File; preview: string; name: string }>>([])
  const [isConverting, setIsConverting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddImages = (files: File[]) => {
    const validFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name))
    const newImages = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
    }))
    setImages([...images, ...newImages])
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
    handleAddImages(Array.from(e.dataTransfer.files))
  }

  const removeImage = (index: number) => {
    URL.revokeObjectURL(images[index].preview)
    setImages(images.filter((_, i) => i !== index))
  }

  const handleConvert = async () => {
    if (images.length === 0) return

    setIsConverting(true)
    try {
      const pdfDoc = await PDFDocument.create()

      for (const img of images) {
        const buffer = await img.file.arrayBuffer()
        let embeddedImage
        const ext = img.file.name.toLowerCase().split('.').pop()

        if (ext === 'png') {
          embeddedImage = await pdfDoc.embedPng(buffer)
        } else {
          embeddedImage = await pdfDoc.embedJpg(buffer)
        }

        const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height])
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: embeddedImage.width,
          height: embeddedImage.height,
        })
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `converted_${Date.now()}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      images.forEach(img => URL.revokeObjectURL(img.preview))
      setImages([])
    } catch (err) {
      alert(`Gagal: ${err instanceof Error ? err.message : 'Konversi PDF'}`)
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <div>
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
          multiple
          accept="image/*"
          onChange={e => handleAddImages(Array.from(e.currentTarget.files || []))}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Unggah Gambar</div>
        <div style={{ fontSize: 12, color: '#aab4bc' }}>Drag gambar di sini atau klik untuk memilih. Format: PNG, JPG, GIF, WebP</div>
      </div>

      {images.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 12, color: '#aab4bc', marginBottom: 16 }}>
            {images.length} gambar — akan dikonversi ke 1 PDF (satu halaman per gambar)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12, marginBottom: 24 }}>
            {images.map((img, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  paddingBottom: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <img
                  src={img.preview}
                  alt={img.name}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <button
                  onClick={() => removeImage(idx)}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'rgba(0,0,0,0.7)',
                    border: '1px solid rgba(255,111,97,0.5)',
                    borderRadius: 4,
                    width: 24,
                    height: 24,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#ff6f61',
                    fontWeight: 600,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleConvert}
              disabled={isConverting}
              style={{
                background: '#45e661',
                border: 'none',
                borderRadius: 999,
                padding: '10px 24px',
                fontSize: 13,
                fontWeight: 500,
                color: '#04070b',
                cursor: isConverting ? 'not-allowed' : 'pointer',
                opacity: isConverting ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isConverting ? 'Mengonversi...' : 'Konversi ke PDF'}
            </button>
            <button
              onClick={() => {
                images.forEach(img => URL.revokeObjectURL(img.preview))
                setImages([])
              }}
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
