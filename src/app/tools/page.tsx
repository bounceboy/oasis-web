'use client'

import { useState } from 'react'
import Link from 'next/link'
import ImageToPdf from '@/components/tools/ImageToPdf'
import MergePdf from '@/components/tools/MergePdf'
import SplitPdf from '@/components/tools/SplitPdf'
import PdfPageEditor from '@/components/tools/PdfPageEditor'

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<'image-to-pdf' | 'merge' | 'split' | 'page-editor'>('image-to-pdf')

  return (
    <div style={{ minHeight: '100vh', background: '#04070b', color: '#eef2ef', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/dashboard" style={{ fontSize: 11.5, color: '#45e661', textDecoration: 'none', marginBottom: 20, display: 'inline-block', letterSpacing: '0.05em' }}>
            Kembali ke Dashboard
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 300, margin: '20px 0 8px', letterSpacing: '-0.5px' }}>PDF Tools</h1>
          <p style={{ fontSize: 12.5, color: '#aab4bc', margin: 0 }}>Konversi gambar, gabung, hapus, atau susun ulang halaman PDF</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { id: 'image-to-pdf' as const, label: 'Image to PDF' },
            { id: 'merge' as const, label: 'Merge PDF' },
            { id: 'split' as const, label: 'Split PDF' },
            { id: 'page-editor' as const, label: 'Remove / Rearrange Page' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #45e661' : '2px solid transparent',
                color: activeTab === tab.id ? '#45e661' : '#aab4bc',
                padding: '12px 24px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 500 : 400,
                transition: 'color 0.2s, border-color 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: 'rgba(8,12,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 40 }}>
          {activeTab === 'image-to-pdf' && <ImageToPdf />}
          {activeTab === 'merge' && <MergePdf />}
          {activeTab === 'split' && <SplitPdf />}
          {activeTab === 'page-editor' && <PdfPageEditor />}
        </div>
      </div>
    </div>
  )
}
