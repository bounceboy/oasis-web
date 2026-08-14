'use client'

import { useState, useCallback, useRef } from 'react'
import JSZip from 'jszip'

type Status = 'idle' | 'processing' | 'done' | 'error'

interface SheetResult {
  name: string
  unprotected: boolean
}

interface Result {
  fileName: string
  sheets: SheetResult[]
  workbookProtectionRemoved: boolean
  blob: Blob
}

export default function UnprotectExcel() {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xlsm|xltx|xltm)$/i)) {
      setError('File harus berformat .xlsx, .xlsm, .xltx, atau .xltm')
      setStatus('error')
      return
    }

    setStatus('processing')
    setError(null)
    setResult(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)

      const sheets: SheetResult[] = []
      let workbookProtectionRemoved = false

      // Strip workbook protection
      const workbookFile = zip.file('xl/workbook.xml')
      if (workbookFile) {
        let xml = await workbookFile.async('string')
        const before = xml
        xml = xml.replace(/<workbookProtection[^>]*\/>/g, '')
        xml = xml.replace(/<workbookProtection[^>]*>[\s\S]*?<\/workbookProtection>/g, '')
        if (xml !== before) workbookProtectionRemoved = true
        zip.file('xl/workbook.xml', xml)
      }

      // Strip sheet protections
      const sheetFiles = Object.keys(zip.files).filter(
        name => name.match(/^xl\/worksheets\/sheet\d+\.xml$/i)
      )

      for (const sheetPath of sheetFiles) {
        const sheetFile = zip.file(sheetPath)
        if (!sheetFile) continue
        let xml = await sheetFile.async('string')
        const before = xml
        xml = xml.replace(/<sheetProtection[^>]*\/>/g, '')
        xml = xml.replace(/<sheetProtection[^>]*>[\s\S]*?<\/sheetProtection>/g, '')
        xml = xml.replace(/<protectedRanges[^>]*>[\s\S]*?<\/protectedRanges>/g, '')

        const unprotected = xml !== before

        // Extract sheet display name from sheet number
        const match = sheetPath.match(/sheet(\d+)\.xml$/i)
        const sheetNum = match ? parseInt(match[1]) : 0
        sheets.push({ name: `Sheet${sheetNum}`, unprotected })

        if (unprotected) zip.file(sheetPath, xml)
      }

      // Try to get actual sheet names from workbook.xml
      const wbFile = zip.file('xl/workbook.xml')
      if (wbFile) {
        const wbXml = await wbFile.async('string')
        const nameMatches = [...wbXml.matchAll(/name="([^"]+)"[^>]*sheetId="(\d+)"/g)]
        const idMatches = [...wbXml.matchAll(/sheetId="(\d+)"[^>]*name="([^"]+)"/g)]
        const allMatches = [...nameMatches, ...idMatches]
        if (allMatches.length > 0) {
          allMatches.forEach((m, i) => {
            const name = m[1] || m[2]
            if (sheets[i]) sheets[i].name = name
          })
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const baseName = file.name.replace(/\.(xlsx|xlsm|xltx|xltm)$/i, '')
      const ext = file.name.match(/\.(xlsx|xlsm|xltx|xltm)$/i)?.[0] ?? '.xlsx'

      setResult({
        fileName: `${baseName}_unprotected${ext}`,
        sheets,
        workbookProtectionRemoved,
        blob,
      })
      setStatus('done')
    } catch (e) {
      setError(`Gagal memproses file: ${e instanceof Error ? e.message : 'Unknown error'}`)
      setStatus('error')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDownload = () => {
    if (!result) return
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    setStatus('idle')
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const unprotectedSheets = result?.sheets.filter(s => s.unprotected) ?? []
  const anyProtectionFound = (result?.workbookProtectionRemoved || unprotectedSheets.length > 0)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 400, marginBottom: 6, color: '#eef2ef' }}>
        Unprotect Excel Sheet
      </h2>
      <p style={{ fontSize: 12.5, color: '#aab4bc', marginBottom: 28, margin: '0 0 28px' }}>
        Hapus proteksi sheet dan workbook dari file .xlsx tanpa perlu password. File diproses sepenuhnya di browser — tidak dikirim ke server.
      </p>

      {/* Drop zone */}
      {status === 'idle' && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#45e661' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 16,
            padding: '56px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(69,230,97,0.05)' : 'rgba(255,255,255,0.02)',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 14, color: '#eef2ef', marginBottom: 6 }}>
            Drop file Excel di sini
          </div>
          <div style={{ fontSize: 12, color: '#aab4bc' }}>
            atau klik untuk pilih file · .xlsx .xlsm .xltx .xltm
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm,.xltx,.xltm"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Processing */}
      {status === 'processing' && (
        <div style={{ textAlign: 'center', padding: '56px 32px', color: '#aab4bc', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⚙️</div>
          Memproses file...
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.25)', borderRadius: 12, padding: 20 }}>
          <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>❌ {error}</div>
          <button onClick={reset} style={btnStyle('#aab4bc')}>Coba lagi</button>
        </div>
      )}

      {/* Done */}
      {status === 'done' && result && (
        <div>
          {/* Result card */}
          <div style={{
            background: anyProtectionFound ? 'rgba(69,230,97,0.07)' : 'rgba(255,200,50,0.07)',
            border: `1px solid ${anyProtectionFound ? 'rgba(69,230,97,0.25)' : 'rgba(255,200,50,0.25)'}`,
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>{anyProtectionFound ? '✅' : '⚠️'}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#eef2ef' }}>
                  {anyProtectionFound ? 'Proteksi berhasil dihapus' : 'File tidak terproteksi'}
                </div>
                <div style={{ fontSize: 11.5, color: '#aab4bc', marginTop: 2 }}>{result.fileName}</div>
              </div>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.workbookProtectionRemoved && (
                <div style={tagStyle('#45e661')}>✓ Workbook structure protection dihapus</div>
              )}
              {unprotectedSheets.length > 0 && (
                <div style={tagStyle('#45e661')}>
                  ✓ {unprotectedSheets.length} sheet dihapus proteksinya
                  {unprotectedSheets.length <= 10 && (
                    <span style={{ color: '#aab4bc' }}>
                      {': '}
                      {unprotectedSheets.map(s => s.name).join(', ')}
                    </span>
                  )}
                </div>
              )}
              {!anyProtectionFound && (
                <div style={{ fontSize: 12.5, color: '#aab4bc' }}>
                  Tidak ditemukan proteksi di file ini. File dapat langsung digunakan.
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            {anyProtectionFound && (
              <button onClick={handleDownload} style={btnStyle('#45e661', true)}>
                ⬇️ Download file
              </button>
            )}
            <button onClick={reset} style={btnStyle('#aab4bc')}>
              Proses file lain
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function btnStyle(color: string, primary = false): React.CSSProperties {
  return {
    background: primary ? 'rgba(69,230,97,0.12)' : 'transparent',
    border: `1px solid ${color}40`,
    color,
    padding: '10px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'background 0.2s',
  }
}

function tagStyle(color: string): React.CSSProperties {
  return {
    fontSize: 12.5,
    color,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }
}
