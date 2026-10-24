import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react()
    ],
    build: {
        chunkSizeWarningLimit: 10000,
        rollupOptions: {
            output: {
                // Content-hash JS/CSS so browsers never serve a stale bundle —
                // the server caches hashed assets with immutable 1-year headers.
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                codeSplitting: true,
                assetFileNames: (chunkInfo) => {
                    // Don't hash image files - keep original names for faster deployments
                    if (chunkInfo.type === 'asset' && chunkInfo.name && /\.(jpg|jpeg|png|gif|webp)$/i.test(chunkInfo.name)) {
                        return `assets/${chunkInfo.name}`;
                    }
                    return 'assets/[name]-[hash].[ext]';
                }
            }
        },
        copyPublicDir: true,
        outDir: 'dist',
        emptyOutDir: true
    },
    server: {
        // changeOrigin MUST stay false on every proxied lane: all server-side
        // GM authority guards (notes.js, quests.js, maps.js, campaigns-admin.js,
        // keyValidators.js validateAuthority, ...) read req.hostname. With
        // changeOrigin:true the proxy rewrote Host to localhost:80 so every LAN
        // client browsing :5173 was indistinguishable from the GM (private notes
        // leaked, forged GM-only writes were accepted — bug-vite-proxy-localhost-guard-bypass).
        // Express does not virtual-host on Host, so forwarding the real Host is safe.
        proxy: {
            '/api': {
                target: 'http://localhost:80',
                changeOrigin: false,
            },
            '/subscribe': {
                target: 'http://localhost:80',
                changeOrigin: false,
                ws: false,
                timeout: 0,
                proxyTimeout: 0,
            },
            '/spell-overlay': {
                target: 'http://localhost:80',
                changeOrigin: false,
            },
        },
    }
})
