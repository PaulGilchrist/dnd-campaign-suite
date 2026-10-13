/**
 * Level 5 Phase 3 (L5-004, plan §9) — AI service entry point.
 *
 * The single funnel every AI task flows through: build prompt → call the
 * LOCAL provider (D3) → parse + schema-validate (fail → retry ONCE →
 * `needs_human` fallback) → audit-log the proposal. The AI PROPOSES; the
 * engine applies after referee confirmation (§9.5). This module never writes
 * game state — it returns a validated ruling + logs the proposal.
 *
 * Runs server-side so every client shares one model and no endpoint/key
 * leaks to the browser.
 */
import { chat, probe, isLocalEndpoint } from './providers/localProvider.js';
import { buildRefereeMessages, parseRulingAnswer, buildDirectorMessages, parseIntentAnswer, buildWorldMessages, parseWorldAnswer } from './promptBuilder.js';
import { needsHumanRuling } from './schemas.js';
import { lookupMonsterActions } from './monsterActions.js';

export const AI_MODES = new Set(['off', 'suggest', 'autopilot']);

export function aiConfigLive(aiConfig) {
    return !!(aiConfig && aiConfig.mode && aiConfig.mode !== 'off' && isLocalEndpoint(aiConfig.endpoint));
}

function chatOpts(cfg) {
    return {
        endpoint: cfg.endpoint,
        model: cfg.model,
        temperature: cfg.temperature,
        provider: cfg.provider,
        timeoutMs: cfg.timeoutMs,
    };
}

/**
 * Ask the AI referee to rule on a player's freeform action (§9.2).
 * Returns { ok, ruling, proposals? }:
 *  - ok:true  — validated ruling; mode 'suggest' ⇒ awaiting referee confirm,
 *               'autopilot' ⇒ the CALLER (referee-console automation in P3-c)
 *               routes it through the normal gated lanes. Nothing applied here.
 *  - ok:false — AI off / unreachable / twice-invalid; ruling is the
 *               needs_human fallback so the table never stalls on the model.
 */
export async function askReferee({ campaign, action, characterName, aiConfig, state, log }) {
    if (!aiConfigLive(aiConfig)) {
        return { ok: false, code: 'AI_OFF', ruling: null };
    }
    const messages = buildRefereeMessages({ action, characterName, state });

    let lastError = 'no attempt made';
    for (let attempt = 1; attempt <= 2; attempt++) { // one retry, then human (§9.1)
        let content;
        try {
            content = await chat({ ...chatOpts(aiConfig), messages });
        } catch (e) {
            lastError = `${e.code || 'ERROR'}: ${String(e.message || e).slice(0, 160)}`;
            continue;
        }
        const result = parseRulingAnswer(content);
        if (result.ok) {
            await auditLog(log, campaign, characterName, result.ruling, attempt);
            return { ok: true, ruling: result.ruling, mode: aiConfig.mode };
        }
        lastError = `invalid ruling: ${result.errors.join('; ')}`;
    }

    const fallback = needsHumanRuling(lastError);
    await auditLog(log, campaign, characterName, fallback, 0);
    return { ok: false, code: 'AI_NEEDS_HUMAN', ruling: fallback };
}

/**
 * §9.3 — ask the AI director to decide an NPC's turn. Same funnel as the
 * referee (retry once → needs_human, audit-logged) but EVERY proposal is
 * bounded by the monster's real stat block: action names, living targets and
 * speed are an allowlist enforced by validateNpcIntent, and the turn-lock +
 * action-economy truth in the shared state can REFUSE the request outright
 * (before any model call) — honest refusals, not guesses.
 * Returns { ok, intent, code? }. The intent is a PROPOSAL; execution routes
 * through the existing monster lanes only after referee confirmation.
 */
const aliveOf = (c) => !c.isDead && (c.currentHp ?? c.hp ?? 1) > 0
const livingPlayers = (cs) => (cs.creatures || [])
    .filter(c => c.type === 'player' && aliveOf(c))
    .slice(0, 12)
    .map(c => ({ name: c.name, ac: c.ac ?? null, hp: c.currentHp ?? c.hp ?? null }))

function turnLockRefused(creatureName, cs, enforcement) {
    if (enforcement.mode !== 'on' || !enforcement.turnLock) return false;
    return (cs.activeCreatureName ?? null) !== creatureName;
}

/** Turn/economy/target truth — refusals happen before any model call. */
function directorGate(creatureName, state) {
    const cs = state.combatSummary || {};
    const enforcement = state.enforcement || {};
    if (turnLockRefused(creatureName, cs, enforcement)) {
        return { code: 'NOT_THEIR_TURN' }; // turn-lock truth — no model call, no guessing
    }
    const self = (cs.creatures || []).find(c => c.name === creatureName) || {};
    if (!aliveOf(self)) {
        return { code: 'NPC_DOWN' };
    }
    const economy = (state.turnState || {})[creatureName] || {};
    const actionsSpent = enforcement.mode === 'on' && enforcement.actionEconomy && (economy.actionsUsed ?? 0) >= 1;
    return { self, economy, actionsSpent, targets: livingPlayers(cs), round: cs.round };
}

function directorPrompt(creatureName, monster, gate) {
    const allow = {
        actionNames: monster.actions.map(a => a.name),
        targetNames: gate.targets.map(t => t.name),
        speedFeet: monster.speedFeet,
        allowedIntents: gate.actionsSpent ? ['move', 'talk', 'pass'] : null,
    };
    const messages = buildDirectorMessages({
        creatureName,
        monster,
        targets: gate.targets,
        self: { hp: gate.self.currentHp ?? gate.self.hp ?? null, conditions: Array.isArray(gate.self.conditions) ? gate.self.conditions.slice(0, 8) : [] },
        economy: { actionsUsed: gate.economy.actionsUsed ?? 0, bonusActionsUsed: gate.economy.bonusActionsUsed ?? 0, movementUsedFeet: gate.economy.movementUsedFeet ?? 0, actionsSpent: gate.actionsSpent },
        allowedIntents: allow.allowedIntents,
        round: gate.round ?? null,
    });
    return { allow, messages };
}

export async function askNpcDirector({ campaign, creatureName, aiConfig, state = {}, log }) {
    if (!aiConfigLive(aiConfig)) return { ok: false, code: 'AI_OFF' };

    const monster = lookupMonsterActions(creatureName);
    if (!monster || monster.actions.length === 0) {
        return await directorFail(log, campaign, creatureName, `no stat-block actions on file for '${creatureName}' — the GM directs this one`);
    }
    const gate = directorGate(creatureName, state);
    if (gate.code) return { ok: false, code: gate.code };
    if (gate.targets.length === 0 && !gate.actionsSpent) {
        return await directorFail(log, campaign, creatureName, 'no living targets in combat — the GM decides what this monster does');
    }
    const { allow, messages } = directorPrompt(creatureName, monster, gate);

    let lastError = 'no attempt made';
    for (let attempt = 1; attempt <= 2; attempt++) { // one retry, then human (§9.1)
        let content;
        try {
            content = await chat({ ...chatOpts(aiConfig), messages });
        } catch (e) {
            lastError = `${e.code || 'ERROR'}: ${String(e.message || e).slice(0, 160)}`;
            continue;
        }
        const result = parseIntentAnswer(content, allow);
        if (result.ok) {
            const intent = { ...result.intent, creatureName };
            await directorAudit(log, campaign, intent, attempt);
            return { ok: true, intent, mode: aiConfig.mode };
        }
        lastError = `invalid intent: ${result.errors.join('; ')}`;
    }
    return await directorFail(log, campaign, creatureName, lastError);
}

async function directorFail(log, campaign, creatureName, reason) {
    const intent = { intent: 'needs_human', creatureName, text: `AI director: ${String(reason).slice(0, 200)}` };
    await directorAudit(log, campaign, intent, 0);
    return { ok: false, code: 'AI_NEEDS_HUMAN', intent };
}

/**
 * §9.4 — ask the AI world keeper for campaign-consistent content (recap,
 * rumor, downtime event, NPC dialogue, quest draft). Same fail-closed funnel
 * as the referee/director: retry once → needs_human, audit `ai_world`.
 * The proposal GENERATES payloads only — confirmed content rides the normal
 * lanes (log / quests CRUD), the model never writes (§9.5).
 */
export async function askWorldKeeper({ campaign, kind, focus, world, allow, aiConfig, log }) {
    if (!aiConfigLive(aiConfig)) return { ok: false, code: 'AI_OFF' };
    const messages = buildWorldMessages({ kind, focus, world, allow });

    let lastError = 'no attempt made';
    for (let attempt = 1; attempt <= 2; attempt++) { // one retry, then human (§9.1)
        let content;
        try {
            content = await chat({ ...chatOpts(aiConfig), messages });
        } catch (e) {
            lastError = `${e.code || 'ERROR'}: ${String(e.message || e).slice(0, 160)}`;
            continue;
        }
        const result = parseWorldAnswer(content, allow);
        if (result.ok) {
            await worldAudit(log, campaign, result.proposal, attempt);
            return { ok: true, proposal: result.proposal, mode: aiConfig.mode };
        }
        lastError = `invalid proposal: ${result.errors.join('; ')}`;
    }
    const proposal = { kind: 'needs_human', text: `AI world keeper unavailable — the GM supplies this. (${String(lastError).slice(0, 160)})` };
    await worldAudit(log, campaign, proposal, 0);
    return { ok: false, code: 'AI_NEEDS_HUMAN', proposal };
}

async function worldAudit(log, campaign, proposal, attempts) {
    if (typeof log !== 'function') return;
    try {
        await log(campaign, {
            type: 'ai_world',
            name: 'AI world keeper',
            proposal,
            attempts,
            description: `AI world keeper proposed ${proposal.kind}: ${String(proposal.text || proposal.name || '').slice(0, 220)}`,
        });
    } catch (e) {
        console.error('[aiService:world-audit]', e);
    }
}

async function directorAudit(log, campaign, intent, attempts) {    if (typeof log !== 'function') return;
    try {
        await log(campaign, {
            type: 'ai_director',
            name: 'AI director',
            characterName: intent.creatureName,
            intent,
            attempts,
            description: `AI director proposed ${intent.intent}${intent.actionName ? `: ${intent.actionName}` : ''}${intent.targetName ? ` → ${intent.targetName}` : ''}${intent.intent === 'move' ? ` (${intent.feet} ft.)` : ''}${intent.explanation ? ` — ${intent.explanation}` : ''}`.slice(0, 300),
        });
    } catch (e) {
        console.error('[aiService:director-audit]', e);
    }
}

async function auditLog(log, campaign, characterName, ruling, attempts) {    if (typeof log !== 'function') return;
    try {
        await log(campaign, {
            type: 'ai_ruling',
            name: 'AI referee',
            characterName: characterName || null,
            ruling,
            attempts,
            description: `AI referee proposed ${ruling.type}: ${String(ruling.text || ruling.expression || ruling.actionName || ruling.effect || '').slice(0, 160)}${ruling.explanation ? ` — ${ruling.explanation}` : ''}`.slice(0, 300),
        });
    } catch (e) {
        console.error('[aiService:audit-log]', e);
    }
}

export { probe, isLocalEndpoint };
