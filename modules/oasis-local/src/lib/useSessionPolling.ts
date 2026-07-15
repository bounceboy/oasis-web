import { useEffect, useRef, useState } from 'react'

interface SessionData {
  status: 'processing' | 'selesai' | 'error'
  hasil?: Record<string, unknown>
  error?: string
}

// Poll status sesi analisis sampai selesai/error.
// sessionId null = tidak polling. onComplete dipanggil sekali saat status final.
export function useSessionPolling(sessionId: string | null, onComplete?: (data: SessionData) => void) {
  const [data, setData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(!!sessionId)
  const [error, setError] = useState<string | null>(null)

  // Simpan callback di ref supaya interval tidak di-reset setiap render
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    setLoading(true)
    let isActive = true

    async function poll() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`)
        if (!res.ok) return // transient error — coba lagi di tick berikutnya

        const result = await res.json() as SessionData
        if (!isActive) return

        setData(result)
        if (result.status === 'selesai' || result.status === 'error') {
          setLoading(false)
          clearInterval(pollInterval)
          onCompleteRef.current?.(result)
        }
      } catch (err) {
        if (isActive) setError(err instanceof Error ? err.message : 'Polling error')
      }
    }

    const pollInterval = setInterval(poll, 2000)
    poll() // cek langsung tanpa nunggu tick pertama

    return () => {
      isActive = false
      clearInterval(pollInterval)
    }
  }, [sessionId])

  return { data, loading, error }
}
