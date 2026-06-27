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
            clean: false,
            cleanOnRerun: false,
            reportsDirectory: './coverage',
            tempDirectory: './.coverage-tmp',  // outside coverage folder
            reporter: ['text', 'json', 'html', 'lcov'],
            provider: 'v8',
            exclude: [
                'node_modules/',
                'src/test/',
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
        include: ['src/**/*.{test,spec}.{js,jsx}', 'server/**/*.{test,spec}.{js,jsx}'],
        exclude: ['node_modules', 'dist', '.git', '**/*.test.helpers.js']
    },
});
