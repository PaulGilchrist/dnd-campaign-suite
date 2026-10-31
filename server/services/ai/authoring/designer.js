/**
 * AI Campaign Authoring (plan Phase 4) — the designer orchestrator.
 *
 * Same funnel as referee/director/world-keeper (build messages → chat →
 * parse+validate → bounded retry → honest failure), plus the owner-ruling
 * generation model: the WHOLE blueprint is emitted in ONE schema-constrained
 * call against the full story bible (a single model holds the whole narrative);
 * if the response truncates or fails twice, generation RESUMES entity-by-entity
 * with the same story bible plus already-produced siblings in context —
 * truncation recovery, not piecemeal design.
 *
 * Writes only ever happen through applyBlueprint (drafts, snapshot, SSE,
 * log). Chat/plan generate no campaign rows at all. Conversation persists to
 * design-notes.json in the campaign folder (owner ruling: travels with
 * snapshots/downloads).
 */
import { chat } from '../providers/localProvider.js';
import { aiConfigLive } from '../index.js';
import { extractJsonObject } from '../promptBuilder.js';
import { buildStoryBible, monsterMenu } from './storyBible.js';
import { loadNotes, appendMessages, recordPlan } from './designNotes.js';
import {
    buildDesignMessages, buildPlanMessages, buildBlueprintMessages,
    buildRepairMessages, buildSingleEntityMessages, KIND_FIELD_RULES,
} from './designerPrompts.js';
import { validateEntity, resolveSchemaRefs, ENTITY_SCHEMAS } from './entitySchemas.js';
import { validateAgainstSchema } from './schemaValidator.js';
import { applyBlueprint, collectBlueprintErrors } from './apply.js';

const chatOpts = (cfg) => ({ endpoint: cfg.endpoint, model: cfg.model, temperature: cfg.temperature, provider: cfg.provider, timeoutMs: cfg.timeoutMs, jsonSchema: cfg.jsonSchema });

// Maps scope.plan kind → blueprint list key + apply lane singular.
const PLAN_KIND = {
    faction: 'factions', npc: 'npcs', settlement: 'settlements', quest: 'quests',
    encounter: 'encounters', session: 'sessions', mapPlan: 'mapPlans',
};

/** Existing approved names per kind, for the prompt's collision allowlist. */
function existingNames(bible) {
    return {
        factions: bible.factions.map(f => f.name),
        settlements: bible.settlements.map(s => s.name),
        npcs: bible.npcs.map(n => n.name),
        quests: bible.quests.active.map(q => q.name).concat(bible.quests.completed.map(q => q.name), bible.quests.failed.map(q => q.name)),
        sessions: bible.sessions.map(s => s.name),
        encounters: bible.encounters.map(e => e.name),
        maps: bible.maps,
    };
}

// Constrained decoding fed from the SAME schema objects the validator uses
// (plan residual item 3); on backends that reject response_format the provider
// silently stays on the jsonMode/prompt lane.
const decode = (schemaName, schema) => ({ responseSchema: resolveSchemaRefs(schema), schemaName });

async function callJson(chatFn, opts, messages, decoding) {
    const content = await chatFn({ ...opts, messages, jsonMode: true, ...(decoding || {}) });
    return extractJsonObject(content);
}

/** Multi-turn design conversation. Prose in/out; persists the thread. */
export async function designChat({ campaign, message, aiConfig, chatFn = chat }) {
    if (!aiConfigLive(aiConfig)) return { ok: false, code: 'AI_OFF' };
    if (!message?.trim()) return { ok: false, code: 'NO_MESSAGE' };
    const notes = loadNotes(campaign);
    const bible = buildStoryBible(campaign, { notes });
    const messages = buildDesignMessages({ storyBible: bible, history: notes.messages, message: message.trim() });
    try {
        const reply = await chatFn({ ...chatOpts(aiConfig), messages });
        appendMessages(campaign, { role: 'gm', content: message }, { role: 'ai', content: reply });
        return { ok: true, reply };
    } catch (e) {
        return { ok: false, code: 'AI_UNREACHABLE', error: String(e.message || e).slice(0, 200) };
    }
}

/** Solidify the conversation into an editable/confirmable scope plan. */
export async function proposePlan({ campaign, aiConfig, log, chatFn = chat }) {
    if (!aiConfigLive(aiConfig)) return { ok: false, code: 'AI_OFF' };
    const notes = loadNotes(campaign);
    const bible = buildStoryBible(campaign, { notes });
    const messages = buildPlanMessages({ storyBible: bible, history: notes.messages });

    let lastError = 'no attempt made';
    for (let attempt = 1; attempt <= 2; attempt++) {
        let result;
        try {
            result = await callJson(chatFn, chatOpts(aiConfig), messages, decode('build_plan', ENTITY_SCHEMAS.scope));
        } catch (e) {
            lastError = `${e.code || 'ERROR'}: ${String(e.message || e).slice(0, 160)}`;
            continue;
        }
        if (!result.ok) { lastError = 'plan was not valid JSON'; continue; }
        const shape = validateAgainstSchema(result.value, ENTITY_SCHEMAS.scope, { schemas: ENTITY_SCHEMAS });
        if (shape.ok) {
            recordPlan(campaign, result.value, { storySummary: result.value.storySummary });
            audit(log, campaign, { stage: 'plan', scope: result.value.scope, entityPlan: result.value.entityPlan }, attempt);
            return { ok: true, scope: result.value };
        }
        lastError = `invalid plan: ${shape.errors.join('; ')}`;
    }
    audit(log, campaign, { stage: 'plan', error: lastError }, 0);
    return { ok: false, code: 'AI_NEEDS_HUMAN', error: lastError };
}

/**
 * Execute a confirmed scope: whole-blueprint generation, repair retries, and
 * (on repeated failure) entity-by-entity resume → applyBlueprint as drafts.
 */
export async function generateBlueprint({ campaign, scope, aiConfig, log, chatFn = chat }) {
    if (!aiConfigLive(aiConfig)) return { ok: false, code: 'AI_OFF' };
    if (!scope?.scope) return { ok: false, code: 'BAD_SCOPE' };

    const notes = loadNotes(campaign);
    const bible = buildStoryBible(campaign, { notes });
    const levels = scope.levelRange || bible.partyLevels;
    const menu = monsterMenu({ minCr: Math.max(0, (levels.min || 1) - 2), maxCr: (levels.max || 20) + 2 });
    const allow = { monsters: menu, existingNames: existingNames(bible), party: bible.party };
    const messages = buildBlueprintMessages({ storyBible: bible, scope, monsterMenu: menu, existingNames: allow.existingNames, history: notes.messages });

    let lastErrors = ['no attempt made'];
    let repairMessages = messages;
    for (let attempt = 1; attempt <= 2; attempt++) {
        let content;
        try {
            content = await chatFn({
                ...chatOpts(aiConfig), messages: repairMessages, jsonMode: true,
                ...decode('campaign_blueprint', ENTITY_SCHEMAS.blueprint),
            });
        } catch (e) {
            lastErrors = [`${e.code || 'ERROR'}: ${String(e.message || e).slice(0, 160)}`];
            continue;
        }
        const parsed = extractJsonObject(content);
        if (!parsed.ok) { lastErrors = ['blueprint was not valid JSON (likely truncated output)']; continue; }
        const errors = collectBlueprintErrors(campaign, { ...parsed.value, scope });
        if (errors.length === 0) {
            return finalize(campaign, { ...parsed.value, scope }, log, attempt);
        }
        lastErrors = errors;
        repairMessages = buildRepairMessages(messages, String(content).slice(0, 60000), errors);
    }

    audit(log, campaign, { stage: 'generate', fallback: 'per-entity resume', errors: lastErrors.slice(0, 5) }, 0);
    return resumeEntityGeneration({ campaign, scope, bible, allow, log, chatFn, aiConfig });
}

async function finalize(campaign, blueprint, log, attempt) {
    const applied = await applyBlueprint(campaign, blueprint, { log });
    audit(log, campaign, { stage: 'generate', created: applied.created, snapshot: applied.snapshot, attempts: attempt }, attempt);
    return applied;
}

/** Truncation recovery: emit the scope's entities one at a time, in
 *  dependency order, each anchored to the full story bible + finished siblings. */
async function resumeEntityGeneration({ campaign, scope, bible, allow, log, chatFn, aiConfig }) {
    const blueprint = { scope };
    const ordered = ['faction', 'settlement', 'npc', 'quest', 'encounter', 'session', 'mapPlan'];
    const plan = (scope.entityPlan || []).filter(p => PLAN_KIND[p.kind]);
    for (const kind of ordered) {
        const item = plan.find(p => p.kind === kind);
        const key = PLAN_KIND[kind];
        blueprint[key] = [];
        if (!item || item.count <= 0) continue;
        for (let i = 0; i < item.count; i++) {
            const row = await generateOne({ campaign, scope, bible, allow, kind, item, siblings: blueprint, chatFn, aiConfig });
            if (!row) {
                const errors = [`generation stopped at ${kind} #${i + 1}/${item.count} — model output kept failing validation`];
                audit(log, campaign, { stage: 'generate-resume', errors }, 0);
                return { ok: false, code: 'AI_NEEDS_HUMAN', errors, created: {}, snapshot: null };
            }
            blueprint[key].push(row);
        }
    }
    // Whole-set integrity is re-checked inside applyBlueprint before writing.
    return finalize(campaign, blueprint, log, 0);
}

async function generateOne({ scope, allow, kind, item, siblings, chatFn, aiConfig }) {
    const messages = buildSingleEntityMessages({
        scope, kind, planNotes: item.notes,
        siblings: Object.fromEntries(Object.entries(siblings).filter(([, v]) => v.length)),
        allow, fieldRule: KIND_FIELD_RULES[kind],
    });
    let lastError = 'invalid';
    let lastContent = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        const attemptMessages = attempt === 1 ? messages : [
            ...messages,
            { role: 'assistant', content: String(lastContent).slice(0, 20000) },
            { role: 'user', content: `Invalid: ${lastError}. Output ONLY the corrected ${kind} JSON object.` },
        ];
        let result;
        try {
            result = await callJson(chatFn, chatOpts(aiConfig), attemptMessages, decode(`draft_${kind}`, ENTITY_SCHEMAS[kind]));
        } catch {
            continue;
        }
        if (!result.ok) { lastError = 'not valid JSON'; continue; }
        const res = validateEntity(kind, result.value);
        if (res.ok) return result.value;
        lastError = res.errors.join('; ');
        lastContent = JSON.stringify(result.value);
    }
    return null;
}

function audit(log, campaign, payload, attempts) {
    if (typeof log !== 'function') return;
    log(campaign, { type: 'ai_designer', name: 'AI designer', attempts, ...payload });
}
