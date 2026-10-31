/**
 * AI Campaign Authoring (plan Phase 4) — designer HTTP surface.
 *
 *   POST /api/campaigns/:campaign/ai/designer/chat     { message }      → { reply }
 *   POST /api/campaigns/:campaign/ai/designer/plan     {}               → { scope }   (GM edits/confirms this)
 *   POST /api/campaigns/:campaign/ai/designer/generate { scope }        → applyBlueprint result (drafts)
 *   GET  /api/campaigns/:campaign/ai/designer/conversation              → design-notes.json
 *
 * Authority mirrors every other AI surface (§12): localhost (the GM) only,
 * and 403 while aiConfig is off — zero new traffic for non-AI campaigns.
 * Nothing here writes outside services/ai/authoring (which only ever writes
 * DRAFTS through the CRUD lanes, snapshot-first, GM-approved later).
 */
import express from 'express';
import { characterChangeData } from '../utils/changeData.js';
import { addEntry } from './log.js';
import { aiConfigLive } from '../services/ai/index.js';
import { designChat, proposePlan, generateBlueprint } from '../services/ai/authoring/designer.js';
import { refineEntity } from '../services/ai/authoring/refine.js';
import { dressMapProposal } from '../services/ai/authoring/dressMap.js';
import { loadNotes } from '../services/ai/authoring/designNotes.js';

const router = express.Router();

const isGM = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

function gate(req, res) {
    if (!isGM(req)) {
        res.status(403).json({ error: 'only localhost (the GM) may use the AI designer' });
        return null;
    }
    const cfg = (characterChangeData.get(req.params.campaign) || {}).aiConfig;
    if (!aiConfigLive(cfg)) {
        res.status(403).json({ error: 'AI is not enabled for this campaign' });
        return null;
    }
    return cfg;
}

router.get('/api/campaigns/:campaign/ai/designer/conversation', (req, res) => {
    try {
        if (!isGM(req)) return res.status(403).json({ error: 'GM-only' });
        res.json(loadNotes(req.params.campaign));
    } catch (e) {
        console.error('[ai-designer:conversation]', e);
        res.status(500).json({ error: 'designer conversation read failed' });
    }
});

router.post('/api/campaigns/:campaign/ai/designer/chat', async (req, res) => {
    try {
        const cfg = gate(req, res);
        if (!cfg) return;
        const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 8000) : '';
        if (!message) return res.status(400).json({ error: 'message is required' });
        const result = await designChat({ campaign: req.params.campaign, message, aiConfig: cfg });
        res.json(result);
    } catch (e) {
        console.error('[ai-designer:chat]', e);
        res.status(500).json({ error: 'ai designer chat failed' });
    }
});

router.post('/api/campaigns/:campaign/ai/designer/plan', async (req, res) => {
    try {
        const cfg = gate(req, res);
        if (!cfg) return;
        const result = await proposePlan({ campaign: req.params.campaign, aiConfig: cfg, log: addEntry });
        res.json(result);
    } catch (e) {
        console.error('[ai-designer:plan]', e);
        res.status(500).json({ error: 'ai designer plan request failed' });
    }
});

router.post('/api/campaigns/:campaign/ai/designer/generate', async (req, res) => {
    try {
        const cfg = gate(req, res);
        if (!cfg) return;
        const scope = req.body?.scope;
        if (!scope || typeof scope !== 'object') {
            return res.status(400).json({ error: 'scope (the confirmed build plan) is required' });
        }
        const result = await generateBlueprint({ campaign: req.params.campaign, scope, aiConfig: cfg, log: addEntry });
        res.json(result);
    } catch (e) {
        console.error('[ai-designer:generate]', e);
        res.status(500).json({ error: 'ai designer generation failed' });
    }
});

router.post('/api/campaigns/:campaign/ai/refine/:kind', async (req, res) => {
    try {
        const cfg = gate(req, res);
        if (!cfg) return;
        const { entity, instruction } = req.body || {};
        const result = await refineEntity({ campaign: req.params.campaign, kind: req.params.kind, entity, instruction, aiConfig: cfg, log: addEntry });
        res.json(result);
    } catch (e) {
        console.error('[ai-designer:refine]', e);
        res.status(500).json({ error: 'ai refine failed' });
    }
});

// AI Dress (campaign-authoring residual item 2): PROPOSAL ONLY — in-place ops
// on the live map document, returned pre-validated for the GM's preview.
// Nothing is written here; the client saves through the normal map PUT lane.
router.post('/api/campaigns/:campaign/ai/dress/:mapname', async (req, res) => {
    try {
        const cfg = gate(req, res);
        if (!cfg) return;
        const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction : '';
        const result = await dressMapProposal({ campaign: req.params.campaign, mapName: req.params.mapname, instruction, aiConfig: cfg, log: addEntry });
        res.json(result);
    } catch (e) {
        console.error('[ai-designer:dress]', e);
        res.status(500).json({ error: 'ai map dress failed' });
    }
});

export default router;
