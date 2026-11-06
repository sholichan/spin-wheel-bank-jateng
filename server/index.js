import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApiRequest } from './apiMiddleware.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DIST_DIR = path.resolve(__dirname, '../dist')
const PORT = Number(process.env.PORT || 3000)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = http.createServer(async (req, res) => {
  try {
    const handled = await handleApiRequest(req, res)
    if (handled) return

    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const cleanRoute = urlObj.pathname.toLowerCase().replace(/\/+$/, '')

    if (cleanRoute === '/admin') {
      const adminHtml = path.join(DIST_DIR, 'admin.html')
      if (fs.existsSync(adminHtml)) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        fs.createReadStream(adminHtml).pipe(res)
        return
      }
    }

    let safePath = path.normalize(decodeURIComponent(urlObj.pathname)).replace(/^(\.\.(\/|\\|$))+/, '')
    let filePath = path.join(DIST_DIR, safePath)

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase()
      res.statusCode = 200
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
      fs.createReadStream(filePath).pipe(res)
      return
    }

    // SPA Fallback for routes like / and /admin
    const indexHtml = path.join(DIST_DIR, 'index.html')
    if (fs.existsSync(indexHtml)) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      fs.createReadStream(indexHtml).pipe(res)
      return
    }

    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Build folder (dist) belum tersedia. Jalankan "npm run build" terlebih dahulu.')
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, message: 'Internal Server Error', error: String(err) }))
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server berjalan di http://localhost:${PORT}`)
  console.log(`- Halaman Spin Wheel (Portrait): http://localhost:${PORT}/`)
  console.log(`- Halaman Admin (Responsive):    http://localhost:${PORT}/admin`)
})

