'use client'

interface StepIndicatorProps {
  steps: string[]
  currentIndex: number
}

export default function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: 28 }}>
      {steps.map((label, i) => {
        const isDone = i < currentIndex
        const isActive = i === currentIndex
        const isFilled = i <= currentIndex
        const isLast = i === steps.length - 1

        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : '1 1 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  fontSize: 11,
                  fontWeight: 600,
                  color: isFilled ? '#04120a' : '#aab4bc',
                  background: isFilled ? '#45e661' : 'rgba(255,255,255,0.08)',
                  border: isFilled ? 'none' : '1px solid rgba(255,255,255,0.15)',
                  flexShrink: 0,
                  transition: 'background-color 0.2s, color 0.2s',
                }}
              >
                {isDone ? '✓' : i + 1}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  color: isFilled ? '#eef2ef' : '#aab4bc',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: '1 1 auto',
                  minWidth: 24,
                  height: 1,
                  margin: '0 12px',
                  background: i < currentIndex ? '#45e661' : 'rgba(255,255,255,0.15)',
                  transition: 'background-color 0.2s',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
