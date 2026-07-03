export type MaskingEntity = {
  original: string
  token: string
  category: 'PERSON' | 'COMPANY' | 'PRODUCT' | 'NIK'
}

export type MaskingVault = {
  [token: string]: string
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

export type OasisRole = 'admin' | 'supervisor' | 'pemeriksa'
export type UserStatus = 'active' | 'suspended' | 'pending'

export type OasisProfile = {
  id: string
  nama_lengkap: string
  role: OasisRole
  direktorat: string
  departemen: string
  nip: string
  status: UserStatus
  last_login: string | null
  created_at: string
  updated_at: string
  // joined dari auth.users
  email?: string
}

export type PemeriksaanSession = {
  id: string
  user_id: string
  nama_entitas: string
  jenis_usaha: string
  jenis_pemeriksaan: string
  dokumen_nama: string
  direktorat: string
  departemen: string
  status: 'draft' | 'processing' | 'selesai' | 'error'
  hasil_compliance: string | null
  hasil_risk: string | null
  created_at: string
}
