import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        environmentOptions: {
            jsdom: {
                url: 'http://localhost/',
            },
        },
        define: {
            'globalThis': 'globalThis',
        },
        coverage: {
            all: true,
            clean: true,
            cleanOnRerun: true,
            reportsDirectory: './coverage',
            tempDirectory: './.coverage-tmp',  // outside coverage folder
            reporter: ['text', 'json', 'html', 'lcov'],
            provider: 'v8',
            exclude: [
                'node_modules/',
                '**/*.test.js',
                '**/*.test.jsx',
                '**/*.css',
                '**/*.scss',
                '**/*.sass',
                '**/*.less',
                '**/*.jpg',
                '**/*.jpeg',
                '**/*.png',
                '**/*.gif',
                '**/*.svg',
                '**/*.webp',
                '**/*.ico',
                '**/*.mp3',
                '**/*.mp4',
                '**/*.woff',
                '**/*.woff2',
                '**/*.ttf',
                '**/*.eot'
            ],
        },
        include: ['src/**/*.{test,spec}.{js,jsx}', 'src/**/*.{test,spec}.*.{js,jsx}', 'server/**/*.{test,spec}.{js,jsx}', 'server/**/*.{test,spec}.*.{js,jsx}', 'vite.config.test.js'],
        exclude: ['node_modules', 'dist', '.git', '**/*.test.setup.js']
    },
});
