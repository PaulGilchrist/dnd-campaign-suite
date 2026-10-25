import express from 'express';
import fs from 'fs';
import path from 'path';
import { publish, activeMaps, characterChangeData, markDirty } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignMapsDir, normalizeMapFile } from '../utils/campaignPaths.js';

const router = express.Router();

// Helper to sanitize map names to filenames (mirrors src/services/maps/mapsService.js —
// identical bytes, pinned by maps-kebab-parity.test.js; strip trailing .json so
// 'Cave.json' saves as cave.json and stays reachable by the client's 'cave' key)
export const toKebabCase = (name) => name.toLowerCase().replace(/\.json$/i, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const sanitizeMapName = (name) => toKebabCase(name) + '.json';

// Authority (mirrors quests.js / campaigns-admin.js and the npcs bestiary guard):
// map documents are GM-authored — network clients get a read-only view
// (AGENTS.md). Live-clobber, 2026-10-24: a LAN player tab auto-PUT its stale
// fully-revealed copy seconds after a GM fog reset, silently undoing it
// (bug-player-clients-clobber-fog-reset). The client gates the same rule
// (Map.jsx / useMapLoader isLocalhost) so honest read-only tabs never attempt
// these writes; this route guard is the server seam that makes it structural.
// Outdoor hex documents stay writable from any tab: their whole-document PUT
// is the existing party-travel persistence lane (hex useMapLoader), which this
// bug does not touch — the disk document's type decides, deny-safe on unknown.
const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

function refuseUnlessGm(req, res) {
  if (isLocalhost(req)) return true;
  console.log(`[maps] BLOCKED non-localhost ${req.method} ${req.originalUrl} — GM-only`);
  res.status(403).json({ error: 'Access denied: GM-only feature' });
  return false;
}

function isOutdoorMapDocument(filePath, body) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')).type === 'outdoor';
    }
  } catch (_e) { /* unreadable disk bytes — fall back to the claimed type */ }
  return body?.type === 'outdoor';
}

// Mirror the authoritative active map into the '__map__' runtime key so range
// gates (rangeCheck.js) and every client see the same map the /maps list reports.
function stampActiveMapContext(campaign, mapKey) {
  if (!characterChangeData.has(campaign)) {
    characterChangeData.set(campaign, {});
  }
  const value = { activeMapName: mapKey };
  characterChangeData.get(campaign).__map__ = value;
  markDirty(campaign);
  publish(`change-${campaign}-__map__`, value, campaign);
}

// GET /api/campaigns/:campaign/maps - List all maps with active status
router.get('/api/campaigns/:campaign/maps', asyncHandler((req, res) => {
  const { campaign } = req.params;
  const mapsDir = campaignMapsDir(campaign);

  if (!fs.existsSync(mapsDir)) {
    return res.json({ maps: [] });
  }

  const items = fs.readdirSync(mapsDir, { withFileTypes: true });
  const mapFiles = items
    .filter(item => item.isFile() && item.name.endsWith('.json'))
    .map(item => item.name)
    .sort();

  const activeMap = activeMaps.get(campaign) || null;

  const maps = mapFiles.map(f => {
    let mapType = 'indoor';
    let displayName = f.replace(/\.json$/, '');
    try {
      const mapContent = JSON.parse(fs.readFileSync(path.join(mapsDir, f), 'utf-8'));
      mapType = mapContent.type || 'indoor';
      if (mapContent.displayName) displayName = mapContent.displayName;
    } catch (_e) { /* ignore */ }

    return {
      name: displayName,
      fileName: f,
      type: mapType,
      isActive: f.replace(/\.json$/, '') === activeMap
    };
  });

  res.json({ maps });
}));

const clampGridSize = (gridSize) => Math.max(5, Math.min(100, gridSize ?? 20));

// revealed[] entries are "gx,gy" strings (see useFogOfWar / mergeNewlyRevealed).
// Cells outside the current grid can never be rendered or matched by fog math
// (fog iterates 0..gridSize-1), but they balloon the document when gridSize is
// shrunk or a legacy larger-grid file is re-opened — every save/SSE payload
// then ships the stale tail (31,200-entry case, 2026-10-13). Prune at this
// single server seam so disk writes, broadcasts and every client load
// (mapsService.loadMapData → GET) only ever carry in-bounds cells.
// Returns the SAME object untouched when nothing needs pruning (clean maps
// churn nothing), or a new object with a compacted revealed array.
export function pruneRevealedToGrid(mapData) {
  if (!mapData || !Array.isArray(mapData.revealed) || mapData.revealed.length === 0) {
    return mapData;
  }
  const gridSize = mapData.gridSize;
  if (!Number.isInteger(gridSize) || gridSize <= 0) {
    // No trustworthy grid bounds — leave exploration memory untouched.
    return mapData;
  }
  const inBounds = (key) => {
    const parts = String(key).split(',');
    if (parts.length !== 2) return false;
    const gx = Number(parts[0]);
    const gy = Number(parts[1]);
    return Number.isInteger(gx) && Number.isInteger(gy) &&
      gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize;
  };
  const kept = mapData.revealed.filter(inBounds);
  if (kept.length === mapData.revealed.length) return mapData;
  console.log(`[maps] pruned ${mapData.revealed.length - kept.length} out-of-bounds revealed cells (gridSize=${gridSize})`);
  return { ...mapData, revealed: kept };
}

// Positional autosaves (useMapLoader / hex travel lane / teleportService) echo
// the whole document back through the general PUT — if their `name` copy
// drifted to the kebab slug or a hostile body re-labelled the map, the write
// silently renamed it in the Maps list (live-hit 2026-10-25 pm during harness
// restore). Renames legitimately belong to the /rename route; here, when the
// target file already exists, the stored document's authored `name` /
// `displayName` win over the body. Stored field missing/null/blank → the body
// value is kept (nothing authoritative on disk to protect; a legacy doc that
// never carried `name` is back-filled by the client's echo, not rejected).
// Unreadable stored bytes fail open to the body. New-file create-via-PUT (the
// auto-encounter spawn lane in useEncounterGeneration.js authors readable
// names in the body) is untouched — body verbatim, as today.
// Returns the SAME object when nothing is overridden.
export function preserveAuthoredNames(storedData, incomingData) {
  if (!storedData || typeof storedData !== 'object') return incomingData;
  const storedDisplayName = typeof storedData.displayName === 'string' && storedData.displayName.trim() !== ''
    ? storedData.displayName
    : null;
  const storedName = typeof storedData.name === 'string' && storedData.name.trim() !== ''
    ? storedData.name
    : null;
  if (!storedDisplayName && !storedName) return incomingData;
  const displayName = storedDisplayName || incomingData.displayName;
  const name = storedName || incomingData.name;
  if (displayName === incomingData.displayName && name === incomingData.name) return incomingData;
  console.log(`[maps] preserved authored map names on PUT (body had name=${JSON.stringify(incomingData.name)}, displayName=${JSON.stringify(incomingData.displayName)})`);
  return { ...incomingData, displayName, name };
}

// Read the stored map document for the name guard; null when absent/unreadable.
function readStoredMapDocument(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_e) {
    return null;
  }
}

const buildOutdoorMapData = (name, body) => ({
  displayName: name.trim(),
  name: toKebabCase(name.trim()),
  type: body.type ?? 'indoor',
  gridSize: clampGridSize(body.gridSize),
  terrain: body.terrain ?? {},
  pois: body.pois ?? [],
  zoom: 1,
  panX: 0,
  panY: 0,
});

const buildIndoorMapData = (name, body) => ({
  displayName: name.trim(),
  name: toKebabCase(name.trim()),
  type: body.type ?? 'indoor',
  gridSize: clampGridSize(body.gridSize),
  walls: body.walls ?? [],
  placedItems: body.placedItems ?? [],
  paintCells: body.paintCells ?? [],
  items: body.items ?? [],
  players: body.players ?? [],
  fog: body.fog ?? [],
  generationMode: body.generationMode,
  description: body.description,
  seed: body.seed,
  terrain: body.terrain ?? {},
  pois: body.pois ?? [],
  zoom: 1,
  panX: 0,
  panY: 0,
  parentHex: body.parentHex,
  parentTerrain: body.parentTerrain,
  bgFill: body.bgFill,
});

// POST /api/campaigns/:campaign/maps - Create a new map
router.post('/api/campaigns/:campaign/maps', asyncHandler((req, res) => {
  const { campaign } = req.params;
  const body = req.body;
  const name = body.name;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Map name is required' });
  }

  const mapsDir = campaignMapsDir(campaign);

  if (!fs.existsSync(mapsDir)) {
    fs.mkdirSync(mapsDir, { recursive: true });
  }

  const fileName = sanitizeMapName(name);
  const filePath = path.join(mapsDir, fileName);

  if (fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'A map with this name already exists' });
  }

  const defaultMapData = (body.type ?? 'indoor') === 'outdoor'
    ? buildOutdoorMapData(name, body)
    : buildIndoorMapData(name, body);

  fs.writeFileSync(filePath, JSON.stringify(defaultMapData, null, 2));

  // Broadcast maps list change
  publish(`maps-list-${campaign}`, { action: 'created', map: { name: name.trim(), fileName } }, campaign);

  res.status(201).json({ message: 'Map created successfully', map: { name: name.trim(), fileName } });
}));

// GET /api/campaigns/:campaign/maps/:mapname - Get map data
router.get('/api/campaigns/:campaign/maps/:mapname', asyncHandler((req, res) => {
  const { campaign, mapname } = req.params;
  const mapsDir = campaignMapsDir(campaign);
  const fileName = normalizeMapFile(mapname);
  const filePath = path.join(mapsDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Map not found' });
  }

  const mapData = pruneRevealedToGrid(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  res.json(mapData);
}));

// PUT /api/campaigns/:campaign/maps/:mapname - Save map data
router.put('/api/campaigns/:campaign/maps/:mapname', asyncHandler((req, res) => {
  const { campaign, mapname } = req.params;
  const mapsDir = campaignMapsDir(campaign);
  const fileName = normalizeMapFile(mapname);
  const filePath = path.join(mapsDir, fileName);

  if (!isOutdoorMapDocument(filePath, req.body) && !refuseUnlessGm(req, res)) return;

  const mapData = preserveAuthoredNames(
    readStoredMapDocument(filePath),
    pruneRevealedToGrid(req.body)
  );

  if (!fs.existsSync(mapsDir)) {
    fs.mkdirSync(mapsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(mapData, null, 2));

  // Broadcast map data change for real-time sync
  const eventMapName = fileName.replace(/\.json$/, '');
  publish(`map-data-${campaign}-${eventMapName}`, mapData, campaign);

  res.json({ message: 'Map saved successfully' });
}));

// DELETE /api/campaigns/:campaign/maps/:mapname - Delete a map
router.delete('/api/campaigns/:campaign/maps/:mapname', asyncHandler((req, res) => {
  const { campaign, mapname } = req.params;
  if (!refuseUnlessGm(req, res)) return;
  const mapsDir = campaignMapsDir(campaign);
  const fileName = normalizeMapFile(mapname);
  const filePath = path.join(mapsDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Map not found' });
  }

  fs.unlinkSync(filePath);

  // If this was the active map, clear it
  const mapKey = fileName.replace(/\.json$/, '');
  if (activeMaps.get(campaign) === mapKey) {
    activeMaps.delete(campaign);
    stampActiveMapContext(campaign, null);
  }

  // Broadcast maps list change
  publish(`maps-list-${campaign}`, { action: 'deleted', map: mapKey }, campaign);

  res.json({ message: 'Map deleted successfully' });
}));

// PUT /api/campaigns/:campaign/maps/:mapname/rename - Rename a map
router.put('/api/campaigns/:campaign/maps/:mapname/rename', asyncHandler((req, res) => {
  const { campaign, mapname } = req.params;
  const { newName } = req.body;
  if (!refuseUnlessGm(req, res)) return;

  if (!newName || newName.trim() === '') {
    return res.status(400).json({ error: 'New map name is required' });
  }

  const mapsDir = campaignMapsDir(campaign);
  const oldFileName = normalizeMapFile(mapname);
  const oldFilePath = path.join(mapsDir, oldFileName);
  const newFileName = sanitizeMapName(newName.trim());
  const newFilePath = path.join(mapsDir, newFileName);

  if (!fs.existsSync(oldFilePath)) {
    return res.status(404).json({ error: 'Map not found' });
  }

  if (fs.existsSync(newFilePath) && oldFileName !== newFileName) {
    return res.status(400).json({ error: 'A map with this name already exists' });
  }

  // Read existing data and update name
  const mapData = JSON.parse(fs.readFileSync(oldFilePath, 'utf-8'));
  mapData.displayName = newName.trim();
  mapData.name = toKebabCase(newName.trim());

  // Write with new name, delete old file
  fs.writeFileSync(newFilePath, JSON.stringify(mapData, null, 2));

  if (oldFileName !== newFileName) {
    fs.unlinkSync(oldFilePath);
  }

  // Update active map in memory if this was the active map
  const oldKey = oldFileName.replace(/\.json$/, '');
  const newKey = newFileName.replace(/\.json$/, '');
  if (activeMaps.get(campaign) === oldKey) {
    activeMaps.set(campaign, newKey);
    stampActiveMapContext(campaign, newKey);
  }

  // Broadcast maps list change
  publish(`maps-list-${campaign}`, {
    action: 'renamed',
    oldName: oldFileName.replace(/\.json$/, ''),
    newName: newFileName.replace(/\.json$/, '')
  }, campaign);

  res.json({
    message: 'Map renamed successfully',
    map: { name: newName.trim(), fileName: newFileName }
  });
}));

// PUT /api/campaigns/:campaign/maps/:mapname/activate - Activate a map
router.put('/api/campaigns/:campaign/maps/:mapname/activate', asyncHandler((req, res) => {
  const { campaign, mapname } = req.params;
  if (!refuseUnlessGm(req, res)) return;
  const mapsDir = campaignMapsDir(campaign);
  const fileName = normalizeMapFile(mapname);
  const filePath = path.join(mapsDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Map not found' });
  }

  const mapKey = fileName.replace(/\.json$/, '');
  activeMaps.set(campaign, mapKey);
  stampActiveMapContext(campaign, mapKey);

  // Broadcast activation change
  publish(`map-activate-${campaign}`, { activeMap: mapKey }, campaign);
  publish(`maps-list-${campaign}`, { action: 'activated', activeMap: mapKey }, campaign);

  res.json({ message: 'Map activated successfully', activeMap: mapKey });
}));

// GET /api/campaigns/:campaign/active-map - Get the active map name
router.get('/api/campaigns/:campaign/active-map', asyncHandler((req, res) => {
  const { campaign } = req.params;
  const activeMapName = activeMaps.get(campaign) || null;
  res.json({ activeMapName });
}));

// PUT /api/campaigns/:campaign/maps/:mapname/description - Update map description
router.put('/api/campaigns/:campaign/maps/:mapname/description', asyncHandler((req, res) => {
  const { campaign, mapname } = req.params;
  const { description } = req.body;
  if (!refuseUnlessGm(req, res)) return;
  const mapsDir = campaignMapsDir(campaign);
  const fileName = normalizeMapFile(mapname);
  const filePath = path.join(mapsDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Map not found' });
  }

  const mapData = pruneRevealedToGrid(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  mapData.description = description || '';
  fs.writeFileSync(filePath, JSON.stringify(mapData, null, 2));

  // Broadcast updated map data
  publish(`map-data-${campaign}-${fileName.replace(/\.json$/, '')}`, mapData, campaign);

  res.json({ message: 'Map description updated successfully' });
}));

export default router;
