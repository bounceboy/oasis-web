import { useEffect, useState } from 'react'

interface SessionData {
  status: 'processing' | 'selesai' | 'error'
  hasil?: Record<string, unknown>
  error?: string
}

export function useSessionPolling(sessionId: string | null, onComplete?: (data: SessionData) => void) {
  const [data, setData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(!!sessionId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    let isActive = true
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`)
        if (!res.ok) {
          setError('Gagal fetch status')
          return
        }

        const result = await res.json() as SessionData
        if (isActive) {
          setData(result)

          if (result.status === 'selesai' || result.status === 'error') {
            setLoading(false)
            clearInterval(pollInterval)
            onComplete?.(result)
          }
        }
      } catch (err) {
        if (isActive) setError(err instanceof Error ? err.message : 'Polling error')
      }
    }, 2000) // Poll setiap 2 detik

    return () => {
      isActive = false
      clearInterval(pollInterval)
    }
  }, [sessionId, onComplete])

  return { data, loading, error }
}
