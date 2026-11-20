import express from 'express';
import fs from 'fs';
import guid from 'guid';
import { publish } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDataFile, campaignDir, ensureDataDir } from '../utils/campaignPaths.js';

const router = express.Router();

// In-memory cache for logs per campaign
const logCache = new Map();

export { logCache };

function loadLog(campaign) {
  if (logCache.has(campaign)) return logCache.get(campaign);
  const file = campaignDataFile(campaign, 'campaign-log.json');
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      logCache.set(campaign, Array.isArray(data) ? data : []);
      return logCache.get(campaign);
    }
  } catch (err) {
    console.error(`Failed to read log for campaign ${campaign}:`, err.message);
  }
  logCache.set(campaign, []);
  return [];
}

function saveLogFile() {
  if (saveLogFile._timer) clearTimeout(saveLogFile._timer);
  saveLogFile._timer = setTimeout(() => {
    for (const campaign of logCache.keys()) {
      if (!fs.existsSync(campaignDir(campaign))) {
        console.error(`[log] Skipping persist for campaign "${campaign}" — its directory no longer exists on disk. Removing from memory to prevent phantom campaign regeneration.`);
        logCache.delete(campaign);
        continue;
      }
      ensureDataDir(campaign);
      const file = campaignDataFile(campaign, 'campaign-log.json');
      try {
        const log = logCache.get(campaign);
        const trimmed = log.slice(-500);
        fs.writeFileSync(file, JSON.stringify(trimmed, null, 2));
      } catch (err) {
        console.error(`Failed to save log for campaign ${campaign}:`, err.message);
      }
    }
    saveLogFile._timer = null;
  }, 1000);
}

// Exported for L5 server-dice (campaigns-roll.js) — one log pipeline.
export function addEntry(campaign, entry) {
  const log = loadLog(campaign);
  // id/timestamp are server-controlled audit fields: spread the incoming entry
  // FIRST so a client-supplied id or timestamp can never forge identity or
  // ordering of the shared campaign log.
  const newEntry = {
    ...entry,
    id: guid.create().toString(),
    timestamp: Date.now()
  };
  log.push(newEntry);
  logCache.set(campaign, log);
  saveLogFile();

  publish(`log-${campaign}`, newEntry, campaign);  return newEntry;
}

// POST-lane schema gate (owner ruling 2026-11-20, backlog 2026-11-20 YY):
// this lane stays visitor-writable shared-table authoring (same doctrine as
// /spell-overlay) but is no longer schema-FREE. A forged row used to land
// 200 for ANY JSON — it stamped id/timestamp, broadcast `log-<c>` to every
// client and fed the audio cue lane (cueForLogEntry), so a visitor-crafted
// {type:'hp_change',threshold:'dead'} row could sound death table-wide and
// inject fake audit rows. Gate on SHAPE only — origin-neutral, never 403:
//   1. body must be a JSON object;
//   2. `type` must be a string in ALLOWED_LOG_TYPES below;
//   3. the entry must carry non-empty human-readable text in one of the
//      canonical display fields the Log view reads — message/description/
//      noteText/summary (directAuditText in src/components/log/log-utils.js)
//      plus the info-lane `text` field (src/hooks/combat/attackBlockers.js).
// Extra unknown non-required fields pass through untouched so every existing
// producer stays byte-compatible. Refusals append NO row and fire NO
// broadcast — validation runs strictly before addEntry().
//
// ALLOWED_LOG_TYPES — derived by enumerating every producer of this lane:
//   - client logService.addEntry/useLog callers and direct POST /log fetches
//     (MusicPlayer keepalive lane, npcCombatService) — grep `addEntry(` with
//     the entry literal across src/ (non-test);
//   - server-side addEntry callers: routes/campaigns-roll.js (roll),
//     routes/campaigns-changedata.js (write_rejected), routes/inventory.js
//     (inventory_transfer), routes/campaigns-ai.js + routes/ai-designer.js
//     which inject addEntry as the AI `log` sink (ai_designer/ai_refine/
//     ai_dress/ai_authoring/ai_world/ai_director/ai_ruling);
//   - dynamic template types: ai_draft_approved/ai_draft_rejected
//     (campaign/draftActions.js), plus adventure_regenerated
//     (campaign/seededCampaign.js);
//   - cross-checked against the render dispatch Log.jsx ENTRY_COMPONENTS and
//     the SessionSection AUDIT_TYPES list.
export const ALLOWED_LOG_TYPES = new Set([
  'ability_use', 'action_complete', 'adventure_regenerated',
  'ai_authoring', 'ai_designer', 'ai_director', 'ai_director_applied',
  'ai_draft_approved', 'ai_draft_rejected', 'ai_dress', 'ai_refine',
  'ai_ruling', 'ai_ruling_applied', 'ai_world', 'ai_world_applied',
  'automation', 'automation_info', 'buff', 'condition', 'concentration_lost',
  'death_save', 'encounter', 'enforcement_cover', 'enforcement_denied',
  'enforcement_triggered', 'healing', 'healing_pool', 'hp_change', 'info',
  'inventory_transfer', 'long_rest', 'loot', 'map_regenerated',
  'material_consumed', 'metamagic', 'metamagic_use', 'music', 'narrative',
  'note', 'psionic_sorcery', 'roll', 'save_result', 'session-played',
  'session_phase', 'short_rest', 'spell', 'spell_effect', 'summons',
  'travel', 'ward_absorbed', 'write_rejected',
]);

// Canonical verbatim-text fields (see gate comment above). One canonical
// shape rule still holds: an entry needs AT LEAST ONE of these non-empty.
const LOG_TEXT_FIELDS = ['message', 'description', 'noteText', 'summary', 'text'];

// Returns a plain-English error string, or null when the shape is valid.
function validateLogEntryBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Log entry must be a JSON object with a "type" and readable text';
  }
  const { type } = body;
  if (typeof type !== 'string' || !type.trim()) {
    return 'Log entry requires a "type" string';
  }
  if (!ALLOWED_LOG_TYPES.has(type)) {
    return `Unknown log entry type: "${type.slice(0, 60)}" is not a type the app writes to the campaign log`;
  }
  const hasReadableText = LOG_TEXT_FIELDS.some(
    (field) => typeof body[field] === 'string' && body[field].trim().length > 0
  );
  if (!hasReadableText) {
    return 'Log entry requires non-empty human-readable text (a "message" or "description" field)';
  }
  return null;
}

// GET /api/campaigns/:campaign/log - returns full log (last 500 entries)
router.get('/api/campaigns/:campaign/log', asyncHandler((req, res) => {
  const log = loadLog(req.params.campaign);
  res.json(log.slice(-500));
}));

// POST /api/campaigns/:campaign/log - add a new log entry (shape-gated, see
// ALLOWED_LOG_TYPES above; visitor-writable for legitimate row shapes)
router.post('/api/campaigns/:campaign/log', asyncHandler((req, res) => {
  const rejection = validateLogEntryBody(req.body);
  if (rejection) {
    return res.status(400).json({ error: rejection });
  }
  const entry = addEntry(req.params.campaign, req.body);
  res.json(entry);
}));

export default router;
