import { defineConfig } from 'vite'
import { terser } from 'rollup-plugin-terser'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react()
    ],
    build: {
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            output: {
                entryFileNames: 'assets/index.js',
                chunkFileNames: 'assets/[name].js',
                codeSplitting: true,
                assetFileNames: (chunkInfo) => {
                    // Don't hash image files - keep original names for faster deployments
                    if (chunkInfo.type === 'asset' && chunkInfo.name && /\.(jpg|jpeg|png|gif|webp)$/i.test(chunkInfo.name)) {
                        return `assets/${chunkInfo.name}`;
                    }
                    return 'assets/[name].[ext]';
                }
            },
            plugins: [
                terser({
                    format: {
                        comments: false,
                    },
                    compress: {
                        // Remove whitespace in JSON imports
                        passes: 2,
                    }
                })
            ]
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
            '/spell-overlay': {
                target: 'http://localhost:80',
                changeOrigin: true,
            },
        },
    }
})
