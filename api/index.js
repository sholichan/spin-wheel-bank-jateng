import { handleApiRequest } from '../server/apiMiddleware.js'

export default async function handler(req, res) {
  try {
    const handled = await handleApiRequest(req, res)
    if (!handled) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({ ok: false, message: 'API endpoint tidak ditemukan.' }),
      )
    }
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        ok: false,
        message: 'Internal Server Error',
        error: String(err),
      }),
    )
  }
}

