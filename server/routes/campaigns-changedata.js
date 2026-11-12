import express from 'express';
import lodash from 'lodash';
import { publish, characterChangeData, markDirty, warnIfNewTopLevelKey } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { resolveOverrideTitles } from '../utils/resolveTrackTitles.js';
import { validateRuntimeWrite } from '../validation/keyValidators.js';
import { isInvalidCampaignName } from '../utils/campaignReadGuard.js';
import { addEntry as addLogEntry } from './log.js';

const router = express.Router();

// Reject requests with invalid campaign names before any route handler.
// (On the full server the app-level missing-folder guard answers these
// FIRST with the identical 400 — this middleware keeps the face intact for
// this router in isolation, e.g. under its co-located supertest suites.)
router.use('/api/campaigns/:campaign', (req, res, next) => {
    const { campaign } = req.params;
    if (isInvalidCampaignName(campaign)) {
        console.error('Rejecting request for invalid campaign name', { campaign, url: req.originalUrl, ip: req.ip });
        return res.status(400).json({ error: 'Invalid campaign name' });
    }
    next();
});

// GET /api/campaigns/:campaign/change-data - Get full change data object for campaign
router.get('/api/campaigns/:campaign/change-data', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const data = characterChangeData.get(campaign);
    res.json(data || {});
}));

// GET /api/campaigns/:campaign/positioning - Get positioning data
router.get('/api/campaigns/:campaign/positioning', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const data = characterChangeData.get(campaign);
    res.json({ positioning: data?.positioning || {} });
}));

// POST /api/campaigns/:campaign/positioning - Save positioning data
router.post('/api/campaigns/:campaign/positioning', asyncHandler((req, res) => {
    const { campaign } = req.params;
    const { positioning } = req.body;

    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }

    warnIfNewTopLevelKey(campaign, 'positioning');
    characterChangeData.get(campaign).positioning = positioning;
    markDirty(campaign);

    // Broadcast positioning change
    publish(`positioning-${campaign}`, positioning, campaign);

    res.json({ message: 'Positioning saved successfully' });
}));

/**
 * Shared copy for the deprecated "campaign" key guard (GET/POST :campaign/campaign).
 * When the POST body exposes top-level keys, name each offending key's real route
 * (mirror the .json trap's tone of citing a concrete route); bodies with no usable
 * keys keep the generic sentence so no face regresses to a worse message.
 */
function deprecatedCampaignKeyError(campaign, body) {
    const keys = (body && typeof body === 'object' && !Array.isArray(body))
        ? Object.keys(body).filter(k => k.length > 0)
        : [];
    if (keys.length === 0) {
        return 'Use /api/campaigns/:campaign/:key for campaign-level data';
    }
    return `Use ${keys.map(k => `/api/campaigns/${campaign}/${k}`).join(' or ')} for campaign-level data`;
}

// GET /api/campaigns/:campaign/:key - Generic GET from in-memory change data store
router.get('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    if (key === 'campaign') {
        console.error(
            '[campaigns-changedata] Client read from deprecated "campaign" key. ' +
            `Campaign: "${campaign}", key: "${key}". Campaign-level keys should GET from /api/campaigns/:campaign/:key directly. ` +
            'Check useRuntimeState.js or storage.js for getRuntimeValue("campaign", ...) or storage.getProperty("campaign", ...).',
            { campaign, key, stack: new Error().stack }
        );
        // No body to name on GET — the two documented top-level families are
        // the honest static example, with the real campaign name interpolated.
        return res.status(400).json({
            error: `Use /api/campaigns/${campaign}/<key> for campaign-level data ` +
                `(e.g. /api/campaigns/${campaign}/enforcement or /api/campaigns/${campaign}/aiConfig)`,
        });
    }
    if (key === campaign) {
        console.error(
            '[campaigns-changedata] GET to :campaign/:campaign with key === campaign. ' +
            `Campaign: "${campaign}", key: "${key}". Campaign-level data should GET from :campaign/:key directly.`,
            { campaign, key, stack: new Error().stack }
        );
    }
    const data = characterChangeData.get(campaign);

    if (!data || !(key in data)) {
        return res.json({ value: null });
    }

    res.json({ [key]: data[key] });
}));

// Campaign-specific music categories (improve 2026-11-07): the shared 'music'
// key gains a customCategories map ({ [key]: {label, icon} }) alongside
// overrides. Keys must carry the `custom-` prefix the client slugger produces
// — this makes built-in mood shadowing impossible at the API boundary too —
// and entries need a short label. The map is replaced wholesale on every
// PATCH that carries it (create = entry added, delete = entry absent).
const CUSTOM_CATEGORY_KEY = /^custom-[a-z0-9-]+$/;
const MAX_CUSTOM_CATEGORIES = 20;

function validateCategoryEntry(key, entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return `music.customCategories.${key} must be an object`;
    }
    if (typeof entry.label !== 'string' || entry.label.trim() === '' || entry.label.length > 40) {
        return `music.customCategories.${key}.label must be a non-empty string (max 40 chars)`;
    }
    if ('icon' in entry && (typeof entry.icon !== 'string' || entry.icon.length > 40)) {
        return `music.customCategories.${key}.icon must be a string (max 40 chars)`;
    }
    return null;
}

function validateCustomCategories(customCategories) {
    if (!customCategories || typeof customCategories !== 'object' || Array.isArray(customCategories)) {
        return 'music.customCategories must be an object';
    }
    const keys = Object.keys(customCategories);
    if (keys.length > MAX_CUSTOM_CATEGORIES) {
        return `music.customCategories supports at most ${MAX_CUSTOM_CATEGORIES} categories`;
    }
    for (const key of keys) {
        if (!CUSTOM_CATEGORY_KEY.test(key)) {
            return `music.customCategories key "${key}" must match the custom-<slug> shape`;
        }
        const entryError = validateCategoryEntry(key, customCategories[key]);
        if (entryError) return entryError;
    }
    return null;
}

// Whole-payload shape guard for the POST /music route (both PATCH intents).
function validateMusicPayload(incoming) {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        return 'music payload must be an object';
    }
    if ('overrides' in incoming && (!incoming.overrides || typeof incoming.overrides !== 'object' || Array.isArray(incoming.overrides))) {
        return 'music.overrides must be an object';
    }
    if ('customCategories' in incoming) {
        return validateCustomCategories(incoming.customCategories);
    }
    return null;
}

// POST /api/campaigns/:campaign/music - Shared ambience state (GM or delegated
// player), intent-split merge.
// Transport writes (play/pause/stop/mood/volume via useSyncedState) POST the full
// music object and overwrite every field, exactly as the generic wildcard did before.
// The track EDITOR save/reset PATCH sends { overrides } only: playing/mood/volume are
// absent from that payload, so server truth survives the merge — saving a track list
// while stopped must never resurrect playing:true and surprise-autoplay other tabs
// (backlog 2026-10-24). Response echoes the merged object so the editor can pin its
// local store to server truth (skipSync).
//
// Unresolved track titles (editor stamps title = raw video ID) are enriched
// server-side via YouTube oEmbed before the merge — browser cannot CORS-hit
// oembed (backlog 2026-10-24). Bounded parallel fetches; any failure falls
// back to the raw ID and NEVER blocks the save. Transport writes echo back
// already-resolved overrides, so the stampede guard (reuse stored titles)
// keeps play/pause instant — only new/changed videos cost a lookup.
router.post('/api/campaigns/:campaign/music', asyncHandler(async (req, res) => {
    const { campaign } = req.params;
    let incoming = ('value' in req.body ? req.body.value : req.body);
    const payloadError = validateMusicPayload(incoming);
    if (payloadError) {
        return res.status(400).json({ error: payloadError });
    }
    const current = characterChangeData.get(campaign)?.music;
    const base = (current && typeof current === 'object' && !Array.isArray(current))
        ? current
        : { mood: null, playing: false, volume: 0.6, overrides: {}, customCategories: {} };
    if ('overrides' in incoming) {
        incoming = { ...incoming, overrides: await resolveOverrideTitles(incoming.overrides, base.overrides) };
    }
    const merged = { ...base, ...incoming };

    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }
    warnIfNewTopLevelKey(campaign, 'music');
    characterChangeData.get(campaign).music = merged;
    markDirty(campaign);

    // Broadcast merged truth
    publish(`change-${campaign}-music`, merged, campaign);

    res.json({ music: merged, message: 'Music saved successfully' });
}));

// value may be the full store object { targetEffects: [...], hitPoints: 123, ... }
// or just the property value directly. Extract the property if value[key] exists.
function extractPropertyValue(key, value) {
    if (value && typeof value === 'object') {
        if (key in value) {
            return value[key];
        }
        if ('value' in value && Object.keys(value).length === 1 && typeof value.value === 'object') {
            // Client sent { value: fullStoreObject } — unwrap it directly
            return value.value;
        }
    }
    return value;
}

function warnDeprecatedLastAttack(campaign, key, value) {
    if (key !== 'combatSummary' || !value || typeof value !== 'object' || !('lastAttack' in value)) {
        return;
    }
    console.error(
        '[campaigns-changedata] Client wrote lastAttack to deprecated combatSummary.lastAttack. ' +
        `Campaign: "${campaign}". Use POST to /api/campaigns/:campaign/lastAttack directly. ` +
        'Check storage.setProperty(\'combatSummary\', \'lastAttack\', ...) or storage.set(\'combatSummary\', { ...lastAttack }).'
    );
}

/**
 * combatSummary concurrent-write guard (bug-initiative-concurrent-npc-spawn-lost-update):
 * the board is a full-replace store — a read-modify-write off a stale mirror used to
 * silently drop another GM tab's accepted mutation (last write wins, zero feedback).
 * Guarded writers (the +NPC lane) POST a boardVersion stamp alongside the board: the
 * version their copy was built from. If the stored board has moved on, refuse with 409
 * (the .ct-* entity lanes' jsonEntityCrud doctrine) — the client re-reads, re-applies
 * its single mutation once, or surfaces an honest toast. Writers without baseVersion
 * (HP edits, Next/Prev, EB join) keep the exact pass-through behaviour of today; the
 * stamp rides inside the stored value, so it travels/clears with every board write and
 * the check always compares the sender's base against the CURRENT stored truth.
 * Returns the live version when the sender's base is stale, null when the write is safe.
 */
function staleCombatSummaryBase(campaign, req) {
    if (req.params.key !== 'combatSummary' || !req.body || !('baseVersion' in req.body)) return null;
    const currentVersion = Number(characterChangeData.get(campaign)?.combatSummary?.boardVersion) || 0;
    return (Number(req.body.baseVersion) || 0) !== currentVersion ? currentVersion : null;
}

// POST /api/campaigns/:campaign/:key - Generic POST to in-memory change data store
router.post('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    if (key === 'campaign') {
        console.error(
            '[campaigns-changedata] Client wrote to deprecated "campaign" key. ' +
            `Campaign: "${campaign}", key: "${key}". Campaign-level keys should POST to /api/campaigns/:campaign/:key directly. ` +
            'Check useRuntimeState.js or storage.js for setRuntimeValue("campaign", ...) or storage.setProperty("campaign", ...).',
            { campaign, key, body: req.body, stack: new Error().stack }
        );
        return res.status(400).json({ error: deprecatedCampaignKeyError(campaign, req.body) });
    }

    if (key === campaign) {
        console.error(
            '[campaigns-changedata] POST to :campaign/:campaign with key === campaign. ' +
            `Campaign: "${campaign}", key: "${key}". Campaign-level data should POST to :campaign/:key directly.`,
            { campaign, key, stack: new Error().stack }
        );
    }

    // Dotted-key wildcard trap (backlog 2026-10-24): character routes (mounted
    // BEFORE this router) own every ".json" path — they consume GET/PUT/PATCH/
    // DELETE but never POST, so POST /:campaign/<anything>.json used to fall
    // through here and persist an undeletable junk key (the same URL GET/DELETE
    // routes to campaigns-character → 404). Runtime store keys are never
    // file-suffixed — refuse the write loudly instead of poisoning the store.
    if (key.endsWith('.json')) {
        console.error(
            '[campaigns-changedata] Rejected POST to file-suffixed change-data key. ' +
            `Campaign: "${campaign}", key: "${key}". ` +
            `Character files are written via PUT /api/campaigns/${campaign}/<file>.json.`,
            { campaign, key, stack: new Error().stack }
        );
        return res.status(400).json({
            error: `Change-data keys cannot end in .json — "${key}" looks like a character file. ` +
                `Save character files with PUT /api/campaigns/${campaign}/<file>.json.`,
        });
    }

    const value = 'value' in req.body ? req.body.value : req.body;

    const staleBase = staleCombatSummaryBase(campaign, req);
    if (staleBase !== null) {
        console.warn(`[campaigns-changedata] Concurrent-edit conflict on combatSummary (${campaign}): base version ${req.body.baseVersion} vs current ${staleBase}`);
        return res.status(409).json({
            error: 'Initiative board was modified in another tab or session since you loaded it — re-read the board and retry.',
            conflict: true,
            boardVersion: staleBase,
        });
    }

    warnDeprecatedLastAttack(campaign, key, value);

    if (!characterChangeData.has(campaign)) {
        characterChangeData.set(campaign, {});
    }

    const propertyValue = extractPropertyValue(key, value);

    // L5-001 (D2): per-key validators guard enforcement truth. No validator
    // registered for this key ⇒ the write passes through exactly as today.
    const validation = validateRuntimeWrite(key, propertyValue, { req, campaign, current: characterChangeData.get(campaign) });
    if (!validation.ok) {
        // Mirror the [maps] BLOCKED write-seam pattern (d3e1658c9): every
        // wildcard refusal leaves a named server-log line beside its
        // write_rejected audit entry.
        console.log(`[${key}] BLOCKED POST ${campaign} — ${validation.reason}`);
        // Broadcast the rejection so every client can surface the denied write.
        publish(`denied-${campaign}-${key}`, { key, reason: validation.reason }, campaign);
        // §10.4: denials are PERSISTENT audit — the audit ledger must show
        // what the server refused even after the SSE moment has passed.
        // GC improve 2026-11-10: API-validation refusals get their OWN type
        // (write_rejected) so a log-view filter on the gameplay-lane
        // enforcement_denied rows (creature/bucket/source) never mixes in
        // server-validator noise. 400 body and denied-* SSE stay byte-identical.
        addLogEntry(campaign, {
            type: 'write_rejected',
            origin: 'server-validator',
            key,
            reason: validation.reason,
            description: `Server rejected write to ${key}: ${validation.reason}`,
        });
        return res.status(400).json({ error: validation.reason });
    }

    // Validators may canonicalize the accepted payload (enforcement writes
    // persist the full flag blob, backlog 2026-10-25 subset-clobber); keys
    // without a normalized value store the raw payload exactly as before.
    const storedValue = 'value' in validation ? validation.value : propertyValue;

    warnIfNewTopLevelKey(campaign, key);
    characterChangeData.get(campaign)[key] = storedValue;
    markDirty(campaign);

    // Broadcast change
    publish(`change-${campaign}-${key}`, storedValue, campaign);

    res.json({ message: 'Data saved successfully' });
}));

/**
 * PATCH /api/campaigns/:campaign/:key — scoped field write into an object
 * change-data bucket (backlog 2026-11-04 CR: arming an initiative target
 * re-POSTed the ENTIRE combatSummary — {value:{round,creatures[14…]}} — for a
 * one-field change, and a stale-mirror snapshot carried the known
 * full-store-snapshot clobber family). Mirrors the campaigns-character.js
 * PATCH doctrine (:227): the client ships ONLY the changed slice (wrapped in
 * {value:{…}} like the POST lane), the SERVER merges it into its own current
 * truth, and the SSE echo carries the FULL merged bucket on the normal
 * change-<campaign>-<key> channel — cross-tab adoption bytes stay identical
 * to a full POST, and the full-replace law for snapshot writers is untouched.
 *
 * Merge semantics (general, not key-specific):
 *   • object + object ⇒ recursive field merge;
 *   • array + array where BOTH sides are string-named records (the
 *     combatSummary.creatures convention) ⇒ per-record field merge keyed by
 *     name: a patch record overwrites its present fields on the stored
 *     record, every other record survives untouched. A patch record whose
 *     name has no stored match is warned + SKIPPED — structural writes
 *     (join/remove/clear) keep riding the full POST;
 *   • anything else ⇒ the patch field replaces the stored field.
 *
 * Response honesty (backlog 2026-11-04 CS): alongside the existing
 * `message`, the 200 body reports `applied` (count of named records that
 * merged) and `skipped` (names with no stored match) so clients can detect
 * silently-dropped arms instead of trusting a blanket success.
 */
function isPlainRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Non-empty array whose every element is a record with a string name.
function namedRecords(value) {
    return Array.isArray(value) && value.length > 0 &&
        value.every(r => isPlainRecord(r) && typeof r.name === 'string');
}

function mergeNamedRecords(stored, patchRecords, stats) {
    const byName = new Map(stored.map(r => [r.name, r]));
    for (const record of patchRecords) {
        const match = byName.get(record.name);
        if (match) {
            stats.applied += 1;
            mergePatchFields(match, record, stats);
        } else {
            stats.skipped.push(record.name);
        }
    }
}

function mergePatchFields(target, patch, stats) {
    for (const [key, value] of Object.entries(patch)) {
        if (isPlainRecord(target[key]) && isPlainRecord(value)) {
            mergePatchFields(target[key], value, stats);
        } else if (namedRecords(target[key]) && namedRecords(value)) {
            mergeNamedRecords(target[key], value, stats);
        } else {
            target[key] = value;
        }
    }
}

/**
 * Swap-law race guard for the combatSummary arm lane
 * (bug-race-arm-patch-beats-swap-clear-post): the owner law "a direct
 * controller→controller swap (or release) never leaves an armed target behind"
 * lives in the CLIENT swap handler, which deletes `targetName` on the same
 * full-board POST that flips `controller`. But the arm lane writes a scoped,
 * client-coalesced (~120 ms) PATCH — cross-tab, that PATCH can arrive AFTER
 * the swap's POST and the by-name merge happily re-arms the already-swapped
 * row, silently defeating the law and falsifying the control_arm_cleared
 * audit row (live-confirmed 2026-11-12 run NN, wire stamps +17 ms POST /
 * +124 ms PATCH).
 *
 * The arm lane now declares the delegated controller its write was issued
 * against (`seenController` — a wire-only field, stripped here and never
 * stored). When the stored row answers to a DIFFERENT controller at merge
 * time, the arm was issued against a pre-swap world and its `targetName` is
 * dropped from the patch: the swap/release wins, the row stays exactly as
 * the swap POST left it, and the audit stays honest. The full-board echo
 * then re-derives every client's arm select from the merged truth.
 *
 * Null/absent seen context is DELIBERATELY permissive: GM/PC rows carry no
 * delegated controller, and the blessed first-time-assign law ("an existing
 * arm SURVIVES the first assign — the new controller's device sees it")
 * must keep holding even when an arm races an assign. Legacy unstamped
 * writers merge byte-identically to today. Returns the names of records
 * whose stale arm write was dropped (for response honesty + the named
 * server-log line beside it, per the skipped/unmatched doctrine above).
 */
function dropStaleArmWrites(campaign, key, patch, stored) {
    if (key !== 'combatSummary' || !namedRecords(patch.creatures)) return [];
    const storedRecords = Array.isArray(stored?.creatures) ? stored.creatures : [];
    const dropped = [];
    for (const record of patch.creatures) {
        if (!('seenController' in record)) continue;
        const seen = record.seenController ?? null;
        delete record.seenController; // wire-only field — never persists on a row
        if (seen === null || !('targetName' in record)) continue;
        const current = storedRecords.find((r) => r.name === record.name)?.controller ?? null;
        if (seen !== current) {
            delete record.targetName;
            dropped.push(record.name);
        }
    }
    if (dropped.length) {
        console.error(
            `[campaigns-changedata] PATCH ${key} (${campaign}) dropped stale arm write(s) for: ` +
            `${dropped.join(', ')} — the row's controller changed since the arm was issued ` +
            `(the new controller starts unarmed).`
        );
    }
    return dropped;
}

// PATCH /api/campaigns/:campaign/:key — see the merge doctrine above.
router.patch('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log' || key.endsWith('.json')) return next();

    const patch = ('value' in (req.body || {})) ? req.body.value : req.body;
    if (!isPlainRecord(patch)) {
        return res.status(400).json({ error: `PATCH to "${key}" must wrap an object patch in {value:{…}}` });
    }

    const data = characterChangeData.get(campaign);
    if (!isPlainRecord(data?.[key])) {
        return res.status(404).json({
            error: `Cannot PATCH "${key}" — no object stored under this key. ` +
                `Structural writes create the bucket via POST /api/campaigns/${campaign}/${key}.`,
        });
    }

    // Merge accounting (backlog 2026-11-04 CS): the old reply said "Data
    // patched successfully" even when EVERY record was skipped — the truth
    // lived only in the server console, so a silently-dropped arming arm was
    // undetectable client-side. The response now reports how many named
    // records actually merged (`applied`) and which had no stored match
    // (`skipped`). Field-level patches with no named-record arrays report
    // applied: 0 / skipped: [] — nothing was dropped, there were just no
    // records to merge; clients detect drops via `skipped.length > 0`.
    // Stale arm writes lost to a controller swap/release (dropStaleArmWrites)
    // are named in `staleArmDropped` — same never-silent-success doctrine.
    const staleArmDropped = dropStaleArmWrites(campaign, key, patch, data[key]);
    const merged = lodash.cloneDeep(data[key]);
    const stats = { applied: 0, skipped: [] };
    mergePatchFields(merged, patch, stats);
    const { skipped } = stats;
    if (skipped.length) {
        console.error(
            `[campaigns-changedata] PATCH ${key} (${campaign}) skipped unmatched record(s): ` +
            `${skipped.join(', ')} — structural writes ride the full POST.`
        );
    }

    // Validators run on the MERGED truth — the same chokepoint the POST lane
    // pays (unregistered keys keep today's passive property scan).
    const validation = validateRuntimeWrite(key, merged, { req, campaign, current: data });
    if (!validation.ok) {
        // Mirror the POST wildcard refusal branch above (cf8c33d7c): every
        // validator refusal on EVERY write lane leaves a named server-log line
        // beside its denied-* SSE moment and persistent write_rejected audit
        // row — denials are PERSISTENT audit, not console-only. 400 body and
        // log payload stay byte-identical to the POST lane.
        console.log(`[${key}] BLOCKED PATCH ${campaign} — ${validation.reason}`);
        // Broadcast the rejection so every client can surface the denied write.
        publish(`denied-${campaign}-${key}`, { key, reason: validation.reason }, campaign);
        // §10.4: denials are PERSISTENT audit — the audit ledger must show
        // what the server refused even after the SSE moment has passed.
        addLogEntry(campaign, {
            type: 'write_rejected',
            origin: 'server-validator',
            key,
            reason: validation.reason,
            description: `Server rejected write to ${key}: ${validation.reason}`,
        });
        return res.status(400).json({ error: validation.reason });
    }
    const storedValue = 'value' in validation ? validation.value : merged;

    characterChangeData.get(campaign)[key] = storedValue;
    markDirty(campaign);

    // Broadcast the FULL merged bucket — adopters never learn a patch lane
    // exists (byte-identical to a full POST echo).
    publish(`change-${campaign}-${key}`, storedValue, campaign);

    res.json({ message: 'Data patched successfully', applied: stats.applied, skipped, staleArmDropped });
}));

// PUT /api/campaigns/:campaign/:key — reserved-key guard only.
// No key has a PUT write lane here (change-data writes ride POST; ".json"
// PUTs are consumed by campaigns-character before this router mounts), so a
// PUT to an unreserved key keeps today's honest 404 byte-identically. The
// reserved spell-overlay key, though, must never shrug at malformed docs with
// an HTML 404 — it gets the same "Overlay save rejected: …" 400 + BLOCKED
// log the POST lane pays (backlog 2026-11-02 BE). A well-formed PUT still
// 404s: nothing persists through this verb, so nothing dishonest is written.
router.put('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key !== 'spell-overlay') return next();
    const value = 'value' in req.body ? req.body.value : req.body;
    const validation = validateRuntimeWrite(key, value, { req, campaign, current: characterChangeData.get(campaign) });
    if (!validation.ok) {
        console.log(`[${key}] BLOCKED PUT ${campaign} — ${validation.reason}`);
        return res.status(400).json({ error: validation.reason });
    }
    return next();
}));

// DELETE /api/campaigns/:campaign/:key - Remove a key from the change data store
// Honesty fix (backlog 2026-10-30-AO changedata-wildcard-false-success-on-missing-key):
// a key that never existed no longer gets a blanket 200 "deleted successfully" —
// 404 { error } matches every sibling DELETE route (npcs/maps/character/admin).
// Side effects stay byte-identical: the null SSE echo is unconditional (it
// honestly reports the post-request state — key absent — and lets stale local
// copies on other tabs self-heal), and markDirty still fires for a live
// campaign entry exactly as before.
router.delete('/api/campaigns/:campaign/:key', asyncHandler((req, res, next) => {
    const { campaign, key } = req.params;
    if (key === 'log') return next();
    let existed = false;
    if (characterChangeData.has(campaign)) {
        const store = characterChangeData.get(campaign);
        existed = Object.prototype.hasOwnProperty.call(store, key);
        delete store[key];
        markDirty(campaign);
    }
    publish(`change-${campaign}-${key}`, null, campaign);

    if (!existed) {
        return res.status(404).json({ error: `Change-data key not found: ${key}` });
    }
    res.json({ message: 'Data deleted successfully' });
}));

export default router;
