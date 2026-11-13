// @maintained-by-ai
// Backlog YB 2026-11-13 — the full-set batch attempt must honor the GM's EDITED
// plan counts: kinds the plan counted 0 can never trip the unique-name guard
// (and force the per-entity resume fallback + wasted model call) because of
// invented off-plan extras — they are trimmed BEFORE validation and never
// written. Kinds with count > 0 keep the full validation semantics (the guard
// still fires, fallback still possible). Unlike designer.test.js, the REAL
// collectBlueprintErrors (shape + referential guards) runs for genuine — only
// the disk-writing applyBlueprint is stubbed.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../providers/localProvider.js', () => ({ chat: vi.fn(), isLocalEndpoint: () => true }));
vi.mock('../index.js', () => ({ aiConfigLive: (c) => !!(c && c.mode && c.mode !== 'off') }));
vi.mock('./designNotes.js', () => ({
    loadNotes: vi.fn(() => ({ messages: [], plans: [], storySummary: null })),
    appendMessages: vi.fn(),
    recordPlan: vi.fn(),
}));
vi.mock('./storyBible.js', () => ({
    buildStoryBible: vi.fn(() => ({
        party: [{ name: 'Hero', level: 3, class: 'Fighter' }],
        partyLevels: { min: 3, max: 3, size: 1 },
        quests: { active: [], completed: [], failed: [] },
        factions: [], npcs: [], settlements: [], sessions: [], encounters: [], maps: [], recentLog: [],
    })),
    monsterMenu: vi.fn(() => []),
}));
const applyBlueprint = vi.fn();
vi.mock('./apply.js', async (importOriginal) => ({
    ...(await importOriginal()),
    applyBlueprint: (...a) => applyBlueprint(...a),
}));

import { generateBlueprint } from './designer.js';
import { collectBlueprintErrors } from './apply.js';

const AI = { mode: 'autopilot', endpoint: 'http://localhost:1234/v1', model: 'm' };
const log = vi.fn();
// Trimmed reads public/campaigns/<name> read-only (missing files fall back to
// empty sets) — nothing is ever written for it.
const CAMPAIGN = 'no-such-campaign-plan-scope-test';
// The GM trimmed the proposed plan in the editor (the editor always carries a
// row per kind): only factions and quests were zeroed out.
const scope = {
    scope: 'session', sessionNumber: 4, storySummary: 'A fogbound harbour waits.',
    entityPlan: [
        { kind: 'faction', count: 0 }, { kind: 'npc', count: 1 }, { kind: 'settlement', count: 1 },
        { kind: 'quest', count: 0 }, { kind: 'encounter', count: 1 }, { kind: 'session', count: 1 },
        { kind: 'mapPlan', count: 1 },
    ],
};
// The exact misbehavior YB rode: the model invents off-plan canon entities
// alongside the planned NPC — the two factions even share a name, so the real
// batch-duplicate guard fires UNLESS the zero-count lists are trimmed first.
const offPlanEmit = () => ({
    npcs: [{ name: 'Marta Copperkettle' }],
    factions: [{ name: 'The Iron Consortium' }, { name: 'The Iron Consortium' }],
    quests: [{ name: 'The Lost Artifact' }],
});
const batchCalls = (chatFn) => chatFn.mock.calls.filter(([cfg]) => cfg.schemaName === 'campaign_blueprint').length;
const fallbackAudit = () => log.mock.calls.map(([, entry]) => entry)
    .find(e => e.type === 'ai_designer' && e.stage === 'generate' && e.fallback);

beforeEach(() => { log.mockClear(); applyBlueprint.mockReset(); });

describe('evidence: the real guard genuinely rejects off-plan extras', () => {
    it('collectBlueprintErrors fails the UNTRIMMED emit (duplicate off-plan faction names)', () => {
        const errors = collectBlueprintErrors(CAMPAIGN, { scope, ...offPlanEmit() });
        expect(errors.join('\n')).toMatch(/blueprint\.factions: A faction with that name already exists/);
    });
});

describe('generateBlueprint — edited plan trims off-plan zero-count extras', () => {
    it('off-plan extras never reach validation: one batch call, no fallback, nothing persisted', async () => {
        const chatFn = vi.fn(async () => JSON.stringify(offPlanEmit()));
        applyBlueprint.mockResolvedValue({ ok: true, errors: [], created: { npcs: 1 }, snapshot: 's.zip' });

        const res = await generateBlueprint({ campaign: CAMPAIGN, scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        expect(batchCalls(chatFn)).toBe(1); // no repair retry, no resume — the wasted call is gone
        expect(chatFn).toHaveBeenCalledTimes(1);
        expect(fallbackAudit()).toBeUndefined();
        // Zero-count kinds arrive at the write lane empty — the invented rows are NOT persisted.
        const [, bp] = applyBlueprint.mock.calls[0];
        expect(bp.npcs).toEqual([{ name: 'Marta Copperkettle' }]);
        expect(bp.factions).toEqual([]);
        expect(bp.quests).toEqual([]);
        // The success audit stays honest about what was discarded.
        const successAudit = log.mock.calls.map(([, entry]) => entry)
            .find(e => e.type === 'ai_designer' && e.stage === 'generate' && !e.fallback);
        expect(successAudit).toMatchObject({ attempts: 1, dropped: 3 });
    });

    it('the batch prompt forbids the zero-count kinds and demands only planned entities', async () => {
        const chatFn = vi.fn(async () => JSON.stringify(offPlanEmit()));
        applyBlueprint.mockResolvedValue({ ok: true, errors: [], created: { npcs: 1 }, snapshot: 's.zip' });
        await generateBlueprint({ campaign: CAMPAIGN, scope, aiConfig: AI, chatFn, log });
        const system = chatFn.mock.calls[0][0].messages[0].content;
        expect(system).toMatch(/do not propose any factions or quests/i);
        expect(system).toMatch(/ONLY the planned entities/i);
        expect(system).toMatch(/Exactly: 1 npc/i);
    });
});

describe('generateBlueprint — count > 0 kinds keep full validation semantics', () => {
    it('a duplicate among PLANNED npcs still trips the unique-name guard → repair → resume fallback', async () => {
        const plannedScope = { ...scope, entityPlan: [{ kind: 'npc', count: 2 }] };
        let n = 0;
        const chatFn = vi.fn(async (cfg) => {
            if (cfg.schemaName === 'campaign_blueprint') {
                return JSON.stringify({ npcs: [{ name: 'Bram Vance' }, { name: 'Bram Vance' }] });
            }
            n += 1;
            return JSON.stringify({ name: `Planned Npc ${n}` });
        });
        applyBlueprint.mockResolvedValue({ ok: true, errors: [], created: { npcs: 2 }, snapshot: 's.zip' });

        const res = await generateBlueprint({ campaign: CAMPAIGN, scope: plannedScope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        expect(batchCalls(chatFn)).toBe(2); // parsed-but-invalid earns the repair lane
        expect(fallbackAudit()).toMatchObject({ fallback: 'per-entity resume' });
        expect(fallbackAudit().errors.join('\n')).toMatch(/blueprint\.npcs: A npc with that name already exists|already exists/);
        // Planned kind NOT trimmed: both rows ride the resume into the write lane.
        const [, bp] = applyBlueprint.mock.calls[0];
        expect(bp.npcs).toEqual([{ name: 'Planned Npc 1' }, { name: 'Planned Npc 2' }]);
    });
});
