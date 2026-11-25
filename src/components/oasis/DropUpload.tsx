'use client'

import { useEffect } from 'react'

/**
 * Seret-dan-lepas untuk semua kotak unggah: elemen yang memuat satu <input type="file">
 * sebagai anak langsung menerima berkas yang dijatuhkan di atasnya, lalu onChange input itu
 * terpanggil seperti saat berkas dipilih lewat klik. Kotak yang sudah menangani drop sendiri
 * (memanggil preventDefault) dilewati. Menjatuhkan berkas di luar kotak diabaikan, sehingga
 * peramban tidak membuka berkas tersebut dan meninggalkan halaman.
 */
export default function DropUpload() {
  useEffect(() => {
    let aktif: HTMLElement | null = null
    const tandai = (el: HTMLElement | null) => {
      if (el === aktif) return
      if (aktif) { aktif.style.outline = ''; aktif.style.outlineOffset = '' }
      aktif = el
      if (el) { el.style.outline = '2px solid #45e661'; el.style.outlineOffset = '2px' }
    }
    const adaBerkas = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files')
    const cariZona = (target: EventTarget | null) => {
      let el = target instanceof Element ? target : null
      while (el && el !== document.body) {
        const inputs = el.querySelectorAll<HTMLInputElement>(':scope > input[type="file"]')
        if (inputs.length === 1) return { zona: el as HTMLElement, input: inputs[0] }
        el = el.parentElement
      }
      return null
    }
    const cocok = (f: File, accept: string) => {
      const daftar = accept.split(',').map(s => s.trim().toLowerCase()).filter(s => s.startsWith('.'))
      return !daftar.length || daftar.some(x => f.name.toLowerCase().endsWith(x))
    }

    const onOver = (e: DragEvent) => {
      if (e.defaultPrevented || !adaBerkas(e)) { tandai(null); return }
      e.preventDefault()
      const z = cariZona(e.target)
      const boleh = !!z && !z.input.disabled
      if (e.dataTransfer) e.dataTransfer.dropEffect = boleh ? 'copy' : 'none'
      tandai(boleh ? z!.zona : null)
    }
    const onDrop = (e: DragEvent) => {
      tandai(null)
      if (e.defaultPrevented || !adaBerkas(e)) return
      e.preventDefault()
      const z = cariZona(e.target)
      if (!z || z.input.disabled) return
      const semua = Array.from(e.dataTransfer?.files || [])
      const sesuai = semua.filter(f => cocok(f, z.input.accept))
      if (!sesuai.length) { alert(`Format berkas tidak sesuai. Yang diterima: ${z.input.accept}`); return }
      const dt = new DataTransfer()
      for (const f of z.input.multiple ? sesuai : sesuai.slice(0, 1)) dt.items.add(f)
      z.input.files = dt.files
      z.input.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const onLeave = (e: DragEvent) => { if (!e.relatedTarget) tandai(null) }
    const onEnd = () => tandai(null)

    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragend', onEnd)
    return () => {
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragend', onEnd)
    }
  }, [])
  return null
}
