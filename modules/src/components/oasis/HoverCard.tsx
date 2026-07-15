'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function HoverCard({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        background: hovered ? 'rgba(69,230,97,0.08)' : 'rgba(8,12,18,0.85)',
        border: `1px solid ${hovered ? 'rgba(69,230,97,0.4)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 24,
        padding: '22px 28px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </Link>
  )
}
