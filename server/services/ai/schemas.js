/**
 * Level 5 Phase 3 (L5-004, plan §9) — AI output schemas.
 *
 * Principle 3 / §9.5: the AI is a PROPOSER, never a state-writer. Every
 * model response must validate against one of these ruling shapes before it
 * touches anything — invalid output fails closed to a `needs_human` fallback,
 * it is never "repaired" by guessing.
 *
 * Ruling types map 1:1 onto engine operations the app already has:
 *  - 'dice'          → an expression for the ENGINE to roll (serverDice oracle
 *                      §7.4, or client dice when off). The AI never rolls.
 *  - 'automation'    → an existing named action to run through the existing
 *                      automation lanes (charged via assertCanAct in P3-b).
 *  - 'target_effect' → a targetEffect key for targetEffectDefinitions.js.
 *  - 'hp_change'     → a signed HP delta the engine applies (confirm-gated).
 *  - 'narrative'     → prose outcome logged for the table; mutates nothing.
 * 'needs_human' is engine-produced only (AI unavailable / invalid output).
 */

const DICE_MODES = new Set(['normal', 'advantage', 'disadvantage']);
const EXPR_RE = /^\d*d\d+([+-]\d+)?$/i; // same grammar as campaigns-roll.js
const KEY_RE = /^[a-z0-9_]+$/;

const MAX_TEXT = 2000;      // narrative prose cap
const MAX_REASON = 200;
const MAX_HP_MAGNITUDE = 200; // sanity bound, not a rule

function str(v) { return typeof v === 'string'; }
function trimmedNonEmpty(v) { return str(v) && v.trim() !== ''; }

/**
 * Validate one ruling object. Returns { ok, errors:[...] } — errors are
 * joined into the referee-facing reason when invalid. Type-specific field
 * checks live in a table (one row per ruling type), the shape sanity in the
 * dispatcher — so adding a ruling type never grows the dispatcher.
 */
const TYPE_CHECKS = {
    narrative: (r, e) => textField(r, e, 'text'),
    needs_human: (r, e) => textField(r, e, 'text'),
    dice: (r, e) => {
        if (!str(r.expression) || !EXPR_RE.test(r.expression.trim())) {
            e.push("dice ruling requires a valid expression 'NdM(+K)' — the engine rolls, the AI never states a result");
        }
        if (r.mode !== undefined && !DICE_MODES.has(r.mode)) e.push("dice.mode must be 'normal'|'advantage'|'disadvantage'");
    },
    automation: (r, e) => {
        if (!trimmedNonEmpty(r.actionName)) e.push('automation ruling requires actionName');
        if (r.targetName !== undefined && !trimmedNonEmpty(r.targetName)) e.push('automation.targetName must be non-empty when present');
    },
    target_effect: (r, e) => {
        if (!str(r.effect) || !KEY_RE.test(r.effect)) e.push('target_effect.effect must be a snake_case key from targetEffectDefinitions.js');
        if (!trimmedNonEmpty(r.targetName)) e.push('target_effect requires targetName');
    },
    hp_change: (r, e) => {
        if (!Number.isInteger(r.amount) || r.amount === 0 || Math.abs(r.amount) > MAX_HP_MAGNITUDE) {
            e.push(`hp_change.amount must be a non-zero integer within ±${MAX_HP_MAGNITUDE}`);
        }
        if (!trimmedNonEmpty(r.targetName)) e.push('hp_change requires targetName');
    },
};

function textField(r, errors, field) {
    if (!trimmedNonEmpty(r[field])) errors.push(`${field} required and non-empty`);
    else if (r[field].length > MAX_TEXT) errors.push(`${field} must be ≤${MAX_TEXT} chars`);
}

export function validateRuling(ruling) {
    const errors = [];
    if (!ruling || typeof ruling !== 'object' || Array.isArray(ruling)) {
        return { ok: false, errors: ['ruling must be an object'] };
    }
    const check = TYPE_CHECKS[ruling.type];
    if (!check) return { ok: false, errors: [`unknown ruling type: ${JSON.stringify(ruling.type)}`] };
    if (trimmedNonEmpty(ruling.explanation) && ruling.explanation.length > MAX_REASON) {
        errors.push(`explanation must be ≤${MAX_REASON} chars`);
    }
    if (ruling.confidence !== undefined && !(typeof ruling.confidence === 'number' && Number.isFinite(ruling.confidence) && ruling.confidence >= 0 && ruling.confidence <= 1)) {
        errors.push('confidence must be a number 0..1 when present');
    }
    check(ruling, errors);
    return { ok: errors.length === 0, errors };
}

/** Engine-side fail-closed fallback (never model-proposed). */
export function needsHumanRuling(reason) {
    return {
        type: 'needs_human',
        text: `AI referee unavailable — the referee adjudicates this turn. (${String(reason || 'no reason given').slice(0, MAX_REASON)})`,
    };
}

/**
 * §9.3 NPC-director intents. The allowlist (real stat-block action names,
 * live target names, speed) is the CONTRACT — anything off-list is invalid,
 * never "repaired". Matching is case-insensitive but the canonical spelling
 * from the allowlist is stamped back onto the intent, so downstream lanes
 * always see the exact name the rules data uses.
 */
const INTENT_TYPES = new Set(['attack', 'cast', 'utility', 'move', 'talk', 'pass']);

function matchAllowed(name, list) {
    if (!trimmedNonEmpty(name)) return null;
    const lower = String(name).trim().toLowerCase();
    return (list || []).find(item => String(item).toLowerCase() === lower) || null;
}

function attackFields(intent, allow, errors) {
    const action = matchAllowed(intent.actionName, allow.actionNames);
    if (!action) errors.push(`actionName must be one of this monster's actions: ${(allow.actionNames || []).join(', ') || '(none)'}`);
    else intent.actionName = action;
    const target = matchAllowed(intent.targetName, allow.targetNames);
    if (!target) errors.push(`targetName must be a living target in the context: ${(allow.targetNames || []).join(', ') || '(none)'}`);
    else intent.targetName = target;
}

const INTENT_CHECKS = {
    attack: attackFields,
    cast: attackFields,
    utility: (intent, allow, errors) => {
        const action = matchAllowed(intent.actionName, allow.actionNames);
        if (!action) errors.push(`utility actionName must be one of this monster's actions: ${(allow.actionNames || []).join(', ') || '(none)'}`);
        else intent.actionName = action;
        if (intent.targetName !== undefined) {
            if (!trimmedNonEmpty(intent.targetName)) errors.push('utility.targetName must be non-empty when present');
            // Utilities may target objects/self — canonicalize when it matches
            // a known combatant, pass other names through untouched.
            else intent.targetName = matchAllowed(intent.targetName, allow.targetNames) || intent.targetName.trim();
        }
    },
    move: (intent, allow, errors) => {
        const speed = typeof allow.speedFeet === 'number' ? allow.speedFeet : null;
        if (!Number.isInteger(intent.feet) || intent.feet < 1) errors.push('move.feet must be a positive integer');
        else if (speed !== null && intent.feet > speed) errors.push(`move.feet ${intent.feet} exceeds speed ${speed} ft.`);
    },
    talk: (intent, allow, errors) => textField(intent, errors, 'text'),
    pass: () => {},
};

export function validateNpcIntent(intent, allow = {}) {
    if (!intent || typeof intent !== 'object' || Array.isArray(intent)) {
        return { ok: false, errors: ['intent must be an object'] };
    }
    if (!INTENT_TYPES.has(intent.intent)) {
        return { ok: false, errors: [`unknown intent: ${JSON.stringify(intent.intent)} — must be attack|cast|utility|move|talk|pass`] };
    }
    if (Array.isArray(allow.allowedIntents) && !allow.allowedIntents.includes(intent.intent)) {
        return { ok: false, errors: [`intent '${intent.intent}' is not permitted right now (economy spent?) — allowed: ${allow.allowedIntents.join(', ')}`] };
    }
    const errors = [];
    if (trimmedNonEmpty(intent.explanation) && intent.explanation.length > MAX_REASON) errors.push(`explanation must be ≤${MAX_REASON} chars`);
    if (intent.confidence !== undefined && !(typeof intent.confidence === 'number' && Number.isFinite(intent.confidence) && intent.confidence >= 0 && intent.confidence <= 1)) {
        errors.push('confidence must be a number 0..1 when present');
    }
    INTENT_CHECKS[intent.intent](intent, allow, errors);
    return { ok: errors.length === 0, errors };
}

/**
 * §9.4 world-keeper proposals. The model GENERATES content only — and any
 * entity it references (NPC, settlement) must be REAL in this campaign's
 * ledger; fabricated campaign entities fail closed. Confirmed payloads then
 * ride the normal lanes: narrative → log, quest_draft → quests CRUD.
 */
const WORLD_KINDS = new Set(['recap', 'rumor', 'npc_dialogue', 'quest_draft', 'event', 'needs_human']);

const WORLD_CHECKS = {
    recap: (p, allow, errors) => textField(p, errors, 'text'),
    event: (p, allow, errors) => textField(p, errors, 'text'),
    rumor: (p, allow, errors) => {
        textField(p, errors, 'text');
        if (p.settlement !== undefined) {
            const s = matchAllowed(p.settlement, allow.settlementNames);
            if (!s) errors.push(`rumor.settlement must be an existing settlement: ${(allow.settlementNames || []).join(', ') || '(none)'}`);
            else p.settlement = s;
        }
    },
    npc_dialogue: (p, allow, errors) => {
        const npc = matchAllowed(p.npcName, allow.npcNames);
        if (!npc) errors.push(`npc_dialogue.npcName must be an NPC on file: ${(allow.npcNames || []).join(', ') || '(none)'}`);
        else p.npcName = npc;
        textField(p, errors, 'text');
    },
    quest_draft: (p, allow, errors) => {
        if (!trimmedNonEmpty(p.name) || p.name.length > 120) errors.push('quest_draft.name required, ≤120 chars');
        textField(p, errors, 'description');
        if (p.rewards !== undefined && !str(p.rewards)) errors.push('quest_draft.rewards must be a string when present');
    },
    needs_human: (p, allow, errors) => textField(p, errors, 'text'),
};

export function validateWorldProposal(proposal, allow = {}) {
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
        return { ok: false, errors: ['proposal must be an object'] };
    }
    if (!WORLD_KINDS.has(proposal.kind)) {
        return { ok: false, errors: [`unknown kind: ${JSON.stringify(proposal.kind)} — must be recap|rumor|npc_dialogue|quest_draft|event`] };
    }
    const errors = [];
    if (proposal.confidence !== undefined && !(typeof proposal.confidence === 'number' && Number.isFinite(proposal.confidence) && proposal.confidence >= 0 && proposal.confidence <= 1)) {
        errors.push('confidence must be a number 0..1 when present');
    }
    WORLD_CHECKS[proposal.kind](proposal, allow, errors);
    return { ok: errors.length === 0, errors };
}
