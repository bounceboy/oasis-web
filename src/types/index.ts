export type MaskingEntity = {
  original: string
  token: string
  category: 'PERSON' | 'COMPANY' | 'PRODUCT' | 'NIK'
}

export type MaskingVault = {
  [token: string]: string // token -> original
}

export type PojkChunk = {
  id: string
  pojk_id: string
  pasal: string
  content: string
  embedding?: number[]
}

export type AnalysisResult = {
  compliance: string
  risk: string
  entities_found: MaskingEntity[]
  demasked: boolean
}

export type PemeriksaanSession = {
  id: string
  user_id: string
  nama_entitas: string
  jenis_pemeriksaan: string
  dokumen_nama: string
  status: 'draft' | 'processing' | 'selesai'
  hasil_compliance: string | null
  hasil_risk: string | null
  created_at: string
}
