'use client'

interface ProgressLogProps {
  title: string
  hint?: string
  logs: string[]
  active?: boolean
}

export default function ProgressLog({ title, hint, logs, active = true }: ProgressLogProps) {
  return (
    <div
      style={{
        background: 'rgba(8,12,18,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        padding: 56,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: '#45e661',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 20px',
        }}
      />
      <div style={{ fontWeight: 500, fontSize: 15, color: '#eef2ef' }}>{title}</div>
      {hint && <div style={{ fontSize: 12, color: '#aab4bc', marginTop: 6 }}>{hint}</div>}

      {logs.length > 0 && (
        <div
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 12,
            padding: 12,
            marginTop: 20,
            maxHeight: 200,
            overflowY: 'auto',
            textAlign: 'left',
          }}
        >
          {logs.map((l, i) => (
            <p
              key={i}
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                color: i === logs.length - 1 ? '#45e661' : '#aab4bc',
                margin: '2px 0',
              }}
            >
              {l}
            </p>
          ))}
          {active && (
            <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#45e661', margin: '4px 0' }}>▋</p>
          )}
        </div>
      )}
    </div>
  )
}
