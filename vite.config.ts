import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
// @ts-expect-error JS middleware module
import { handleApiRequest } from './server/apiMiddleware.js'

function spinWheelApiAndRoutePlugin(): Plugin {
  return {
    name: 'spin-wheel-api-and-mpa-routes',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleApiRequest(req, res)
        if (handled) return

        const rawUrl = req.url || '/'
        const [pathname, query] = rawUrl.split('?')
        const cleanPath = pathname.toLowerCase().replace(/\/+$/, '')
        if (cleanPath === '/admin') {
          req.url = `/admin.html${query ? `?${query}` : ''}`
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleApiRequest(req, res)
        if (handled) return

        const rawUrl = req.url || '/'
        const [pathname, query] = rawUrl.split('?')
        const cleanPath = pathname.toLowerCase().replace(/\/+$/, '')
        if (cleanPath === '/admin') {
          req.url = `/admin.html${query ? `?${query}` : ''}`
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), spinWheelApiAndRoutePlugin()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
      },
    },
  },
})
