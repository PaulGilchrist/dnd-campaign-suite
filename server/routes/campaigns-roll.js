/**
 * Level 5 (L5-002) — optional server dice oracle (plan §7.4).
 *
 * POST /api/campaigns/:campaign/roll { expression, reason, mode }
 *   expression: '2d6+3' style (dice + flat modifier only — no math parser)
 *   mode: 'normal' | 'advantage' | 'disadvantage' (advantage rolls 2d20, keeps high)
 *
 * The SERVER rolls with crypto-grade randomness, logs the roll to the
 * campaign log, and broadcasts it via SSE — so enforced-mode results are
 * auditable and not forgeable client-side, and Phase 3's AI director gets an
 * honest oracle (AI selects, server rolls, engine applies).
 *
 * Reachable only when enforcement.serverDice is on — otherwise 403 with the
 * enforcement-off pass-through promise intact (the client never calls this
 * while the flag is off; a rogue caller is refused).
 */
import express from 'express';
import crypto from 'crypto';
import { characterChangeData, publish } from '../utils/changeData.js';
import { addEntry } from './log.js';

const router = express.Router();

// 2d6+3, 1d20, d8+2, 4d6-1 … — dice with optional flat modifier.
const EXPR_RE = /^(\d*)d(\d+)([+-]\d+)?$/i;
const MAX_DICE = 100;
const MAX_SIDES = 1000;

export function parseExpression(expression) {
    const m = EXPR_RE.exec(String(expression || '').trim());
    if (!m) return null;
    const count = m[1] === '' ? 1 : parseInt(m[1], 10);
    const sides = parseInt(m[2], 10);
    const mod = m[3] ? parseInt(m[3], 0) : 0;
    if (!Number.isFinite(count) || count < 1 || count > MAX_DICE) return null;
    if (!Number.isFinite(sides) || sides < 2 || sides > MAX_SIDES) return null;
    if (!Number.isFinite(mod)) return null;
    return { count, sides, mod };
}

function rollDie(sides) {
    return 1 + crypto.randomInt(sides);
}

function rollSet({ count, sides }) {
    const rolls = [];
    for (let i = 0; i < count; i++) rolls.push(rollDie(sides));
    return rolls;
}

// Pure-ish roll resolution: normal sums the dice; a single d20 with
// advantage/disadvantage rolls twice and keeps high/low. Returns the roll
// record; caller logs + broadcasts.
export function computeRoll(expression, parsed, mode) {
    const isAttackDie = parsed.count === 1 && parsed.sides === 20;
    let rolls;
    let kept;
    if (isAttackDie && mode !== 'normal') {
        const a = rollSet(parsed);
        const b = rollSet(parsed);
        rolls = [...a, ...b];
        kept = mode === 'advantage' ? Math.max(a[0], b[0]) : Math.min(a[0], b[0]);
    } else {
        rolls = rollSet(parsed);
        kept = rolls[0];
    }
    const keptSum = isAttackDie && mode !== 'normal' ? kept : rolls.reduce((s, r) => s + r, 0);
    return {
        expression,
        mode,
        rolls,
        kept: isAttackDie ? kept : null,
        modifier: parsed.mod,
        total: keptSum + parsed.mod,
        roller: 'server',
        timestamp: Date.now(),
    };
}

function serverEnforcementOn(campaign) {
    const cd = characterChangeData.get(campaign) || {};
    const enforcement = cd.enforcement;
    return { enforcement, on: !!(enforcement && enforcement.mode === 'on') };
}

router.post('/api/campaigns/:campaign/roll', async (req, res) => {
    try {
        const { campaign } = req.params;
        const { enforcement, on } = serverEnforcementOn(campaign);
        if (!on || !enforcement.serverDice) {
            return res.status(403).json({ error: 'server dice is not enabled for this campaign' });
        }

        const parsed = parseExpression(req.body?.expression);
        if (!parsed) {
            return res.status(400).json({ error: 'expression must be NdM(+K), 1..100 dice, 2..1000 sides' });
        }

        const mode = ['normal', 'advantage', 'disadvantage'].includes(req.body?.mode) ? req.body.mode : 'normal';
        const roll = computeRoll(req.body.expression, parsed, mode);
        roll.reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 200) : '';

        addEntry(campaign, {
            type: 'roll',
            roller: 'server',
            name: roll.reason || req.body.expression,
            rolls: roll.rolls,
            total: roll.total,
            mode: roll.mode,
            description: `Server rolled ${roll.expression}${roll.mode !== 'normal' ? ` (${roll.mode})` : ''}${roll.reason ? ` — ${roll.reason}` : ''}: ${roll.rolls.join(', ')} → ${roll.total}`,
        });

        publish(`server-roll-${campaign}`, roll, campaign);
        res.json(roll);
    } catch (e) {
        console.error('[serverDice] roll failed:', e);
        res.status(500).json({ error: 'roll failed' });
    }
});

export default router;
