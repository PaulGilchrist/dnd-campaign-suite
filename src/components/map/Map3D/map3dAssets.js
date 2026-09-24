// Content-hashed URLs for the 3D map assets. The files live in src/assets/3d-map
// (shared with demos/3d-map) and are emitted to dist/assets with hashes.
const assetUrls = import.meta.glob('../../../assets/3d-map/*.{glb,jpg,png}', {
    eager: true,
    query: '?url',
    import: 'default',
});

const byName = {};
for (const [path, value] of Object.entries(assetUrls)) {
    // Newer Vite versions may hand back the module namespace even with
    // import: 'default' — accept either shape.
    byName[path.split('/').pop()] = typeof value === 'string' ? value : value?.default;
}

export function getAssetUrl(name) {
    return byName[name] || null;
}
