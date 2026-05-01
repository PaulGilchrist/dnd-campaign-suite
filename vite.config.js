import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost',
                changeOrigin: true,
     },
          },
      },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/tests/setup.js',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json'],
            reportsDirectory: './coverage',
            exclude: [
                'node_modules/',
                'dist/',
                'public/',
                'vite.config.js',
                'server.js',
                '**/*.css',
                '**/*.stories.{js,jsx,ts,tsx}'
            ],
            thresholds: {
                lines: 0,
                branches: 0,
                functions: 0,
                statements: 0
            }
        },
        include: ['src/**/*.{test,spec}.{js,jsx}'],
        exclude: ['node_modules', 'dist', '.git']
    }
})
