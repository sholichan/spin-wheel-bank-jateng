import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const LOCAL_DATA_DIR = path.resolve(__dirname, '../data')
const LOCAL_HISTORY_FILE = path.join(LOCAL_DATA_DIR, 'spin-history.json')
const TMP_HISTORY_FILE = path.join(os.tmpdir(), 'bank-jateng-spin-history.json')

const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV)

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || process.env.VITE_ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'admin123'
const TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || 'bank-jateng-spin-secret-2026'

const KV_URL = (process.env.KV_REST_API_URL || '').replace(/\/+$/, '')
const KV_TOKEN = process.env.KV_REST_API_TOKEN || ''
const KV_KEY = 'bank_jateng_spin_history_v1'

let memoryHistory = null

function getActiveStorageFile() {
  if (IS_VERCEL) {
    return TMP_HISTORY_FILE
  }
  return LOCAL_HISTORY_FILE
}

function ensureStorageFile() {
  const targetFile = getActiveStorageFile()
  const targetDir = path.dirname(targetFile)

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  if (!fs.existsSync(targetFile)) {
    // Jika berjalan di Vercel (/tmp belum ada), salin data awal dari repo jika tersedia
    if (IS_VERCEL && fs.existsSync(LOCAL_HISTORY_FILE)) {
      try {
        const seed = fs.readFileSync(LOCAL_HISTORY_FILE, 'utf-8')
        fs.writeFileSync(targetFile, seed, 'utf-8')
        return targetFile
      } catch {
        // fallback ke array kosong di bawah
      }
    }
    fs.writeFileSync(targetFile, '[]', 'utf-8')
  }

  return targetFile
}

async function readHistory() {
  // 1. Jika Vercel KV / Upstash Redis dikonfigurasi, gunakan KV agar persisten lintas cold-start
  if (KV_URL && KV_TOKEN) {
    try {
      const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json && typeof json.result === 'string') {
          const parsed = JSON.parse(json.result)
          if (Array.isArray(parsed)) {
            memoryHistory = parsed
            return parsed
          }
        } else if (json && json.result === null) {
          return []
        }
      }
    } catch {
      // fallback ke file / memory
    }
  }

  // 2. Baca dari file storage (/tmp di Vercel atau ./data di lokal)
  try {
    const file = ensureStorageFile()
    const raw = fs.readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      memoryHistory = parsed
      return parsed
    }
  } catch {
    if (Array.isArray(memoryHistory)) {
      return memoryHistory
    }
  }

  return []
}

async function writeHistory(items) {
  memoryHistory = items

  // 1. Simpan ke Vercel KV / Upstash Redis jika tersedia
  if (KV_URL && KV_TOKEN) {
    try {
      await fetch(`${KV_URL}/set/${KV_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(JSON.stringify(items)),
      })
    } catch {
      // lanjut simpan ke file lokal / tmp
    }
  }

  // 2. Simpan ke disk (/tmp di Vercel atau ./data di lokal)
  try {
    const file = ensureStorageFile()
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf-8')
  } catch {
    // Jika direktori lokal read-only, fallback paksa ke os.tmpdir()
    try {
      fs.writeFileSync(TMP_HISTORY_FILE, JSON.stringify(items, null, 2), 'utf-8')
    } catch {
      // tetap tersimpan di memoryHistory
    }
  }
}

function generateAdminToken(username) {
  const payload = `${username}:${TOKEN_SECRET}`
  return crypto.createHash('sha256').update(payload).digest('hex')
}

function isAuthorized(req) {
  const authHeader =
    req.headers['authorization'] || req.headers['Authorization'] || ''
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return false
  }
  const token = authHeader.slice('Bearer '.length).trim()
  const expected = generateAdminToken(ADMIN_USERNAME)
  return token === expected
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.end(JSON.stringify(payload))
}

function parseJsonBody(req) {
  // Vercel Serverless Functions otomatis mem-parse req.body
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return Promise.resolve(req.body)
    }
    if (typeof req.body === 'string') {
      if (!req.body.trim()) return Promise.resolve({})
      try {
        return Promise.resolve(JSON.parse(req.body))
      } catch (err) {
        return Promise.reject(err)
      }
    }
    if (Buffer.isBuffer(req.body)) {
      const raw = req.body.toString('utf-8').trim()
      if (!raw) return Promise.resolve({})
      try {
        return Promise.resolve(JSON.parse(raw))
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }

  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1e6) {
        reject(new Error('Payload too large'))
      }
    })
    req.on('end', () => {
      if (!body) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function resolveApiPathname(req) {
  const urlObj = new URL(
    req.url || '/',
    `http://${req.headers.host || 'localhost'}`,
  )
  let pathname = urlObj.pathname

  // Dukungan rewrite Vercel: /api/(.*) -> /api/index.js?__path=$1
  const rewrittenPath = urlObj.searchParams.get('__path')
  if (
    rewrittenPath !== null &&
    (pathname === '/api' ||
      pathname === '/api/' ||
      pathname === '/api/index' ||
      pathname === '/api/index.js')
  ) {
    const cleanSubpath = rewrittenPath.replace(/^\/+/, '')
    pathname = cleanSubpath ? `/api/${cleanSubpath}` : '/api'
  }

  return pathname.replace(/\/+$/, '') || '/'
}

export async function handleApiRequest(req, res) {
  const pathname = resolveApiPathname(req)

  if (!pathname.startsWith('/api/')) {
    return false
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return true
  }

  // POST /api/auth/login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req)
      const username = String(body.username || '').trim()
      const password = String(body.password || '')

      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateAdminToken(username)
        sendJson(res, 200, {
          ok: true,
          token,
          user: { username },
        })
      } else {
        sendJson(res, 401, {
          ok: false,
          message: 'Username atau password salah!',
        })
      }
    } catch {
      sendJson(res, 400, { ok: false, message: 'Format request tidak valid.' })
    }
    return true
  }

  // GET /api/auth/verify
  if (pathname === '/api/auth/verify' && req.method === 'GET') {
    if (isAuthorized(req)) {
      sendJson(res, 200, { ok: true, user: { username: ADMIN_USERNAME } })
    } else {
      sendJson(res, 401, {
        ok: false,
        message: 'Sesi tidak valid atau telah berakhir.',
      })
    }
    return true
  }

  // GET /api/history
  if (pathname === '/api/history' && req.method === 'GET') {
    const items = await readHistory()
    sendJson(res, 200, { ok: true, data: items })
    return true
  }

  // POST /api/history
  if (pathname === '/api/history' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req)
      const bib = Number(body.bib)
      const nama = String(body.nama || '').trim()
      const kategori = String(body.kategori || '').trim()
      const reward = String(body.reward || '').trim()
      const isWin = Boolean(body.isWin)

      if (!bib || !nama || !reward) {
        sendJson(res, 400, { ok: false, message: 'Data spin tidak lengkap.' })
        return true
      }

      const current = await readHistory()

      // Cegah duplikasi BIB di sisi server
      const alreadyPlayed = current.some((item) => Number(item.bib) === bib)
      if (alreadyPlayed) {
        sendJson(res, 409, {
          ok: false,
          code: 'ALREADY_PLAYED',
          message: `Nomor BIB "${bib}" sudah pernah bermain dan tidak bisa bermain lagi!`,
          data: current,
        })
        return true
      }

      const newItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        bib,
        nama,
        kategori,
        reward,
        isWin,
        timestamp: new Date().toISOString(),
      }

      const updated = [newItem, ...current]
      await writeHistory(updated)

      sendJson(res, 201, { ok: true, item: newItem, data: updated })
    } catch {
      sendJson(res, 400, { ok: false, message: 'Gagal menyimpan data spin.' })
    }
    return true
  }

  // DELETE /api/history/:id
  if (pathname.startsWith('/api/history/') && req.method === 'DELETE') {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, message: 'Unauthorized' })
      return true
    }
    const id = decodeURIComponent(pathname.slice('/api/history/'.length))
    const current = await readHistory()
    const updated = current.filter((item) => item.id !== id)
    await writeHistory(updated)
    sendJson(res, 200, { ok: true, data: updated })
    return true
  }

  // DELETE /api/history (clear all)
  if (pathname === '/api/history' && req.method === 'DELETE') {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, message: 'Unauthorized' })
      return true
    }
    await writeHistory([])
    sendJson(res, 200, { ok: true, data: [] })
    return true
  }

  sendJson(res, 404, { ok: false, message: 'API endpoint tidak ditemukan.' })
  return true
}
