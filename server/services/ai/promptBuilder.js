/**
 * Level 5 Phase 3 (L5-004, plan §9.1/§9.2) — prompt builders.
 *
 * One place where every AI role's system prompt lives. The referee prompt
 * encodes the non-negotiable contract: the model PROPOSES engine operations,
 * it never rolls dice, never writes state, and must answer in schema JSON.
 */

import { validateRuling } from './schemas.js';

// Compact the shared runtime state into a small context block — token budget
// discipline (§16 "persistence of AI context"): capped lists, scalar fields
// only, no character secrets, no full stat blocks.
function compactEconomy(ts) {
    if (!ts) return null;
    return {
        actionsUsed: ts.actionsUsed ?? 0,
        bonusActionsUsed: ts.bonusActionsUsed ?? 0,
        reactionsUsed: ts.reactionsUsed ?? 0,
        movementUsedFeet: ts.movementUsedFeet ?? 0,
    };
}

function compactCreature(c, turnState) {
    return {
        name: c.name,
        type: c.type || null,
        ac: c.ac ?? null,
        hp: c.currentHp ?? c.hp ?? null,
        maxHp: c.maxHp ?? null,
        conditions: Array.isArray(c.conditions) ? c.conditions.slice(0, 8) : [],
        alive: (c.currentHp ?? c.hp ?? 1) > 0 && !c.isDead,
        targetName: c.targetName || null,
        economy: compactEconomy(turnState[c.name]),
    };
}

export function compactContext(state = {}) {
    const cs = state.combatSummary || {};
    const turnState = state.turnState || {};
    const enforcement = state.enforcement;
    return {
        round: cs.round ?? null,
        activeCreature: cs.activeCreatureName ?? state.activeCreatureName ?? null,
        enforcement: enforcement ? { mode: enforcement.mode } : null,
        enforcementFlags: enforcement
            ? Object.entries(enforcement).filter(([k, v]) => k !== 'mode' && v === true).map(([k]) => k)
            : [],
        creatures: (Array.isArray(cs.creatures) ? cs.creatures.slice(0, 30) : []).map((c) => compactCreature(c, turnState)),
    };
}

const REFEREE_SYSTEM = `You are the rules referee for a D&D (5e/2024) campaign running inside a turn-based virtual table. A player has described what their character does; you propose a ruling.

NON-NEGOTIABLE RULES:
1. You NEVER state dice results. When dice are needed, propose a dice EXPRESSION (e.g. "1d20+5", "2d6+3") and the engine rolls it. Advantage/disadvantage is expressed via "mode".
2. You NEVER invent damage numbers without the dice that produce them.
3. Respect the enforcement flags and action economy in the context: a creature whose actions are spent cannot take another Action; movementUsedFeet vs speed bounds movement; turn-lock means only the active creature acts on its turn.
4. If the intent is unclear or needs a human judgment call, propose a needs_human ruling (type "needs_human") — do not guess.
5. Answer with ONE JSON object and nothing else, matching exactly one of:
   {"type":"dice","expression":"1d20+7","mode":"normal","targetName":"...","explanation":"...","confidence":0.9}
   {"type":"automation","actionName":"Attack with Longsword","targetName":"Goblin","explanation":"...","confidence":0.9}
   {"type":"target_effect","effect":"snake_case_key","targetName":"...","explanation":"...","confidence":0.8}
   {"type":"hp_change","targetName":"...","amount":-7,"explanation":"...","confidence":0.8}
   {"type":"narrative","text":"...","explanation":"...","confidence":0.9}
Keep "explanation" short (one sentence). "confidence" is 0..1.`;

/**
 * Build the chat messages for a referee ruling request.
 * @param {{ action: string, characterName: string, state: object }} args
 */
export function buildRefereeMessages({ action, characterName, state }) {
    const user = [
        `CAMPAIGN STATE (compact JSON):\n${JSON.stringify(compactContext(state))}`,
        characterName ? `ACTING CHARACTER: ${characterName}` : null,
        `PLAYER'S ACTION (freeform): ${String(action || '').slice(0, 2000)}`,
    ].filter(Boolean).join('\n\n');
    return [
        { role: 'system', content: REFEREE_SYSTEM },
        { role: 'user', content: user },
    ];
}

/**
 * Parse + validate the model's answer. Tolerates fenced code blocks and
 * surrounding prose (small local models love a ```json fence) but NEVER
 * repairs field values — anything malformed fails validation outright.
 */
export function parseRulingAnswer(content) {
    if (typeof content !== 'string') return { ok: false, errors: ['empty answer'] };
    let text = content.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart === -1 || braceEnd <= braceStart) return { ok: false, errors: ['no JSON object in answer'] };
    let parsed;
    try {
        parsed = JSON.parse(text.slice(braceStart, braceEnd + 1));
    } catch (e) {
        return { ok: false, errors: [`invalid JSON: ${e.message}`] };
    }
    const result = validateRuling(parsed);
    return result.ok ? { ok: true, ruling: parsed } : { ok: false, errors: result.errors };
}
