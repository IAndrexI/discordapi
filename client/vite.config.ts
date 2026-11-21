import { createRequire } from 'node:module'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const requireFromHere = createRequire(import.meta.url)
const currentDir = path.dirname(fileURLToPath(import.meta.url))

function protutechSelfHostedBackend(): Plugin {
  const serverPath = path.resolve(currentDir, 'electron/selfHostedServer.cjs')
  const { createRequestHandler } = requireFromHere(serverPath) as {
    createRequestHandler: (
      dataDir?: string
    ) => (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }

  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(currentDir, 'server-data')
  const handler = createRequestHandler(dataDir)

  const attachBackendMiddleware = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => {
      const pathname = (req.url || '').split('?')[0]
      if (
        pathname === '/api' ||
        pathname.startsWith('/api/') ||
        pathname.startsWith('/_matrix/')
      ) {
        void Promise.resolve(handler(req, res)).catch((err: unknown) => {
          console.error('[protutech-self-hosted-backend]', err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Self-hosted backend error' }))
          }
        })
        return
      }
      next()
    })
  }

  return {
    name: 'protutech-self-hosted-backend',
    configureServer(server) {
      attachBackendMiddleware(server.middlewares)
    },
    configurePreviewServer(server) {
      attachBackendMiddleware(server.middlewares)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    protutechSelfHostedBackend(),
  ],
  base: './',
  optimizeDeps: {
    include: ['react', 'react-dom', 'livekit-client', 'lucide-react'],
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'vendor-livekit',
              test: /[\\/]node_modules[\\/](livekit-client|@livekit[\\/]|webrtc-adapter|sdp-transform)[\\/]/,
            },
            {
              name: 'vendor-icons',
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            },
          ],
        },
      },
    },
  },
})
