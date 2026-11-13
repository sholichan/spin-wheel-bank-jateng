import pesertaData from './data/peserta.json'

export interface Peserta {
  no: number
  bib: string
  nama: string
  kategori: string
}

export interface SpinHistoryItem {
  id: string
  bib: number
  nama: string
  kategori: string
  reward: string
  isWin: boolean
  timestamp: string
}

export const PESERTA_PIN = '789789'
export const PESERTA_STORAGE_KEY = 'bank_jateng_peserta_v1'
export const HISTORY_STORAGE_KEY = 'bank_jateng_spin_history_v1'
export const ADMIN_TOKEN_STORAGE_KEY = 'bank_jateng_admin_token_v1'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

function getInitialPesertaList(): Peserta[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(PESERTA_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch {
      // fallback to static pesertaData
    }
  }
  return [...pesertaData]
}

export const PESERTA_LIST: Peserta[] = getInitialPesertaList()

export function loadPesertaList(): Peserta[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(PESERTA_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          PESERTA_LIST.splice(0, PESERTA_LIST.length, ...parsed)
          return PESERTA_LIST
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  return PESERTA_LIST
}

export function savePesertaList(items: Peserta[]): void {
  PESERTA_LIST.splice(0, PESERTA_LIST.length, ...items)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PESERTA_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchPesertaList(): Promise<Peserta[]> {
  try {
    const res = await fetch(`${API_BASE}/api/peserta`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json.data) && json.data.length > 0) {
        savePesertaList(json.data)
        return json.data
      }
    }
  } catch {
    // fallback to localStorage / static bundle
  }
  return loadPesertaList()
}

export async function importPesertaList(
  rawItems: unknown,
  pin: string,
): Promise<{
  ok: boolean
  count?: number
  data?: Peserta[]
  message?: string
}> {
  if (pin.trim() !== PESERTA_PIN) {
    return {
      ok: false,
      message: 'PIN proteksi salah! Masukkan PIN yang benar.',
    }
  }

  if (!Array.isArray(rawItems)) {
    return {
      ok: false,
      message: 'Format file JSON tidak valid (harus berupa array data peserta).',
    }
  }

  const normalized: Peserta[] = rawItems
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object'),
    )
    .map((item, idx) => ({
      no: Number(item.no) || idx + 1,
      bib: String(item.bib ?? '').trim(),
      nama: String(item.nama ?? '').trim(),
      kategori: String(item.kategori ?? '').trim(),
    }))
    .filter((item) => item.bib.length > 0 && item.nama.length > 0)

  if (normalized.length === 0) {
    return {
      ok: false,
      message:
        'Data peserta kosong atau tidak memiliki properti "bib" & "nama" yang valid.',
    }
  }

  const token = getAdminToken()
  try {
    const res = await fetch(`${API_BASE}/api/peserta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ pin: pin.trim(), data: normalized }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        message: json.message || 'Gagal menyimpan data peserta ke server.',
      }
    }
    if (Array.isArray(json.data)) {
      savePesertaList(json.data)
      return { ok: true, count: json.data.length, data: json.data }
    }
  } catch {
    // fallback to localStorage when running without backend API
  }

  savePesertaList(normalized)
  return { ok: true, count: normalized.length, data: normalized }
}

export function findPesertaByBib(bibInput: number | string): Peserta | undefined {
  const cleaned = String(bibInput ?? '').replace(/\D/g, '')
  if (!cleaned) return undefined
  const numericBib = Number(cleaned)
  if (!numericBib || Number.isNaN(numericBib)) return undefined
  const list = loadPesertaList()
  return list.find((p) => Number(p.bib) === numericBib)
}

export function loadSpinHistory(): SpinHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSpinHistory(items: SpinHistoryItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore storage quota errors
  }
}

/* ==========================================
   ADMIN AUTHENTICATION HELPERS
   ========================================== */

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
}

export function logoutAdmin(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
}

export async function loginAdmin(
  username: string,
  password: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (res.ok && data.ok && data.token) {
      setAdminToken(data.token)
      return { ok: true }
    }
    return {
      ok: false,
      message: data.message || 'Username atau password salah!',
    }
  } catch {
    // Fallback jika dijalankan secara statis murni tanpa backend API
    const fallbackUser = import.meta.env.VITE_ADMIN_USERNAME || 'admin'
    const fallbackPass = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123'
    if (username.trim() === fallbackUser && password === fallbackPass) {
      setAdminToken('local-fallback-token')
      return { ok: true }
    }
    return { ok: false, message: 'Username atau password salah!' }
  }
}

export async function verifyAdminSession(): Promise<boolean> {
  const token = getAdminToken()
  if (!token) return false
  if (token === 'local-fallback-token') return true

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      logoutAdmin()
      return false
    }
    return true
  } catch {
    return true
  }
}

/* ==========================================
   SPIN HISTORY ONLINE API + LOCAL FALLBACK
   ========================================== */

export async function fetchSpinHistory(): Promise<SpinHistoryItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/history`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('Failed to fetch')
    const json = await res.json()
    if (Array.isArray(json.data)) {
      saveSpinHistory(json.data)
      return json.data
    }
  } catch {
    // fallback to localStorage
  }
  return loadSpinHistory()
}

export async function addSpinHistoryRecord(record: {
  bib: number
  nama: string
  kategori: string
  reward: string
  isWin: boolean
}): Promise<SpinHistoryItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    if (res.ok || res.status === 409) {
      const json = await res.json()
      if (Array.isArray(json.data)) {
        saveSpinHistory(json.data)
        return json.data
      }
    }
  } catch {
    // fallback to localStorage below
  }

  const current = loadSpinHistory()
  const newItem: SpinHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bib: record.bib,
    nama: record.nama,
    kategori: record.kategori,
    reward: record.reward,
    isWin: record.isWin,
    timestamp: new Date().toISOString(),
  }
  const updated = [newItem, ...current]
  saveSpinHistory(updated)
  return updated
}

export async function deleteSpinHistoryRecord(
  id: string,
): Promise<SpinHistoryItem[]> {
  const token = getAdminToken()
  try {
    const res = await fetch(
      `${API_BASE}/api/history/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    )
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json.data)) {
        saveSpinHistory(json.data)
        return json.data
      }
    }
  } catch {
    // fallback to localStorage below
  }

  const current = loadSpinHistory()
  const updated = current.filter((item) => item.id !== id)
  saveSpinHistory(updated)
  return updated
}

export async function clearSpinHistory(): Promise<SpinHistoryItem[]> {
  const token = getAdminToken()
  try {
    const res = await fetch(`${API_BASE}/api/history`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      saveSpinHistory([])
      return []
    }
  } catch {
    // fallback to localStorage below
  }

  saveSpinHistory([])
  return []
}
