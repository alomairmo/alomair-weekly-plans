import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const cloudflareDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(cloudflareDir, '..')

await build({
  entryPoints: [path.join(cloudflareDir, 'worker.ts')],
  outfile: path.join(cloudflareDir, 'dist', 'worker.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: false,
  define: { 'process.env': '{}' },
  plugins: [
    {
      name: 'cloudflare-runtime-shims',
      setup(buildApi) {
        buildApi.onResolve({ filter: /^ws$/ }, () => ({
          path: 'cloudflare-websocket',
          namespace: 'cloudflare-websocket',
        }))
        buildApi.onLoad({ filter: /.*/, namespace: 'cloudflare-websocket' }, () => ({
          contents: 'export default globalThis.WebSocket',
          loader: 'ts',
        }))
        buildApi.onResolve({ filter: /(^|\/)(logger)$/ }, () => ({
          path: path.join(cloudflareDir, 'logger-shim.ts'),
        }))
      },
    },
  ],
  absWorkingDir: root,
})
