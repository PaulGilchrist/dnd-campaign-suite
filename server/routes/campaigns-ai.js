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
 * Authority (§12): localhost (the GM) only — the assignable referee role
 * was removed 2026-10-13; the machine hosting the app IS the referee.
 * With aiConfig unset/off these endpoints answer 403 — every non-AI
 * campaign is byte-identical to Levels 1–4 (zero new traffic).
 */
import express from 'express';
import { characterChangeData } from '../utils/changeData.js';
import { isLocalhost } from '../utils/gmGuard.js';
import { addEntry } from './log.js';
import { askReferee, askNpcDirector, askWorldKeeper, askSessionRecap, aiConfigLive, probe } from '../services/ai/index.js';
import { loadWorldState } from '../services/ai/worldContext.js';

const WORLD_KINDS = new Set(['recap', 'rumor', 'npc_dialogue', 'quest_draft', 'event']);

const router = express.Router();

// §12 authority: AI surfaces are GM surfaces — localhost only (the assignable
// referee role was removed 2026-10-13; the GM machine is always localhost).
// The predicate is the SHARED gmGuard (2026-11-21 unification): it also
// counts the IPv6 loopback Host, so a `::1` tab is honestly GM everywhere.
const isGM = isLocalhost;

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
        if (!isGM(req)) {
            return res.status(403).json({ error: 'only localhost (the GM) may request AI rulings' });
        }
        const action = typeof req.body?.action === 'string' ? req.body.action.trim().slice(0, 2000) : '';
        if (!action) {
            return res.status(400).json({ error: 'action (what the character does) is required' });
        }
        const characterName = typeof req.body?.characterName === 'string' ? req.body.characterName.trim().slice(0, 120) : null;
        // Client-projected actor stats (backlog 2026-10-31: stat-blind dice
        // rulings). Passed through untrusted — promptBuilder re-sanitizes.
        const actorStats = req.body?.actorStats && typeof req.body.actorStats === 'object' ? req.body.actorStats : null;

        const result = await askReferee({ campaign, action, characterName, actorStats, aiConfig: cfg, state: cd, log: addEntry });
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
        if (!isGM(req)) {
            return res.status(403).json({ error: 'only localhost (the GM) may direct NPCs with AI' });
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
        if (!isGM(req)) {
            return res.status(403).json({ error: 'only localhost (the GM) may ask the AI world keeper' });
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

// Roadmap Step 8 — the session recap generator. GM presses "Write recap";
// the server gathers the session's stamped log rows, asks the model for an
// enthralling story grounded ONLY in those rows, and posts the result as a
// `session_recap` row authored GM — server-side addEntry, so the row gets the
// standard audit fields and the one log-<c> SSE broadcast (no client POST).
// STAMPING LAW (pinned in campaigns-ai-recap.test.js): addEntry's `session`
// field is the server stamp of WHEN the row was written (whatever session the
// table is playing); the row's `recapSession` field is the SUBJECT — the
// session whose story it tells. Renderers and the story-so-far memory key off
// recapSession, never the stamp, so a recap of Session 1 written during
// Session 2 stays honestly attributed.
router.post('/api/campaigns/:campaign/ai/recap', async (req, res) => {
    try {
        const { campaign } = req.params;
        const cd = characterChangeData.get(campaign) || {};
        const cfg = cd.aiConfig;
        if (!aiConfigLive(cfg)) {
            return res.status(403).json({ error: 'AI is not enabled for this campaign — configure it in the Admin console first' });
        }
        if (!isGM(req)) {
            return res.status(403).json({ error: 'only localhost (the GM) may ask the AI to write a session recap' });
        }
        const session = typeof req.body?.session === 'string' ? req.body.session.trim().slice(0, 120) : '';
        if (!session) {
            return res.status(400).json({ error: 'session (the session to recap) is required' });
        }

        const result = await askSessionRecap({ campaign, session, aiConfig: cfg });
        if (!result.ok) {
            // Honest refusals carry plain-English copy the button shows verbatim.
            const status = { RECAP_NO_ROWS: 400, RECAP_EMPTY_TRANSCRIPT: 400, AI_NEEDS_HUMAN: 502 }[result.code] || 502;
            return res.status(status).json({ ok: false, code: result.code, error: result.error || 'recap failed' });
        }
        const entry = addEntry(campaign, {
            type: 'session_recap',
            name: 'Session Recap',
            characterName: 'GM',
            description: result.text,
            recapSession: session,
        });
        res.status(200).json({ ok: true, entry });
    } catch (e) {
        console.error('[campaigns-ai:recap]', e);
        res.status(500).json({ error: 'ai recap request failed' });
    }
});

export default router;
