/**
 * Level 5 Phase 3 (L5-004, plan §9.1/§9.2) — prompt builders.
 *
 * One place where every AI role's system prompt lives. The referee prompt
 * encodes the non-negotiable contract: the model PROPOSES engine operations,
 * it never rolls dice, never writes state, and must answer in schema JSON.
 */

import { validateRuling, validateNpcIntent, validateWorldProposal } from './schemas.js';

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

const DIRECTOR_SYSTEM = `You are the NPC director for a D&D (5e/2024) turn-based combat. It is one monster's turn; choose what it does.

NON-NEGOTIABLE RULES:
1. Pick ONLY from the ALLOWED ACTIONS list you are given — never invent actions, attacks, spells or items the monster does not have.
2. You NEVER state results (no "the attack hits", no damage numbers). You only pick an intent; the engine rolls and resolves.
3. Pick ONLY living targets from the TARGETS list for attacks. Prefer tactically sensible targets per the monster's combat style.
4. Respect the ECONOMY block: if actions are spent, propose move/talk/pass only.
5. Movement must be a whole number of feet within the monster's speed.
6. Answer with ONE JSON object and nothing else, exactly one of:
   {"intent":"attack","actionName":"Scimitar","targetName":"Rakan","explanation":"...","confidence":0.9}
   {"intent":"cast","actionName":"Fire Bolt","targetName":"...","explanation":"...","confidence":0.8}
   {"intent":"utility","actionName":"Hide","targetName":"optional","explanation":"...","confidence":0.7}
   {"intent":"move","feet":30,"direction":"toward the nearest target","explanation":"...","confidence":0.8}
   {"intent":"talk","text":"short barks in Goblin","explanation":"...","confidence":0.6}
   {"intent":"pass","explanation":"...","confidence":0.5}
Keep "explanation" short (one sentence). "confidence" is 0..1.`;

/**
 * Build chat messages for an NPC-turn director request.
 * @param {{ creatureName: string, monster: object, targets: Array, self: object, economy: object, allowedIntents: Array|null, round: number|null }} args
 */
export function buildDirectorMessages({ creatureName, monster, targets, self, economy, allowedIntents, round }) {
    const user = [
        `MONSTER (its turn): ${creatureName}`,
        `SPEED: ${monster.speedFeet ?? 'unknown'} ft.`,
        `ALLOWED ACTIONS (exact names — pick only from this list):\n${JSON.stringify(monster.actions.map(a => ({ name: a.name, attack_bonus: a.attack_bonus, description: a.description.slice(0, 140) })))}`,
        `TARGETS (living):\n${JSON.stringify(targets)}`,
        `YOUR STATE: ${JSON.stringify(self)}`,
        `ECONOMY: ${JSON.stringify(economy)}`,
        allowedIntents ? `ALLOWED INTENTS RIGHT NOW: ${allowedIntents.join(', ')}` : null,
        `ROUND: ${round ?? '?'}`,
    ].filter(Boolean).join('\n\n');
    return [
        { role: 'system', content: DIRECTOR_SYSTEM },
        { role: 'user', content: user },
    ];
}

/**
 * Extract the first balanced-ish JSON object from a model answer. Tolerates * fenced code blocks and surrounding prose (small local models love a
 * ```json fence) but NEVER repairs field values.
 */
export function extractJsonObject(content) {
    if (typeof content !== 'string') return { ok: false, errors: ['empty answer'] };
    let text = content.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart === -1 || braceEnd <= braceStart) return { ok: false, errors: ['no JSON object in answer'] };
    try {
        return { ok: true, value: JSON.parse(text.slice(braceStart, braceEnd + 1)) };
    } catch (e) {
        return { ok: false, errors: [`invalid JSON: ${e.message}`] };
    }
}

export function parseRulingAnswer(content) {
    const extracted = extractJsonObject(content);
    if (!extracted.ok) return extracted;
    const result = validateRuling(extracted.value);
    return result.ok ? { ok: true, ruling: extracted.value } : { ok: false, errors: result.errors };
}

/** §9.3 — parse + allowlist-validate an NPC-director intent. */
export function parseIntentAnswer(content, allow) {
    const extracted = extractJsonObject(content);
    if (!extracted.ok) return extracted;
    const result = validateNpcIntent(extracted.value, allow);
    return result.ok ? { ok: true, intent: extracted.value } : { ok: false, errors: result.errors };
}

const WORLD_SYSTEM = `You are the world keeper for a D&D (5e/2024) campaign — continuity, atmosphere, consequences. You GENERATE content; a human referee confirms it and normal system lanes write it.

NON-NEGOTIABLE RULES:
1. Be consistent with the campaign ledger in the context — never contradict quest statuses, faction goals, NPC alignments or established events.
2. Only reference NPCs and settlements that EXIST in the ledger (exact names). Never invent campaign entities, quest IDs, or mechanical results.
3. You NEVER roll dice and never state mechanical outcomes ("the quest is now complete") — you PROPOSE content; the referee decides.
4. Recap = past tense, grounded ONLY in the recent log/notes. Rumor = in-world gossip with a hook. Event = a downtime beat with a hook. Dialogue = in-voice lines for the named NPC (personality/alignment from the ledger).
5. Answer with ONE JSON object and nothing else, matching the requested kind:
   {"kind":"recap","text":"...","confidence":0.9}
   {"kind":"event","text":"...","confidence":0.8}
   {"kind":"rumor","text":"...","settlement":"OptionalKeep","confidence":0.7}
   {"kind":"npc_dialogue","npcName":"ExactNpcName","text":"...","tone":"gruff","confidence":0.8}
   {"kind":"quest_draft","name":"...","description":"...","rewards":"...","confidence":0.7}
Keep "text" ≤ 1200 characters.`;

/**
 * Build chat messages for a world-keeper request.
 * @param {{ kind: string, focus: string|null, world: object, allow: object }} args
 */
export function buildWorldMessages({ kind, focus, world, allow }) {
    const focusLine = focus ? `FOCUS (referee's steer): ${String(focus).slice(0, 400)}` : null;
    const user = [
        `REQUESTED KIND: ${kind}`,
        focusLine,
        `CAMPAIGN LEDGER (ground every claim in this):\n${JSON.stringify(world)}`,
        `EXISTING NAMES you may reference: NPCs ${JSON.stringify(allow.npcNames)}; settlements ${JSON.stringify(allow.settlementNames)}; factions ${JSON.stringify(allow.factionNames)}; quests ${JSON.stringify(allow.questNames)}`,
        kind === 'quest_draft' ? 'The draft goes to the quest ledger unchanged — make it actionable.' : null,
    ].filter(Boolean).join('\n\n');
    return [
        { role: 'system', content: WORLD_SYSTEM },
        { role: 'user', content: user },
    ];
}

/** §9.4 — parse + validate a world-keeper proposal. */
export function parseWorldAnswer(content, allow) {
    const extracted = extractJsonObject(content);
    if (!extracted.ok) return extracted;
    const result = validateWorldProposal(extracted.value, allow);
    return result.ok ? { ok: true, proposal: extracted.value } : { ok: false, errors: result.errors };
}
