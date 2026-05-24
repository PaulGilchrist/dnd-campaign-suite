import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                entryFileNames: 'assets/index.js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: (chunkInfo) => {
                    // Don't hash image files - keep original names for faster deployments
                    if (chunkInfo.type === 'asset' && chunkInfo.name && /\.(jpg|jpeg|png|gif|webp)$/i.test(chunkInfo.name)) {
                        return `assets/${chunkInfo.name}`;
                    }
                    return 'assets/[name].[ext]';
                }
            }
        },
        copyPublicDir: true,
        outDir: 'dist',
        emptyOutDir: true
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:80',
                changeOrigin: true,
            },
            '/subscribe': {
                target: 'http://localhost:80',
                changeOrigin: true,
                ws: false,
                timeout: 0,
                proxyTimeout: 0,
            },
        },
    }
})
