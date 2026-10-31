/**
 * AI Campaign Authoring (plan Phase 6) — the per-entity refine funnel.
 *
 * GM clicks the AI button on ONE object (an NPC, a quest…) and types what to
 * change. The model returns the COMPLETE replacement entity — never a patch
 * (whole-object replacement is far more robust across local backends than
 * JSON-patch semantics, and the schema validator catches any drift).
 *
 * Principle 3 holds: the model PROPOSES, the lane APPLIES. This module never
 * writes — the client feeds the replacement into the editor and the NORMAL
 * save lane (with the GM's echoed updatedAt stamp) persists it, so a
 * concurrent edit in another tab still 409s exactly like a human edit would.
 */
import { chat } from '../providers/localProvider.js';
import { aiConfigLive } from '../index.js';
import { extractJsonObject } from '../promptBuilder.js';
import { validateEntity, resolveSchemaRefs, ENTITY_SCHEMAS } from './entitySchemas.js';
import { buildCampaignContext, validateBlueprintReferences } from './referential.js';
import { buildStoryBible } from './storyBible.js';
import { KIND_FIELD_RULES, namingRule } from './designerPrompts.js';

const lower = (v) => String(v || '').trim().toLowerCase();

function buildRefineMessages({ kind, entity, instruction, storyBible }) {
    return [
        {
            role: 'system',
            content: `You revise one D&D campaign entity for the Game Master.
Output ONLY the complete replacement ${kind} as a single JSON object — every field of the shape below, edited per the GM's instruction; untouched fields carried through unchanged.
Shape: ${KIND_FIELD_RULES[kind]}
${namingRule(kind)}
Rules: never add id/updatedAt/savedAt/draft fields; names stay unique campaign-wide; if the entity is a monster-bearing encounter, monster refs use real bestiary index+name pairs.
CAMPAIGN CONTEXT (keep the edit coherent with it): ${JSON.stringify(storyBible)}`,
        },
        { role: 'user', content: `Current ${kind}:\n${JSON.stringify(entity, null, 2)}\n\nGM instruction: ${instruction}` },
    ];
}

/** Everything refusible before a model call — one honest gate, one shape. */
function preflight({ kind, entity, instruction, aiConfig }) {
    if (!aiConfigLive(aiConfig)) return { code: 'AI_OFF' };
    if (!KIND_FIELD_RULES[kind]) return { code: 'BAD_KIND' };
    if (!entity || typeof entity !== 'object') return { code: 'NO_ENTITY' };
    const ask = String(instruction || '').trim().slice(0, 2000);
    if (!ask) return { code: 'NO_INSTRUCTION' };
    // The editor's row carries server-owned fields (stamp/uuid/draft) that the
    // authored-row schema forbids — strip them before validating the INPUT;
    // the replacement is schema-clean by construction.
    const clean = { ...entity };
    for (const f of ['draft', 'updatedAt', 'savedAt', 'id']) delete clean[f];
    const shape = validateEntity(kind, clean);
    if (!shape.ok) return { errors: shape.errors };
    return { ask, clean };
}

/**
 * @param {{ campaign, kind, entity, instruction, aiConfig, log?, chatFn? }} p
 *   entity: the row EXACTLY as the editor loaded it (outward refs resolve
 *   against the campaign; the row's own name collision is waived).
 * @returns {Promise<{ok:true, replacement}|{ok:false, errors|code}>}
 */
export async function refineEntity({ campaign, kind, entity, instruction, aiConfig, log, chatFn = chat }) {
    const ready = preflight({ kind, entity, instruction, aiConfig });
    if (ready.code || ready.errors) return { ok: false, ...(ready.code ? { code: ready.code } : { errors: ready.errors }) };
    const { ask, clean } = ready;

    const bible = buildStoryBible(campaign);
    const messages = buildRefineMessages({ kind, entity: clean, instruction: ask, storyBible: bible });
    // Constrained decoding where the backend takes it — the SAME row schema
    // the validator enforces (server-owned fields are forbidden inside it).
    const decoding = {
        responseSchema: resolveSchemaRefs(ENTITY_SCHEMAS[kind]),
        schemaName: `refine_${kind}`,
        jsonSchema: aiConfig.jsonSchema,
    };

    let lastErrors = ['no attempt made'];
    let repairOf = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        let content;
        try {
            const call = attempt === 1 ? messages : [
                ...messages,
                { role: 'assistant', content: String(repairOf).slice(0, 20000) },
                { role: 'user', content: `That output failed validation:\n- ${lastErrors.join('\n- ')}\nFix every error; output ONLY the corrected ${kind} JSON object.` },
            ];
            content = await chatFn({
                endpoint: aiConfig.endpoint, model: aiConfig.model,
                temperature: aiConfig.temperature, provider: aiConfig.provider,
                timeoutMs: aiConfig.timeoutMs, messages: call, jsonMode: true,
                ...decoding,
            });
        } catch (e) {
            lastErrors = [`${e.code || 'ERROR'}: ${String(e.message || e).slice(0, 160)}`];
            continue;
        }
        const parsed = extractJsonObject(content);
        if (!parsed.ok) { lastErrors = ['model answer was not valid JSON']; continue; }
        const replacement = parsed.value;
        const shape = validateEntity(kind, replacement);
        if (!shape.ok) { lastErrors = shape.errors; repairOf = replacement; continue; }

        const refs = checkOutwardRefs(campaign, kind, entity, replacement);
        if (refs.length) { lastErrors = refs; repairOf = replacement; continue; }

        audit(log, campaign, kind, ask, attempt);
        return { ok: true, replacement };
    }
    audit(log, campaign, kind, ask, 0);
    return { ok: false, errors: lastErrors };
}

/** Outward refs for a single replacement row, waiving collisions with itself. */
function checkOutwardRefs(campaign, kind, current, replacement) {
    const key = { faction: 'factions', npc: 'npcs', settlement: 'settlements', quest: 'quests', encounter: 'encounters', session: 'sessions' }[kind];
    if (!key) return []; // mapPlan has no per-row lane — live dressing is dressMap.js's job (residual item 2)
    const ctx = buildCampaignContext(campaign);
    const bp = { scope: { scope: 'bespoke' }, [key]: [replacement] };
    const res = validateBlueprintReferences(bp, ctx);
    const own = lower(current.name);
    return res.errors.filter(e => !(own && lower(replacement.name) === own && e.includes('collides with an existing')));
}

function audit(log, campaign, kind, instruction, attempts) {
    if (typeof log !== 'function') return;
    log(campaign, { type: 'ai_refine', name: 'AI refine', kind, instruction: instruction.slice(0, 200), attempts });
}
