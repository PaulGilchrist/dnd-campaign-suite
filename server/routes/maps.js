import express from 'express';
import fs from 'fs';
import path from 'path';
import lodash from 'lodash';
import { publish, activeMaps, characterChangeData, markDirty, warnIfNewTopLevelKey } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignMapsDir, normalizeMapFile } from '../utils/campaignPaths.js';
// Shared with the client hex editor (hex-map/hooks/useMapLoader.js seeds the
// same centre when a stored document carries no partyPosition) so the create
// stamp and the editor fallback can never drift (backlog JT 2026-11-11).
import { GRID_COLS_MULTIPLIER } from '../../src/config/outdoorConfig.js';

const { isEqual } = lodash;

const router = express.Router();

// Helper to sanitize map names to filenames (mirrors src/services/maps/mapsService.js —
// identical bytes, pinned by maps-kebab-parity.test.js; strip trailing .json so
// 'Cave.json' saves as cave.json and stays reachable by the client's 'cave' key)
export const toKebabCase = (name) => name.toLowerCase().replace(/\.json$/i, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const sanitizeMapName = (name) => toKebabCase(name) + '.json';

// Clean automation/UX handle for a map file: fileName minus its .json extension
// (e.g. 'battle-arena.json' → 'battle-arena'). ALWAYS derived from fileName —
// never re-slugified from the display name — so slug and fileName can never
// drift, and every GET/PUT/DELETE/rename/activate lane resolves it via
// normalizeMapFile. Backs the `slug` field on list rows, create/rename
// responses and maps-list broadcasts.
const slugFromFileName = (fileName) => fileName.replace(/\.json$/i, '');

// Resolve a :mapname path segment to a fileName. Exact fileName/slug wins (the
// normalizeMapFile seam every lane already uses); a miss falls back to the
// sanitizeMapName of the segment so display names ('Battle Arena', with spaces
// or case) reach their kebab file. Collision-safe by construction: creation
// dedups on sanitizeMapName(name), so a display name can only kebab onto the
// very file it created.
function resolveMapFileName(mapsDir, mapname) {
  const exact = normalizeMapFile(mapname);
  if (fs.existsSync(path.join(mapsDir, exact))) return exact;
  const kebab = normalizeMapFile(sanitizeMapName(mapname));
  return fs.existsSync(path.join(mapsDir, kebab)) ? kebab : exact;
}

// Authority (mirrors quests.js / campaigns-admin.js and the npcs bestiary guard):
// map documents are GM-authored — network clients get a read-only view
// (AGENTS.md). Live-clobber, 2026-10-24: a LAN player tab auto-PUT its stale
// fully-revealed copy seconds after a GM fog reset, silently undoing it
// (bug-player-clients-clobber-fog-reset). The client gates the same rule
// (Map.jsx / useMapLoader isLocalhost) so honest read-only tabs never attempt
// these writes; this route guard is the server seam that makes it structural.
// Outdoor hex documents keep a NARROW all-tab write lane: their whole-document
// PUT is the party-travel persistence lane (hex useMapLoader writes the party
// marker / travel state / marching order / per-client view pan-zoom, and the
// travel lane rolls weather as it runs). Editor-scope deltas (terrain, rivers,
// roads, pois, gridSize, draft) are GM-only even on outdoor docs — see
// outdoorEditorDelta below and bug-lan-player-terrain-paint-persists.
const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

function refuseUnlessGm(req, res) {
  if (isLocalhost(req)) return true;
  console.log(`[maps] BLOCKED non-localhost ${req.method} ${req.originalUrl} — GM-only`);
  res.status(403).json({ error: 'Access denied: GM-only feature' });
  return false;
}

// Editor-scope outdoor fields: content authored by the GM. A non-localhost
// PUT may change any OTHER field (partyPosition/travelState/marchingOrder/
// zoom/panX/panY/weather) but these must deep-match the stored document —
// an honest read-only tab always echoes them unchanged, so legitimate lanes
// pass untouched while a paint/POI/road/grid edit gets the canonical GM-only
// 403. Missing stored doc = deny-safe: creation is a GM act (POST is gated).
const outdoorEditorDelta = (storedData, body) => {
  if (!storedData) return true;
  const editorView = (doc) => ({
    terrain: doc.terrain ?? {},
    rivers: doc.rivers ?? [],
    roads: doc.roads ?? [],
    pois: doc.pois ?? [],
    gridSize: doc.gridSize,
    draft: doc.draft === true,
  });
  return !isEqual(editorView(storedData), editorView(body ?? {}));
};

function refuseOutdoorEditorWriteUnlessGm(req, res) {
  console.log(`[maps] BLOCKED non-localhost PUT ${req.originalUrl} — outdoor editor fields (terrain/rivers/roads/pois/gridSize) are GM-only`);
  res.status(403).json({ error: 'Access denied: GM-only feature' });
}

// Mirror the authoritative active map into the '__map__' runtime key so range
// gates (rangeCheck.js) and every client see the same map the /maps list reports.
function stampActiveMapContext(campaign, mapKey) {
  if (!characterChangeData.has(campaign)) {
    characterChangeData.set(campaign, {});
  }
  const value = { activeMapName: mapKey };
  warnIfNewTopLevelKey(campaign, '__map__');
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
    // Carried through so the manager list can surface read-only descriptions
    // (row hover tooltip) without a per-row document fetch (backlog 2026-10-26).
    let description = '';
    let isDraftMap = false;
    // The small generationOpts stamp (≤10 keys) rides the list envelope too, so the
    // row's Regenerate face is known at list-render time — no per-row whole-doc GET
    // (the old lazy stamp-probe fetched 1800-cell terrain docs just for a tooltip,
    // once per row per mount — VX backlog 2026-11-12). Large doc fields (walls/
    // placedItems/terrain/rivers) stay in the per-slug GET lane. Docs without the
    // key (legacy fixtures, hand-authored maps) honestly omit it.
    let generationOpts;
    try {
      const mapContent = JSON.parse(fs.readFileSync(path.join(mapsDir, f), 'utf-8'));
      mapType = mapContent.type || 'indoor';
      if (mapContent.displayName) displayName = mapContent.displayName;
      description = mapContent.description || '';
      isDraftMap = mapContent.draft === true;
      if (mapContent.generationOpts && typeof mapContent.generationOpts === 'object') {
        generationOpts = mapContent.generationOpts;
      }
    } catch (_e) { /* ignore */ }
    // Draft invisibility (campaign-authoring plan Phase 3): an AI-drafted map
    // never appears in a non-GM listing.
    if (isDraftMap && !isLocalhost(req)) return null;

    return {
      name: displayName,
      fileName: f,
      slug: slugFromFileName(f),
      type: mapType,
      description,
      draft: isDraftMap || undefined,
      generationOpts,
      isActive: slugFromFileName(f) === activeMap
    };
  }).filter(Boolean);

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

// players-clobber guard (backlog 2026-10-27-M): the general map PUT is a
// full-object replace, so a body that omits `players` (or carries a non-array)
// silently erased every PC token from an INDOOR map document — the exact
// self-destruct lane the run-M ErrorBoundary rig used (live-hit: GET full
// object → strip players → PUT → reopen crashes the editor). A stored outdoor
// document never carries a players array, so the Array.isArray(stored) test
// keeps the hex travelState lane byte-identical without a type check. Create-
// via-PUT (no stored doc) and legacy stored docs that never had players stay
// untouched — this rejects only an ERASE, never over-validates.
export function erasesStoredPlayers(storedData, incomingData) {
  return !!storedData
    && Array.isArray(storedData.players)
    && !Array.isArray(incomingData?.players);
}

// players[] token-id normalization (backlog 2026-11-04 CQ): the editor keys
// its token layer on `player.id` (Players.jsx) and the established token
// hygiene is "id = lowercased name" (ElderPaladin → 'elderpaladin'). The
// full-document save lanes used to persist id-less entries verbatim, and the
// next editor open mounted with React duplicate-key errors (live-hit via the
// API rig; GM import/clone paths can produce the same). One shared helper for
// PUT and POST create, run BEFORE any disk write: an entry with no usable
// string `id` is assigned its lowercased `name`, ids are made unique within
// the document (the second — and any later — collision gains a `-2`, `-3`
// suffix, so the duplicate-key error class is impossible after a successful
// save), and an entry that already carries a valid, unused string `id` passes
// through byte-unchanged. An entry from which no id can be derived (neither
// valid `id` nor non-empty string `name`) is refused with the same plain-
// English "Map save rejected: …" 400 tone as the players-clobber guard —
// nothing is written. Returns { mapData, error }: the SAME object comes back
// when nothing needed normalizing (echo lanes stay byte-identical).
const hasPlayerId = (entry) => typeof entry?.id === 'string' && entry.id.trim() !== '';
const playerName = (entry) => (typeof entry?.name === 'string' ? entry.name.trim() : '');

export function normalizePlayerIds(mapData) {
  const players = mapData?.players;
  if (!Array.isArray(players) || players.length === 0) return { mapData, error: null };

  const taken = new Set();
  const uniqueId = (base) => {
    let id = base;
    let n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;
    taken.add(id);
    return id;
  };

  let changed = false;
  const normalized = [];
  for (let i = 0; i < players.length; i++) {
    const entry = players[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { mapData, error: `Map save rejected: every player token must carry an "id" or a "name" to derive one from — entry ${i} was ${rowKind(entry)}.` };
    }
    if (hasPlayerId(entry) && !taken.has(entry.id)) {
      taken.add(entry.id);
      normalized.push(entry);
      continue;
    }
    if (!hasPlayerId(entry) && playerName(entry) === '') {
      return { mapData, error: `Map save rejected: every player token must carry an "id" or a "name" to derive one from — entry ${i} has neither.` };
    }
    normalized.push({ ...entry, id: uniqueId(hasPlayerId(entry) ? entry.id : playerName(entry).toLowerCase()) });
    changed = true;
  }
  return changed
    ? { mapData: { ...mapData, players: normalized }, error: null }
    : { mapData, error: null };
}

// Row-shape guard for the outdoor editor lanes (backlog 2026-11-02 BD): the
// whole-document PUT happily accepted object rows in `rivers` before, and one
// malformed row hard-locked the hex editor on EVERY later open — RiverLayer's
// parseHexKey threw `key.split is not a function` and the ErrorBoundary
// "Reload the view" loop could only be healed by API surgery. Reject at the
// write seam with the canonical shape spelled out; nothing on disk is touched.
// Canonical shapes (see docs/app-exploration.md fixture recipes):
//   rivers: ["q,r", …]                     — plain hex-key STRINGS
//   roads:  [{id?, hexes: ["q,r", …]}, …]  — objects carrying hex-key arrays
const HEX_KEY_ROW = /^\s*-?\d+\s*,\s*-?\d+\s*$/;
const isHexKeyRow = (row) => typeof row === 'string' && HEX_KEY_ROW.test(row);
const rowKind = (row) => (row === null ? 'null' : Array.isArray(row) ? 'an array' : typeof row);

function riversShapeError(rivers) {
  if (rivers === undefined || rivers === null) return null;
  if (!Array.isArray(rivers)) {
    return 'Map save rejected: "rivers" must be a list of hex keys, each a "q,r" string like "7,2" — got ' + rowKind(rivers) + '.';
  }
  for (let i = 0; i < rivers.length; i++) {
    if (!isHexKeyRow(rivers[i])) {
      return `Map save rejected: every river must be a "q,r" hex-key string like "7,2" — entry ${i} was ${rowKind(rivers[i])}.`;
    }
  }
  return null;
}

function roadsShapeError(roads) {
  if (roads === undefined || roads === null) return null;
  if (!Array.isArray(roads)) {
    return 'Map save rejected: "roads" must be a list of objects shaped { id, hexes: ["7,2", …] } — got ' + rowKind(roads) + '.';
  }
  for (let i = 0; i < roads.length; i++) {
    const road = roads[i];
    if (!road || typeof road !== 'object' || Array.isArray(road)) {
      return `Map save rejected: every road must be an object shaped { id, hexes: ["7,2", …] } — entry ${i} was ${rowKind(road)}.`;
    }
    if (!Array.isArray(road.hexes)) {
      return `Map save rejected: road entry ${i} must carry "hexes" — a list of "q,r" hex-key strings like "7,2".`;
    }
    for (let j = 0; j < road.hexes.length; j++) {
      if (!isHexKeyRow(road.hexes[j])) {
        return `Map save rejected: every road hex must be a "q,r" hex-key string like "7,2" — road entry ${i} hex ${j} was ${rowKind(road.hexes[j])}.`;
      }
    }
  }
  return null;
}

// Returns a plain-English 400 message for the first malformed outdoor row, or
// null when the body's rivers/roads (if present) match the canonical shapes.
// Absent/null fields pass — this never over-validates the indoor or
// party-lane echoes that carry neither key (or carry them unchanged, as the
// honest outdoor travel lane always does).
export function outdoorRowsShapeError(body) {
  return riversShapeError(body?.rivers) || roadsShapeError(body?.roads);
}

// Authored label for a freshly created map (FZ backlog 2026-11-09): the list
// route already prefers `mapContent.displayName` (:126) and the rename lane
// writes `newName.trim()`, but the create builders used to overwrite any
// submitted `displayName` with the raw name — harnesses had to guess. An
// authored non-blank string body.displayName now wins verbatim (trimmed,
// mirroring the rename lane); absent/blank/non-string falls back to name —
// exact previous behavior for every existing caller (no client create lane
// posts displayName today; encounter/staging/seed lanes PUT it afterwards).
const createDisplayName = (name, body) =>
  typeof body?.displayName === 'string' && body.displayName.trim() !== ''
    ? body.displayName.trim()
    : name.trim();

// Outdoor create-stamp (JT backlog 2026-11-11): an API-first create used to
// store NO partyPosition, so an API-only rig had to follow the POST with a
// whole-doc PUT just to place the party (the client only seeds this at
// editor-open). Stamp the documented centre of the hexCols×hexRows grid the
// create derives (cols = gridSize × GRID_COLS_MULTIPLIER, rows = gridSize —
// e.g. gridSize 20 → 40×20 → {q:20,r:10}), so the party pin and the travel
// panel have a valid origin straight from the POST. An explicit
// body.partyPosition still wins verbatim (never overwritten); marchingOrder
// is trip data and stays client/trip-lane — deliberately not stamped.
const centrePartyPosition = (gridSize) => ({
  q: Math.floor((gridSize * GRID_COLS_MULTIPLIER) / 2),
  r: Math.floor(gridSize / 2),
});

const buildOutdoorMapData = (name, body) => {
  const gridSize = clampGridSize(body.gridSize);
  return {
    displayName: createDisplayName(name, body),
    name: toKebabCase(name.trim()),
    type: body.type ?? 'indoor',
    gridSize,
    terrain: body.terrain ?? {},
    pois: body.pois ?? [],
    // Generate-terrain seed (SD backlog 2026-11-12): the create builder is a
    // whitelist and used to drop the body's seed, so a terrain map could never
    // be reproduced from its document on disk. Mirrors buildIndoorMapData.
    seed: body.seed,
    // Full effective generation options (UF backlog 2026-11-12): stamped by
    // the generate modals so the doc alone can re-derive its own map. Same
    // verbatim passthrough law as seed (undefined drops from the JSON).
    generationOpts: body.generationOpts,
    zoom: 1,
    panX: 0,
    panY: 0,
    partyPosition: body.partyPosition ?? centrePartyPosition(gridSize),
  };
};

const buildIndoorMapData = (name, body) => ({
  displayName: createDisplayName(name, body),
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
  // Full effective generation options (UF backlog 2026-11-12): stamped by the
  // generate-dungeon modal so the doc alone can re-derive its own dungeon.
  // Same verbatim passthrough law as seed (undefined drops from the JSON).
  generationOpts: body.generationOpts,
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
// GM-only (Paul adjudicated 2026-10-28): travel/hex-event resolution is
// GM-driven — players may ENTER/LEAVE the active outdoor map (read lanes stay
// open) but never resolve its events. Live two-tab proof: on a combat-event
// Accept the spawn POST fires ONLY from the GM tab (the passive client
// auto-closes its dialog via the SSE clear, zero POSTs); and the spawn lane's
// authoritative content write is the indoor full-document PUT below, which
// already 403s non-localhost (:301) — an un-gated POST was therefore never a
// functional player lane, only an orphan-empty-file hole (a LAN client could
// litter any campaign with un-writable map files and win the auto-activate
// race). Mirror the DELETE/rename/activate/desc gate at the handler head.
router.post('/api/campaigns/:campaign/maps', asyncHandler((req, res) => {
  const { campaign } = req.params;
  if (!refuseUnlessGm(req, res)) return;
  const body = req.body;
  const name = body.name;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Map name is required' });
  }

  // Names whose kebab-case handle is empty (punctuation-only like '!!!', emoji,
  // full non-Latin scripts) would write an empty-slug `.json` DOTFILE whose URL
  // segment collapses to '' on every later lane (false-200 delete via the
  // change-data wildcard, phantom blank open, 404 renames) — an undeletable
  // one-way door. Refuse at the only seam that can (bug-map-name-empty-kebab).
  if (toKebabCase(name.trim()) === '') {
    return res.status(400).json({ error: 'Map name must contain letters or numbers' });
  }

  const mapsDir = campaignMapsDir(campaign);

  if (!fs.existsSync(mapsDir)) {
    fs.mkdirSync(mapsDir, { recursive: true });
  }

  const fileName = sanitizeMapName(name);
  const filePath = path.join(mapsDir, fileName);

  if (fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'A map with that name already exists' });
  }

  // Same row-shape guard as the PUT (backlog 2026-11-02 BD): the builder
  // drops rivers/roads from create bodies today, but "silently accepts
  // anything" hides authoring bugs — refuse malformed rows with the
  // canonical shape instead of shrugging. No file is written on refusal.
  const createRowsError = outdoorRowsShapeError(body);
  if (createRowsError) {
    console.log(`[maps] BLOCKED POST ${campaign} (create "${name}") — ${createRowsError}`);
    return res.status(400).json({ error: createRowsError });
  }

  const defaultMapData = (body.type ?? 'indoor') === 'outdoor'
    ? buildOutdoorMapData(name, body)
    : buildIndoorMapData(name, body);

  // Same players[] token-id normalization as the PUT (shared helper, backlog
  // 2026-11-04 CQ): a create body carrying an id-less (or name-less) player
  // entry must never persist a document the editor mounts with duplicate
  // keys. Refusal writes no file.
  const normalizedCreate = normalizePlayerIds(defaultMapData);
  if (normalizedCreate.error) {
    console.log(`[maps] BLOCKED POST ${campaign} (create "${name}") — ${normalizedCreate.error}`);
    return res.status(400).json({ error: normalizedCreate.error });
  }

  fs.writeFileSync(filePath, JSON.stringify(normalizedCreate.mapData, null, 2));

  // Broadcast maps list change (slug rides along so consumers of the raw
  // payload see the same handle the list route exposes)
  const createdMap = { name: name.trim(), fileName, slug: slugFromFileName(fileName) };
  publish(`maps-list-${campaign}`, { action: 'created', map: createdMap }, campaign);

  res.status(201).json({ message: 'Map created successfully', map: createdMap });
}));

// GET /api/campaigns/:campaign/maps/:mapname - Get map data
// Resolves exact fileName/slug first, display names second (resolveMapFileName).
router.get('/api/campaigns/:campaign/maps/:mapname', asyncHandler((req, res) => {
  const { campaign, mapname } = req.params;
  const mapsDir = campaignMapsDir(campaign);
  const fileName = resolveMapFileName(mapsDir, mapname);
  const filePath = path.join(mapsDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Map not found' });
  }

  const mapData = pruneRevealedToGrid(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  // Draft invisibility (campaign-authoring plan Phase 3): non-GM callers get
  // the same 404 an absent map gets — even a name probe confirms nothing.
  if (mapData?.draft === true && !isLocalhost(req)) {
    return res.status(404).json({ error: 'Map not found' });
  }
  res.json(mapData);
}));

// PUT /api/campaigns/:campaign/maps/:mapname - Save map data
router.put('/api/campaigns/:campaign/maps/:mapname', asyncHandler((req, res) => {
  const { campaign, mapname } = req.params;
  const mapsDir = campaignMapsDir(campaign);
  const fileName = normalizeMapFile(mapname);
  const filePath = path.join(mapsDir, fileName);

  // ONE read of the stored document feeds the outdoor/authority decision, the
  // players-clobber guard and the authored-name guard below. Outdoor decision
  // keeps isOutdoorMapDocument semantics: readable stored type wins; missing/
  // unreadable file falls back to the claimed body type (deny-safe on unknown).
  const storedData = readStoredMapDocument(filePath);
  const isOutdoor = storedData ? storedData.type === 'outdoor' : req.body?.type === 'outdoor';
  if (!isOutdoor) {
    if (!refuseUnlessGm(req, res)) return;
  } else if (!isLocalhost(req) && outdoorEditorDelta(storedData, req.body)) {
    return refuseOutdoorEditorWriteUnlessGm(req, res);
  }

  if (!isOutdoor && erasesStoredPlayers(storedData, req.body)) {
    console.log(`[maps] BLOCKED PUT ${campaign}/${fileName} — body without a players array would erase stored player tokens`);
    return res.status(400).json({ error: 'Map save rejected: a whole-map save must include the players array — without it every player token would be erased from the map.' });
  }

  const rowsError = outdoorRowsShapeError(req.body);
  if (rowsError) {
    console.log(`[maps] BLOCKED PUT ${campaign}/${fileName} — ${rowsError}`);
    return res.status(400).json({ error: rowsError });
  }

  // players[] token-id normalization (backlog 2026-11-04 CQ) — BEFORE the
  // write so the persisted document and the SSE echo below both carry the
  // unique, lowercased-name ids the editor keys on.
  const normalizedPlayers = normalizePlayerIds(req.body);
  if (normalizedPlayers.error) {
    console.log(`[maps] BLOCKED PUT ${campaign}/${fileName} — ${normalizedPlayers.error}`);
    return res.status(400).json({ error: normalizedPlayers.error });
  }

  const mapData = preserveAuthoredNames(
    storedData,
    pruneRevealedToGrid(normalizedPlayers.mapData)
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

  // Same empty-kebab gate as POST create (:264) — renaming INTO an empty
  // handle would just move the file onto the undeletable `.json` dotfile slug
  // (bug-map-name-empty-kebab).
  if (toKebabCase(newName.trim()) === '') {
    return res.status(400).json({ error: 'Map name must contain letters or numbers' });
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
    return res.status(400).json({ error: 'A map with that name already exists' });
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
    map: { name: newName.trim(), fileName: newFileName, slug: slugFromFileName(newFileName) }
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

  // Draft maps are never table-visible: approve in the Campaign Builder first
  // (campaign-authoring plan Phase 3 — "players only ever see an activated,
  // approved map"). 409 so the GM UI can offer the approve-and-activate path.
  const stored = readStoredMapDocument(filePath);
  if (stored?.draft === true) {
    return res.status(409).json({ error: 'That map is still a draft — approve it before activating.' });
  }

  const mapKey = fileName.replace(/\.json$/, '');
  activeMaps.set(campaign, mapKey);
  stampActiveMapContext(campaign, mapKey);

  // Broadcast activation change
  publish(`map-activate-${campaign}`, { activeMap: mapKey }, campaign);
  publish(`maps-list-${campaign}`, { action: 'activated', activeMap: mapKey }, campaign);

  res.json({ message: 'Map activated successfully', activeMap: mapKey });
}));

// PUT /api/campaigns/:campaign/maps/:mapname/deactivate - Deactivate a map
// (backlog 2026-11-04 CQ: the list had ACTIVATE but no DEACTIVATE — a GM stuck
// with a wrong active map had to delete+recreate the file or restart the server,
// the only null-reset of the memory-only activeMaps). Mirrors /activate at
// every seam: GM-only gate, normalizeMapFile resolution, activeMaps + '__map__'
// (via stampActiveMapContext, same clear the delete lane performs at :481-483)
// and the twin map-activate / maps-list publishes so every open tab adopts
// activeMap: null over SSE without a reload.
router.put('/api/campaigns/:campaign/maps/:mapname/deactivate', asyncHandler((req, res) => {
  const { campaign, mapname } = req.params;
  if (!refuseUnlessGm(req, res)) return;
  const mapsDir = campaignMapsDir(campaign);
  const fileName = normalizeMapFile(mapname);
  const filePath = path.join(mapsDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Map not found' });
  }

  const mapKey = fileName.replace(/\.json$/, '');
  const currentActive = activeMaps.get(campaign) || null;
  // Honest refusal, zero writes: deactivating a non-active map must never
  // blank the real active map (the memory dict only ever holds one entry per
  // campaign, so a blind delete would silently corrupt the list's isActive).
  if (currentActive !== mapKey) {
    return res.status(409).json({
      error: currentActive
        ? `"${mapKey}" is not the active map — "${currentActive}" stays active.`
        : `"${mapKey}" is not the active map — no map is currently active.`,
      activeMap: currentActive,
    });
  }

  activeMaps.delete(campaign);
  stampActiveMapContext(campaign, null);

  // Broadcast deactivation change (same channels/shape as activation —
  // activeMap: null is the deactivate face both subscribers already parse)
  publish(`map-activate-${campaign}`, { activeMap: null }, campaign);
  publish(`maps-list-${campaign}`, { action: 'deactivated', activeMap: null, map: mapKey }, campaign);

  res.json({ message: 'Map deactivated successfully', activeMap: null });
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
