import express from 'express';
import fs from 'fs';
import guid from 'guid';
import { publish, characterChangeData } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { campaignDataFile, campaignDir, ensureDataDir } from '../utils/campaignPaths.js';
import { isLocalhost } from '../utils/gmGuard.js';
import { readParty } from '../services/ai/authoring/party.js';

const router = express.Router();

// In-memory cache for logs per campaign
const logCache = new Map();

export { logCache };

// Exported for the AI memory lane (services/ai/storyMemory.js): the server-side
// log slice for "story so far" + recap context reads through this one loader
// (cache-first), never a second disk reader or an HTTP loop.
export function loadLog(campaign) {
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

// Persist budget (owner vision 2026-11-21 — "the log is AI memory"): the disk
// file is the campaign's durable narrative + combat history and is NEVER
// trimmed; only the served GET window is capped (500). At the ~100 bytes/row
// a combat row costs, a whole long campaign's log stays well under a few MB,
// so unbounded disk is intentional; archival/rotation is a future concern
// (see .opencode/plans/campaign-log-ai-memory-roadmap.md).
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
        fs.writeFileSync(file, JSON.stringify(log, null, 2));
      } catch (err) {
        console.error(`Failed to save log for campaign ${campaign}:`, err.message);
      }
    }
    saveLogFile._timer = null;
  }, 1000);
}

// Active-session stamp (memory-prep, owner vision 2026-11-21): every row
// records the session the table is currently playing, read from the campaign's
// runtime `sessionState` key in the server change-data cache (the same cache
// the POST /:key lane keeps synchronously current, so a just-set active
// session is visible to the very next row). Stamped SERVER-side so every
// producer lane (client POSTs, AI sinks, roll/inventory routes) is stamped
// without touching ~200 producers, and a client can never forge or omit it.
// Rows written outside any tracked session carry `session: null`.
// Exported alongside loadLog so the AI memory lane distinguishes the session
// the table is PLAYING (raw rows) from prior ones (recap-compressed memory).
export function activeSessionName(campaign) {
  const state = characterChangeData.get(campaign)?.sessionState;
  return typeof state?.name === 'string' && state.name.trim() ? state.name : null;
}

// Exported for L5 server-dice (campaigns-roll.js) — one log pipeline.
export function addEntry(campaign, entry) {
  const log = loadLog(campaign);
  // id/timestamp/session are server-controlled audit fields: spread the
  // incoming entry FIRST so a client-supplied id, timestamp, or session can
  // never forge identity, ordering, or session attribution of the shared
  // campaign log.
  const newEntry = {
    ...entry,
    id: guid.create().toString(),
    timestamp: Date.now(),
    session: activeSessionName(campaign)
  };
  log.push(newEntry);
  logCache.set(campaign, log);
  saveLogFile();

  publish(`log-${campaign}`, newEntry, campaign);  return newEntry;
}

// POST-lane schema gate (owner ruling 2026-11-20, backlog 2026-11-20 YY):
//
// INTENTIONAL TEXT-FIELD SPLIT (backlog 2026-11-20 AAA): a row's human-readable
// text lives in ONE of two canonical fields depending on the producing lane —
// chip-commit `roll`/`hp_change` rows carry the stamped `message`
// (src/services/ui/logService.js stampAuditText), while the quick-spawn join
// trio's initiative (`roll`) and party-seed (`automation`) rows carry a
// producer-written `description`. This is NOT a legacy dual-write: each row
// family writes exactly one field, by design. Narrative rows (manual GM
// composer posts and the world-console confirm lane) canonically carry
// `description`. Consumers must never grep a
// single field — canonical reads go through getEntryText
// (src/components/log/log-utils.js), which resolves the split with one
// documented precedence (message → description → noteText → summary).
//
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
//      noteText/summary (canonical read: getEntryText in
//      src/components/log/log-utils.js)
//      plus the info-lane `text` field (src/hooks/combat/attackBlockers.js).
// Extra unknown non-required fields pass through untouched so every existing
// producer stays byte-compatible. Client-side companion: the shared POST lane
// (src/services/ui/logService.js stampAuditText) derives a plain-English
// `message` for the app's own textless structured rows (roll/hp_change/death_
// save/condition/encounter), so real combat audits land while a hand-forged
// textless row like the death-cue attack above stays a 400.
// Refusals append NO row and fire NO broadcast — validation runs strictly
// before addEntry().
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
//     (campaign/seededCampaign.js).
// Drift protection (backlog 2026-11-20 ZZ): server/routes/log.schema-gate.test.js
// PINS this Set against the real client registries — every key of
// src/components/log/entryComponents.js ENTRY_COMPONENTS and every entry of
// src/components/campaign-admin/auditTypes.js AUDIT_TYPES must be a member.
// Adding a log type to either registry without adding it here turns that pin RED
// (instead of silently 400-ing the new producer at this gate).
export const ALLOWED_LOG_TYPES = new Set([
  'ability_use', 'action_complete', 'adventure_regenerated',
  'ai_authoring', 'ai_designer', 'ai_director', 'ai_director_applied',
  'ai_draft_approved', 'ai_draft_rejected', 'ai_dress', 'ai_refine',
  'ai_ruling', 'ai_ruling_applied', 'ai_world', 'ai_world_applied',
  'automation', 'automation_info', 'buff', 'condition', 'concentration_lost',
  'death_save', 'encounter', 'enforcement_clock_expired', 'enforcement_cover',
  'enforcement_denied', 'enforcement_triggered', 'healing', 'healing_pool',
  'hp_change', 'info', 'inventory_transfer', 'long_rest', 'loot',
  'map_regenerated', 'material_consumed', 'metamagic', 'metamagic_use',
  'music', 'narrative', 'note', 'psionic_sorcery', 'roll', 'save_result',
  'session_active', 'session-played', 'session_phase', 'session_recap',
  'short_rest',
  'spell', 'spell_effect',
  'summons', 'travel', 'ward_absorbed', 'write_rejected',
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

// ── Manual-author gate (owner ruling 2026-11-21) ──
// Compose-lane rows — the `note` and `narrative` types a human picks an author
// for in the Log view — must name a real author, never Anonymous:
//   • localhost (the GM tab, gmGuard.isLocalhost) may post as `GM`, any player
//     character, or any creature in the initiative tracker. The server does not
//     re-derive the initiative board here — the GM origin IS the trust
//     boundary (same posture as every other refuseUnlessGm lane).
//   • a non-GM (network) origin may post ONLY as a player character on the
//     campaign roster (readParty — the character files are the single source
//     of truth). No GM impersonation, no creature attribution, no Anonymous.
//   • the AI lanes are NOT affected by this gate: they call addEntry()
//     server-side (campaigns-ai.js injects it), which is the "AI acting as
//     GM/referee may add narrative rows at any time as the GM" rule. The
//     world-console confirm lane stamps its narrative rows `characterName:
//     'GM'` for exactly this reason.
// Automated/chip rows (roll, hp_change, delegated monster attacks, music,
// write_rejected, AI audit rows…) are NOT manual-author rows and keep their
// existing shapes byte-compatible. Refusals append NO row and fire NO
// broadcast — validation runs strictly before addEntry(), like the shape gate.
const MANUAL_AUTHOR_TYPES = new Set(['note', 'narrative']);

// Returns { status, error } on refusal, or null when the author is valid.
function validateManualAuthor(campaign, req, body) {
  if (!MANUAL_AUTHOR_TYPES.has(body.type)) return null;
  const author = typeof body.characterName === 'string' ? body.characterName.trim() : '';
  if (!author || author.toLowerCase() === 'anonymous') {
    return {
      status: 400,
      error: 'Log notes and narrative rows must name an author (the GM, a player, or an initiative creature) — Anonymous posting is not allowed',
    };
  }
  if (isLocalhost(req)) return null;
  const roster = new Set(readParty(campaign).map((member) => member.name));
  if (!roster.has(author)) {
    return {
      status: 403,
      error: `Visitors may post to the campaign log only as a player character — "${author}" is not on the "${campaign}" roster`,
    };
  }
  return null;
}

// GET /api/campaigns/:campaign/log - returns full log (last 500 entries)
router.get('/api/campaigns/:campaign/log', asyncHandler((req, res) => {
  const log = loadLog(req.params.campaign);
  res.json(log.slice(-500));
}));

// POST /api/campaigns/:campaign/log - add a new log entry (shape-gated +
// manual-author-gated, see ALLOWED_LOG_TYPES and validateManualAuthor above;
// automated lanes stay visitor-writable, compose-lane notes/narrative do not)
router.post('/api/campaigns/:campaign/log', asyncHandler((req, res) => {
  const rejection = validateLogEntryBody(req.body);
  if (rejection) {
    return res.status(400).json({ error: rejection });
  }
  const authorRejection = validateManualAuthor(req.params.campaign, req, req.body);
  if (authorRejection) {
    return res.status(authorRejection.status).json({ error: authorRejection.error });
  }
  const entry = addEntry(req.params.campaign, req.body);
  res.json(entry);
}));

export default router;
