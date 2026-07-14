'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type SkillConfig = {
  id: string
  modul: string
  nama: string
  deskripsi: string
  prompt_template: string
  bobot_risiko: Record<string, number>
  updated_at: string
}

const MODUL_LABELS: Record<string, string> = {
  psak117: 'PSAK 117',
  lhptl: 'LHPTL',
  kyic: 'KYIC/KYNBFI',
  renbis: 'Renbis',
}

export default function SkillsConfigPage() {
  const [skills, setSkills] = useState<SkillConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SkillConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/skills')
      .then(r => r.json())
      .then(data => { setSkills(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function openEdit(skill: SkillConfig) {
    setSelected({ ...skill, bobot_risiko: { ...skill.bobot_risiko } })
    setSaved(false)
    setError(null)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/skills/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: selected.nama,
          deskripsi: selected.deskripsi,
          prompt_template: selected.prompt_template,
          bobot_risiko: selected.bobot_risiko,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated: SkillConfig = await res.json()
      setSkills(prev => prev.map(s => s.id === updated.id ? updated : s))
      setSelected(updated)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  function updateBobot(key: string, val: string) {
    if (!selected) return
    const num = parseFloat(val)
    setSelected(prev => prev ? { ...prev, bobot_risiko: { ...prev.bobot_risiko, [key]: isNaN(num) ? 0 : num } } : prev)
  }

  function addBobot() {
    if (!selected) return
    const key = prompt('Nama parameter bobot risiko:')
    if (!key) return
    setSelected(prev => prev ? { ...prev, bobot_risiko: { ...prev.bobot_risiko, [key]: 1 } } : prev)
  }

  function removeBobot(key: string) {
    if (!selected) return
    const next = { ...selected.bobot_risiko }
    delete next[key]
    setSelected(prev => prev ? { ...prev, bobot_risiko: next } : prev)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-slate-400 hover:text-white text-sm transition-colors">← Admin</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium">Skills Config</span>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold mb-2">Konfigurasi Skills per Modul</h1>
        <p className="text-slate-500 text-sm mb-8">Edit nama, deskripsi, prompt template, dan bobot risiko untuk setiap modul pengawasan.</p>

        {loading ? (
          <p className="text-slate-500 text-sm">Memuat...</p>
        ) : skills.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-400 text-sm mb-2">Belum ada konfigurasi skill.</p>
            <p className="text-slate-600 text-xs">Jalankan SQL inisialisasi di Supabase untuk membuat data default.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {skills.map(skill => (
              <div key={skill.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400">
                      {MODUL_LABELS[skill.modul] ?? skill.modul}
                    </span>
                    <span className="text-slate-600 text-xs">
                      Diperbarui {new Date(skill.updated_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                  <p className="font-medium text-sm">{skill.nama}</p>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">{skill.deskripsi}</p>
                  <p className="text-slate-600 text-xs mt-1">
                    {Object.keys(skill.bobot_risiko).length} parameter bobot
                  </p>
                </div>
                <button
                  onClick={() => openEdit(skill)}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Panel (slide-over style) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setSelected(null)} />
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <p className="font-semibold text-sm">{MODUL_LABELS[selected.modul] ?? selected.modul}</p>
                <p className="text-slate-500 text-xs">Edit konfigurasi skill</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nama Skill</label>
                <input
                  value={selected.nama}
                  onChange={e => setSelected(p => p ? { ...p, nama: e.target.value } : p)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Deskripsi</label>
                <textarea
                  value={selected.deskripsi}
                  onChange={e => setSelected(p => p ? { ...p, deskripsi: e.target.value } : p)}
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Prompt Template</label>
                <textarea
                  value={selected.prompt_template}
                  onChange={e => setSelected(p => p ? { ...p, prompt_template: e.target.value } : p)}
                  rows={10}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400">Bobot Risiko</label>
                  <button onClick={addBobot}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors">+ Tambah</button>
                </div>
                <div className="space-y-2">
                  {Object.entries(selected.bobot_risiko).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-slate-300 bg-slate-800 rounded px-2 py-1.5 font-mono truncate">{key}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={val}
                        onChange={e => updateBobot(key, e.target.value)}
                        className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white text-right focus:outline-none focus:border-blue-500"
                      />
                      <button onClick={() => removeBobot(key)}
                        className="text-slate-600 hover:text-red-400 text-sm transition-colors">×</button>
                    </div>
                  ))}
                  {Object.keys(selected.bobot_risiko).length === 0 && (
                    <p className="text-slate-600 text-xs italic">Belum ada parameter bobot.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 flex items-center gap-3">
              {error && <p className="text-red-400 text-xs flex-1">{error}</p>}
              {saved && !error && <p className="text-green-400 text-xs flex-1">Tersimpan</p>}
              {!error && !saved && <span className="flex-1" />}
              <button onClick={() => setSelected(null)}
                className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-2">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg transition-colors">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
