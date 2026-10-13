/**
 * Level 5 Phase 3 (L5-004, plan §9.2) — AI referee endpoints.
 *
 * POST /api/campaigns/:campaign/ai/referee { action, characterName? }
 *   The heart of "replace the GM": freeform player action + compact world
 *   context → schema-validated ruling PROPOSAL. Nothing is applied here —
 *   'suggest' returns the proposal for referee confirmation; the confirmed
 *   execution routes through the existing gated automation lanes (P3-c).
 *   Failures fail CLOSED to a needs_human ruling logged to the campaign,
 *   never a silent auto-decision on the table (§9.5 + AGENTS.md no-timers:
 *   a model timeout becomes "the referee decides", never an auto-ruling).
 *
 * POST /api/campaigns/:campaign/ai/director { creatureName }
 *   §9.3 NPC director: the model picks ONLY from the monster's real stat
 *   block (allowlist-enforced actions / living targets / speed), turn-lock
 *   and action-economy refusals happen before any model call. Returns an
 *   intent PROPOSAL — execution rides the existing monster lanes, after
 *   referee confirm in suggest mode.
 *
 * GET /api/campaigns/:campaign/ai/status
 *   { configured, mode, endpoint, model, reachable?, models? } for the
 *   (future) Referee console and the health check in server.js.
 *
 * Authority (§12): localhost or the assigned referee clientId only.
 * With aiConfig unset/off these endpoints answer 403 — every non-AI
 * campaign is byte-identical to Levels 1–4 (zero new traffic).
 */
import express from 'express';
import { characterChangeData } from '../utils/changeData.js';
import { addEntry } from './log.js';
import { askReferee, askNpcDirector, askWorldKeeper, aiConfigLive, probe } from '../services/ai/index.js';
import { loadWorldState } from '../services/ai/worldContext.js';

const WORLD_KINDS = new Set(['recap', 'rumor', 'npc_dialogue', 'quest_draft', 'event']);

const router = express.Router();

// §12 authority: AI surfaces are referee surfaces.
function isReferee(req) {
    if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') return true;
    const referee = (characterChangeData.get(req.params.campaign) || {}).referee;
    const clientId = req.header('x-client-id');
    return !!(referee && typeof referee === 'object' && clientId && clientId === referee.clientId);
}

router.get('/api/campaigns/:campaign/ai/status', async (req, res) => {
    try {
        const cd = characterChangeData.get(req.params.campaign) || {};
        const cfg = cd.aiConfig;
        const base = {
            configured: aiConfigLive(cfg),
            mode: cfg?.mode || 'off',
            endpoint: cfg?.endpoint || null,
            model: cfg?.model || null,
        };
        if (base.configured) {
            // Bounded health probe (5s) — status stays fast and never hangs.
            base.reachable = await probe({ endpoint: cfg.endpoint, provider: cfg.provider });
        }
        res.json(base);
    } catch (e) {
        console.error('[campaigns-ai:status]', e);
        res.status(500).json({ error: 'ai status failed' });
    }
});

router.post('/api/campaigns/:campaign/ai/referee', async (req, res) => {
    try {
        const { campaign } = req.params;
        const cd = characterChangeData.get(campaign) || {};
        const cfg = cd.aiConfig;
        if (!aiConfigLive(cfg)) {
            return res.status(403).json({ error: 'AI referee is not enabled for this campaign' });
        }
        if (!isReferee(req)) {
            return res.status(403).json({ error: 'only the referee (or localhost) may request AI rulings' });
        }
        const action = typeof req.body?.action === 'string' ? req.body.action.trim().slice(0, 2000) : '';
        if (!action) {
            return res.status(400).json({ error: 'action (what the character does) is required' });
        }
        const characterName = typeof req.body?.characterName === 'string' ? req.body.characterName.trim().slice(0, 120) : null;

        const result = await askReferee({ campaign, action, characterName, aiConfig: cfg, state: cd, log: addEntry });
        res.status(200).json({ ...result, mode: cfg.mode });
    } catch (e) {
        console.error('[campaigns-ai:referee]', e);
        res.status(500).json({ error: 'ai referee request failed' });
    }
});

router.post('/api/campaigns/:campaign/ai/director', async (req, res) => {
    try {
        const { campaign } = req.params;
        const cd = characterChangeData.get(campaign) || {};
        const cfg = cd.aiConfig;
        if (!aiConfigLive(cfg)) {
            return res.status(403).json({ error: 'AI is not enabled for this campaign' });
        }
        if (!isReferee(req)) {
            return res.status(403).json({ error: 'only the referee (or localhost) may direct NPCs with AI' });
        }
        const creatureName = typeof req.body?.creatureName === 'string' ? req.body.creatureName.trim().slice(0, 120) : '';
        if (!creatureName) {
            return res.status(400).json({ error: 'creatureName is required' });
        }
        const creature = (cd.combatSummary?.creatures || []).find(c => c.name === creatureName);
        if (!creature) {
            return res.status(404).json({ error: `'${creatureName}' is not in the combat order` });
        }
        if (creature.type === 'player') {
            return res.status(400).json({ error: 'players direct themselves — the AI directs NPCs only' });
        }

        const result = await askNpcDirector({ campaign, creatureName, aiConfig: cfg, state: cd, log: addEntry });
        const refusalStatus = { NOT_THEIR_TURN: 409, NPC_DOWN: 409 }[result.code];
        if (refusalStatus) {
            return res.status(refusalStatus).json({ error: result.code, intent: result.intent || null });
        }
        res.status(200).json({ ...result, mode: cfg.mode });
    } catch (e) {
        console.error('[campaigns-ai:director]', e);
        res.status(500).json({ error: 'ai director request failed' });
    }
});

router.post('/api/campaigns/:campaign/ai/world', async (req, res) => {
    try {
        const { campaign } = req.params;
        const cd = characterChangeData.get(campaign) || {};
        const cfg = cd.aiConfig;
        if (!aiConfigLive(cfg)) {
            return res.status(403).json({ error: 'AI is not enabled for this campaign' });
        }
        if (!isReferee(req)) {
            return res.status(403).json({ error: 'only the referee (or localhost) may ask the AI world keeper' });
        }
        const kind = String(req.body?.kind || '');
        if (!WORLD_KINDS.has(kind)) {
            return res.status(400).json({ error: `kind must be one of: ${[...WORLD_KINDS].join(', ')}` });
        }
        const focus = typeof req.body?.focus === 'string' ? req.body.focus.trim().slice(0, 400) : null;

        const { context, allow } = loadWorldState(campaign, cd);
        const result = await askWorldKeeper({ campaign, kind, focus, world: context, allow, aiConfig: cfg, log: addEntry });
        res.status(200).json({ ...result, mode: cfg.mode });
    } catch (e) {
        console.error('[campaigns-ai:world]', e);
        res.status(500).json({ error: 'ai world keeper request failed' });
    }
});

export default router;
