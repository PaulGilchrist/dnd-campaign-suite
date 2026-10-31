/**
 * AI Campaign Authoring (plan Phase 4) — designer prompt builders.
 *
 * Three voices, one funnel: CHAT (collaborate; prose only, never writes),
 * PLAN (solidify the conversation into a schema-shaped scope the GM can
 * edit/confirm), BUILD (emit the whole interlinked blueprint in one
 * generation — the owner ruling is a single model holding the whole story;
 * per-entity rescue in designer.js only fires when output truncates).
 *
 * Fail-closed contract mirrored from the referee prompts: the model may only
 * cite names/monster-indexes from the embedded allowlists, never invents
 * server-owned fields, and everything it emits is DRAFT-PENDING-GM-APPROVAL —
 * the prompt says so, because a model that believes it is final tends to
 * write final-sounding content the GM rubber-stamps.
 */

const json = (v) => JSON.stringify(v);

const DESIGNER_SYSTEM = `You are an expert D&D campaign designer collaborating with the Game Master (GM) who runs this app.

Rules:
- Converse in plain prose. NEVER output JSON or code blocks in chat; a separate "propose build plan" step produces the structured plan.
- Draw on the STORY BIBLE (current canon) and any prior design intent. Continue existing threads; never contradict approved canon.
- Scope comes from the GM: a whole campaign, a one-shot, an arc for specific levels ("continue 6-10"), or prep for the next session. Ask what is missing (tone, themes, tier, session count, what the party should feel).
- You create NOTHING that reaches players: every entity you eventually generate lands as a DRAFT the GM must approve. Say so if the GM asks you to "make" something.
- Keep replies focused (under ~250 words). Ask at most 2-3 questions per reply.`;

const PLAN_SYSTEM = `You turn a GM design conversation into a BUILD PLAN. Output ONLY a single JSON object, nothing else:

{
  "scope": "campaign" | "one_shot" | "arc" | "session" | "bespoke",
  "levelRange": { "min": 1-20, "max": 1-20 },        // omit for one_shot/session
  "sessionNumber": 1+,                                // session scope only
  "storySummary": "the campaign/arc spine in <=400 words — this is the story bible every later entity must honor",
  "entityPlan": [ { "kind": "faction|npc|settlement|quest|encounter|session|mapPlan", "count": 0+, "notes": "what these are for" } ]
}

Counts must be proportional to scope (a session prep ≠ 40 entities) and consistent with storySummary. Reference only existing canon from the STORY BIBLE; the plan describes NEW content alongside it.`;

/**
 * Anti-placeholder naming guidance (backlog 2026-10-31 AP: a quest landed
 * literally named "quest" — the shape word `quest{...}` leaked into `name`).
 * Owner ruling: SOFT prompt fix only — validators untouched. One shared
 * fragment injected at all three schema-bearing seams (blueprint batch,
 * per-entity resume, refine via refine.js), so wherever a shape is embedded
 * the model also sees a discriminating example and an explicit prohibition.
 */
export const NAME_EXAMPLES = {
    faction: 'The Ember Guild',
    npc: 'Marta Copperkettle',
    settlement: 'Thornhaven',
    quest: 'The Sunken Chime',
    encounter: 'Ambush at Wolf Hollow',
    session: 'Session 3: The Sunken Chime',
    mapPlan: 'fungal-hollows / Fungal Hollows',
};

/** Whole-roster line (batch) or targeted one-liner (resume/refine, per kind). */
export function namingRule(kind) {
    if (kind) {
        return `Name it with a proper, unique in-world name like "${NAME_EXAMPLES[kind]}" — NEVER "${kind}" or the kind word, and NEVER a placeholder ("placeholder", "example", "test", "TBD", "Untitled", "New ${kind}").`;
    }
    const pairs = Object.entries(NAME_EXAMPLES).map(([k, v]) => `${k} "${v}"`).join(', ');
    return `EVERY name must be a proper, unique in-world name (e.g. ${pairs}) — NEVER name an entity after its kind ("quest", "npc", "faction", "settlement", "encounter", "session", "mapPlan") and NEVER a placeholder ("placeholder", "example", "test", "TBD", "Untitled").`;
}

// Field-shape one-liners per kind (rule text mirrors entitySchemas.js).
export const KIND_FIELD_RULES = {
    faction: 'faction{name,description,goals,influence 1-10,notes}',
    npc: 'npc{name,race,classRole,appearance,personality,goals,secrets,notes,tags,attitude one of deep bonds|positive|neutral|negative|extreme opposition,(optional) stat block}',
    settlement: 'settlement{name,size village|town|city|metropolis,description,atmosphere,government,population,services[],notableNPCs[],rumors[],tags,notes,threat}',
    quest: 'quest{name,status active|completed|failed,description,rewards,notes}',
    encounter: 'encounter{name,description,selectedMonsters:[{index,name,qty}]}',
    session: 'session{name,date,summary,notes,contingencies[],links{maps[],encounters[],npcs[],quests[],settlements[],notes[]}}',
    mapPlan: 'mapPlan{name kebab-case,displayName,generator hex|dungeon,params{gridSize,density,seed},dressing{pois[],placedItemOps[],tokens[]}}',
};

function blueprintRules({ scope, allow }) {
    return `Build the COMPLETE blueprint now: one JSON object, nothing else.

{
  "scope": ${json(scope)},
  "factions": [...], "settlements": [...], "npcs": [...],
  "quests": [...], "encounters": [...], "sessions": [...], "mapPlans": [...]
}

Hard rules — violating any one makes the whole batch fail validation:
1. EVERY name must be unique in the batch AND not collide with existing names: ${json(allow.existingNames)}. ${namingRule()}
2. encounter.selectedMonsters entries: {"index","name","qty"} using ONLY this bestiary menu (index+name verbatim): ${json(allow.monsters)}.
3. settlement.notableNPCs and session.links values must name existing campaign rows OR rows you create in this same blueprint.
4. No "id", "updatedAt", "savedAt" or "draft" fields — the server assigns those.
5. Every kind's fields follow its shape: ${Object.values(KIND_FIELD_RULES).join('; ')}.
6. Coherence is the point: quests hook factions and NPCs, settlements anchor places, encounters carry the threats, sessions wire the night's prep together (mapPlans where a new site is worth having). Honor the storySummary and the target levels (${json(scope.levelRange || 'tier implied by party')}); balance encounter CR totals to the party (${json(allow.party)}).
7. Write EVERY entity in entityPlan, fully. If you are running long, trim prose — never drop entities or fields.

This content is DRAFT-PENDING-GM-APPROVAL; make it rich enough to review.`;
}

export function buildDesignMessages({ storyBible, history, message }) {
    return [
        { role: 'system', content: `${DESIGNER_SYSTEM}\n\nSTORY BIBLE (approved canon):\n${json(storyBible)}` },
        ...history.slice(-40).map(m => ({ role: m.role === 'gm' ? 'user' : 'assistant', content: m.content })),
        { role: 'user', content: message },
    ];
}

export function buildPlanMessages({ storyBible, history }) {
    return [
        { role: 'system', content: `${PLAN_SYSTEM}\n\nSTORY BIBLE:\n${json(storyBible)}` },
        ...history.slice(-40).map(m => ({ role: m.role === 'gm' ? 'user' : 'assistant', content: m.content })),
        { role: 'user', content: 'Propose the build plan for what we have discussed. JSON object only.' },
    ];
}

export function buildBlueprintMessages({ storyBible, scope, monsterMenu, existingNames, history }) {
    const allow = { monsters: monsterMenu, existingNames, party: storyBible.party };
    return [
        { role: 'system', content: `${blueprintRules({ scope, allow })}\n\nSTORY BIBLE:\n${json(storyBible)}` },
        ...history.slice(-20).map(m => ({ role: m.role === 'gm' ? 'user' : 'assistant', content: m.content })),
        { role: 'user', content: 'Emit the complete blueprint JSON now.' },
    ];
}

export function buildRepairMessages(messages, badAnswer, errors) {
    return [
        ...messages,
        { role: 'assistant', content: badAnswer },
        { role: 'user', content: `That JSON failed validation:\n- ${errors.slice(0, 12).join('\n- ')}\nFix every error and output ONLY the corrected JSON object.` },
    ];
}

/**
 * Rescue lane (output truncation recovery): regenerate ONE entity. The full
 * story bible AND the siblings already produced stay in context, so this is
 * continuation, not piecemeal design — the narrative spine never fragments.
 */
export function buildSingleEntityMessages({ scope, kind, planNotes, siblings, allow, fieldRule }) {
    return [
        {
            role: 'system',
            content: `Emit exactly ONE ${kind} as a single JSON object — nothing else.
Shape: ${fieldRule}
${namingRule(kind)}
Hard rules: no id/updatedAt/savedAt/draft fields; names must not collide with ${json(allow.existingNames)}; monster refs use ONLY index+name from ${json(allow.monsters)}.
Story spine: ${json(scope.storySummary || scope)}
Party: ${json(allow.party)}
Already drafted in this batch (tie into them, do not duplicate them): ${json(siblings)}`,
        },
        { role: 'user', content: `Create this entity now${planNotes ? `: ${planNotes}` : '.'}` },
    ];
}
