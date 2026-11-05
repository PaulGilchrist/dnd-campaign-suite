// One-off rig: create a demo outdoor hex map in test-campaign with one POI of
// every type so the Blender sprites/models can be reviewed in the browser.
/* global fetch */
import { generateHexTerrain } from '../src/services/maps/hexTerrainGenerator.js';

const BASE = 'http://localhost';
const CAMPAIGN = 'test-campaign';
const NAME = 'POI Showcase';

const terrain = generateHexTerrain({ gridSize: 8, seed: 20261105 });
const cells = Object.entries(terrain.terrain)
    .filter(([, id]) => id !== 'water')
    .map(([k, id]) => {
        const [q, r] = k.split(',').map(Number);
        return { q, r, id };
    });

const TYPES = [
    ['camp', "Wanderer's Rest"],
    ['city', 'Thornhold'],
    ['dungeon', 'The Barrow of Whispers'],
    ['hazard', 'The Seeping Mire'],
    ['landmark', 'The Watcher Stone'],
    ['loreSite', 'Ring of Whispers'],
    ['naturalWonder', 'Silverveil Falls'],
    ['settlement', 'Oakhaven'],
    ['tower', 'Pilgrim\u2019s Spire'],
];

// Spread picks across the map: bucket cells by region, choose one per type
const picks = [];
const used = new Set();
const W = Math.max(...cells.map((c) => c.q)) + 1;
const H = Math.max(...cells.map((c) => c.r)) + 1;
TYPES.forEach((typeLabel, i) => {
    const cx = ((i % 3) + 0.5) * (W / 3);
    const cy = (Math.floor(i / 3) + 0.5) * (H / 3);
    const cands = cells
        .filter((c) => !used.has(`${c.q},${c.r}`))
        .sort((a, b) => Math.hypot(a.q - cx, a.r - cy) - Math.hypot(b.q - cx, b.r - cy));
    const pick = cands[0];
    used.add(`${pick.q},${pick.r}`);
    picks.push(pick);
});

const pois = TYPES.map(([type, label], i) => ({
    id: `poi-${i}`,
    q: picks[i].q,
    r: picks[i].r,
    type,
    label,
    visible: true,
    linkedMap: null,
}));

const body = {
    name: NAME,
    type: 'outdoor',
    gridSize: 8,
    terrain: terrain.terrain,
    pois,
};

const res = await fetch(`${BASE}/api/campaigns/${CAMPAIGN}/maps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});
const out = await res.json();
console.log(res.status, out);

// PUT the full doc too so rivers/roads land (create route drops them)
if (res.status === 201) {
    const slug = out.map.slug;
    const doc = {
        displayName: NAME,
        name: slug,
        type: 'outdoor',
        gridSize: 8,
        terrain: terrain.terrain,
        rivers: terrain.rivers,
        roads: terrain.roads ?? [],
        pois,
        zoom: 1,
        panX: 0,
        panY: 0,
    };
    const put = await fetch(`${BASE}/api/campaigns/${CAMPAIGN}/maps/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
    });
    console.log('PUT', put.status, await put.json());
}
