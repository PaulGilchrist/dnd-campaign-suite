// Tiny dependency-free static server for the 3D map demo.
// Serves the REPO ROOT (two levels up from this file) so that both the demo
// (demos/3d-map/) and the campaign map JSON (public/campaigns/...) are reachable.
//
// Usage:
//   node demos/3d-map/serve.mjs [port]
//   -> open  http://localhost:8080/demos/3d-map/index.html?path=public/campaigns/Testing%20G3/maps/sealed-sanctum.json
//
// The file-picker / drag-and-drop in index.html works without this server.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.argv[2]) || 8080;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
    try {
        let urlPath = decodeURIComponent(req.url.split('?')[0]);
        if (urlPath === '/') urlPath = '/demos/3d-map/index.html';
        // Resolve and guard against path traversal outside the repo root.
        const filePath = path.normalize(path.join(ROOT, urlPath));
        if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
            res.writeHead(403).end('Forbidden');
            return;
        }
        const data = await readFile(filePath);
        const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(data);
    } catch (err) {
        res.writeHead(err.code === 'ENOENT' ? 404 : 500).end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
    }
});

server.listen(PORT, () => {
    console.error(`3D map demo server running:`);
    console.error(`  http://localhost:${PORT}/demos/3d-map/index.html`);
    console.error(`Example:  http://localhost:${PORT}/demos/3d-map/index.html?path=public/campaigns/Testing%20G3/maps/sealed-sanctum.json`);
});
