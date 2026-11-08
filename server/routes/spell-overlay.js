import express from 'express';
import { publish, spellOverlayData, markDirty } from '../utils/changeData.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getCampaignLock, activeCampaignLockAllows, blockRequest } from '../utils/campaignLock.js';

const router = express.Router();

// The only actions the transport understands (client senders in
// src/components/map/hooks/useSpellOverlay.js emit exactly these four).
const VALID_ACTIONS = new Set(['add', 'update', 'remove', 'clear']);

// GET stays open even while locked — mirrors the campaign-lock doctrine
// (READ_METHODS pass through campaignLock.js), and overlay reads are
// harmless in-memory snapshots. WRITES are the danger: this transport sits
// outside /api/campaigns/* (campaign is a query param), so the path-based
// lock middleware never inspects it. Enforce the same rule in-route: while
// locked, any write whose campaign is not the locked one is refused with the
// canonical 403 BEFORE the spellOverlayData Map or publish() are touched —
// this also refuses garbage campaign names (they are off-target by
// definition), closing both the cross-campaign-mutation hole and the
// unbounded phantom-entry growth.

// WRITE AUTHORITY (owner-ratified 2026-11-08): visitor-writability is
// INTENTIONAL shared-table authoring — GM and LAN visitors may all four
// actions alike; CAMPAIGN_LOCK is the ONLY origin gate here by design. Do
// NOT add refuseUnlessGm. The per-map-lane write matrix (this route vs the
// GM-only lanes in maps.js, ruler/3D being client-local) lives in AGENTS.md
// §"Map Lane Write Authority".

router.get('/spell-overlay', asyncHandler((req, res) => {
    const campaign = req.query.campaign;
    if (!campaign) {
        return res.status(400).json({ error: 'campaign query param required' });
    }
    // Read-path hygiene (backlog 2026-11-02 BF): never echo a malformed disk
    // row to a viewer — see filterRenderableOverlays below.
    const overlays = filterRenderableOverlays(campaign, spellOverlayData.get(campaign));
    res.json({ overlays });
}));

// While locked, refuse any write whose campaign is not a permitted member of
// the active lock (single name = that one campaign; set form permits the
// throwaway campaigns too). Returns true when the request was answered with
// the block response.
function refuseLockedOffTargetWrite(req, res, campaign) {
    const campaignLock = getCampaignLock();
    if (!campaignLock || activeCampaignLockAllows(campaign)) {
        return false;
    }
    blockRequest(req, res, campaignLock);
    return true;
}

// Transport shape for renderable overlays (client producer: createOverlay in
// src/models/SpellOverlay.js). Each shape sizes itself from these ft keys —
// a row missing one renders cx/r = NaN (React/SVG error spam + a phantom
// "Active (N)" panel row while the board shows nothing) or crashes
// overlayStroke on a missing color. Same key set the client guard
// isValidOverlay uses; keep both sides in step.
const SHAPE_SIZE_KEYS = {
    sphere: ['radiusFt'],
    cylinder: ['radiusFt'],
    cube: ['sizeFt'],
    cone: ['distanceFt', 'coneAngle'],
    line: ['distanceFt', 'widthFt'],
};

const isPositiveNumber = (value) => Number.isFinite(value) && value > 0;

// Names the first thing a renderable overlay is missing, or null when the
// item matches the canonical transport shape.
function overlayShapeProblem(overlay) {
    if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
        return `entry was ${overlay === null ? 'null' : Array.isArray(overlay) ? 'an array' : typeof overlay}, expected an object`;
    }
    const sizeKeys = SHAPE_SIZE_KEYS[overlay.shape];
    if (!sizeKeys) {
        return `shape ${JSON.stringify(overlay.shape) ?? String(overlay.shape)} is not a known overlay shape (sphere, cylinder, cube, cone, line)`;
    }
    if (!Number.isFinite(overlay.startGridX) || !Number.isFinite(overlay.startGridY)) {
        return 'startGridX/startGridY must be finite numbers';
    }
    const badSize = sizeKeys.find((key) => !isPositiveNumber(overlay[key]));
    if (badSize) {
        return `${badSize} must be a positive number for a ${overlay.shape}`;
    }
    if (typeof overlay.color !== 'string' || overlay.color.trim() === '') {
        return 'color must be a color string';
    }
    return null;
}

// Read-path twin of the POST write guard (backlog 2026-11-02 BF): rows
// persisted to disk BEFORE the guards existed (null / bare strings /
// x-y-radius junk) still boot straight into the transport Map, and GET used
// to echo them verbatim to every viewer (defense-in-depth beside the viewer
// fail-soft filters). Screens the snapshot through the SAME overlayShapeProblem
// the add/update write lane rejects with, so no second divergent validator
// exists. Dropped rows are NEVER removed from the stored array or from disk —
// this filters the response copy only (read-path hygiene) — and each drop
// logs one line, mirroring the `[spell-overlay] BLOCKED …` convention.
// `source` names the lane in the census line (GET responses vs the boot
// disk-load in changeData.js, bug 2026-11-02 BG: unfiltered boot rows
// crash-wedged the whole POST write lane).
// Exported so tests can pin the helper and changeData's boot load can reuse
// it (one validator, every lane).
export function filterRenderableOverlays(campaign, stored, source = 'GET') {
    if (!Array.isArray(stored)) {
        return [];
    }
    const valid = stored.filter(overlay => overlayShapeProblem(overlay) === null);
    const dropped = stored.length - valid.length;
    if (dropped > 0) {
        console.log(`[spell-overlay] dropped ${dropped} malformed row(s) ${source} ${campaign} — disk left untouched`);
    }
    return valid;
}

// Stored rows are screened on every entry path (boot load filters through
// filterRenderableOverlays, POST payloads through overlayShapeProblem), so
// traversals below stay structurally safe even for a store seeded by an old
// in-process rollback. `?.id` never throws on a null/undefined legacy row.
const storedId = (overlay) => overlay?.id;

// Refuses unrecognized actions (missing/non-string included), removes of
// ids absent from the campaign's list, and add/update payloads carrying a
// malformed overlay row (backlog 2026-11-02 BD: arbitrary coord keys like
// x/y/radius used to 200 and NaN-poison every tab's board). Returns an error
// message, or null when accepted. Runs AFTER the campaign 400 and the lock
// 403 (ordering is pinned by tests); a rejected request must never touch
// spellOverlayData, markDirty, or publish(), so it mutates nothing in memory
// or on disk. Absent/null/empty overlays arrays keep their current no-op 200.
function overlayValidationError(campaign, action, overlayId, overlays) {
    if (typeof action !== 'string' || !VALID_ACTIONS.has(action)) {
        return `Unknown spell-overlay action: ${JSON.stringify(action) ?? String(action)}`;
    }
    if ((action === 'add' || action === 'update') && overlays !== undefined && overlays !== null) {
        if (!Array.isArray(overlays)) {
            return `Spell overlay rejected: overlays must be an array of overlay objects — got ${typeof overlays}. Expected { id, shape, startGridX, startGridY, … } with finite coordinates and a positive size for the shape (e.g. radiusFt for a sphere).`;
        }
        for (const overlay of overlays) {
            const problem = overlayShapeProblem(overlay);
            if (problem) {
                return `Spell overlay rejected: every overlay needs a known shape, finite startGridX/startGridY numbers, a positive size for its shape (e.g. radiusFt for a sphere) and a color string — ${problem}.`;
            }
        }
    }
    if (action === 'remove' && overlayId) {
        const existing = spellOverlayData.get(campaign) || [];
        if (!existing.some(o => storedId(o) === overlayId)) {
            return `No overlay with id ${overlayId}`;
        }
    }
    return null;
}

// Accepted mutations only — validation already passed. Persists overlay state
// in-memory so it survives view switches.
function applyOverlayAction(campaign, action, overlays, overlayId) {
    if (!spellOverlayData.has(campaign)) {
        spellOverlayData.set(campaign, []);
    }
    switch (action) {
        case 'add':
            if (overlays?.length) {
                const existing = spellOverlayData.get(campaign);
                const existingIds = new Set(existing.map(o => storedId(o)));
                for (const overlay of overlays) {
                    if (!existingIds.has(overlay.id)) {
                        existing.push(overlay);
                    }
                }
            }
            break;
        case 'update':
            if (overlays?.length) {
                const existing = spellOverlayData.get(campaign);
                const updatedIds = new Set(overlays.map(o => o.id));
                spellOverlayData.set(campaign, existing.map(o => updatedIds.has(storedId(o)) ? overlays.find(n => n.id === storedId(o)) : o));
            }
            break;
        case 'remove':
            if (overlayId) {
                spellOverlayData.set(campaign, spellOverlayData.get(campaign).filter(o => storedId(o) !== overlayId));
            }
            break;
        case 'clear':
            spellOverlayData.set(campaign, []);
            break;
    }
}

router.post('/spell-overlay', asyncHandler((req, res) => {
    const campaign = req.query.campaign;
    if (!campaign) {
        return res.status(400).json({ error: 'campaign query param required' });
    }
    if (refuseLockedOffTargetWrite(req, res, campaign)) {
        return;
    }
    const { action, overlays, overlayId } = req.body || {};

    const validationError = overlayValidationError(campaign, action, overlayId, overlays);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    applyOverlayAction(campaign, action, overlays, overlayId);

    // Ride the shared debounced cache→disk lane (same as change-data) so
    // placed zones survive an API restart. Locked off-target writes and
    // invalid requests already returned and never reach this.
    markDirty(campaign);

    publish(`spell-overlay-${campaign}`, { action, overlays, overlayId }, campaign);
    res.json({ ok: true });
}));

export default router;
