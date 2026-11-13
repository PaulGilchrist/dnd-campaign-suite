// @maintained-by-ai
// Backlog 2026-11-13 XA — every ai_designer audit row must carry a plain-English
// `description` (the ai_dress f91276b39 pattern) that honestly matches the row's
// stage AND outcome, so the Log view renders it verbatim instead of the derived
// describer fallback. Same stubbed-funnel shape as designer.test.js.
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
    monsterMenu: vi.fn(() => [{ index: 'goblin', name: 'Goblin', cr: 0.25 }]),
}));
const applyBlueprint = vi.fn();
vi.mock('./apply.js', () => ({
    applyBlueprint: (...a) => applyBlueprint(...a),
    collectBlueprintErrors: vi.fn(() => []),
}));

import { designChat, proposePlan, generateBlueprint } from './designer.js';
import { collectBlueprintErrors } from './apply.js';

const AI = { mode: 'autopilot', endpoint: 'http://localhost:1234/v1', model: 'm' };
const log = vi.fn();
beforeEach(() => { log.mockClear(); applyBlueprint.mockReset(); collectBlueprintErrors.mockReset().mockReturnValue([]); });

const auditRows = () => log.mock.calls.map(([, entry]) => entry).filter(e => e.type === 'ai_designer');

describe('designer audit descriptions (ai_dress pattern)', () => {
    it('chat writes no audit row at all (nothing to stamp)', async () => {
        const chatFn = vi.fn(async () => 'Tell me about your villain.');
        const res = await designChat({ campaign: 'c', message: 'I want a cult', aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        expect(log).not.toHaveBeenCalled();
    });

    it('plan success names the scope and the planned entity count', async () => {
        const scope = { scope: 'session', sessionNumber: 4, entityPlan: [{ kind: 'encounter', count: 1 }, { kind: 'npc', count: 2 }] };
        const chatFn = vi.fn(async () => JSON.stringify(scope));
        const res = await proposePlan({ campaign: 'c', aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        expect(auditRows()[0].description)
            .toBe('AI designer proposed a build plan (scope "session", 3 entities)');
    });

    it('plan-validation failure names the error', async () => {
        const chatFn = vi.fn(async () => 'not json');
        const res = await proposePlan({ campaign: 'c', aiConfig: AI, chatFn, log });
        expect(res.code).toBe('AI_NEEDS_HUMAN');
        const row = auditRows()[0];
        expect(row.stage).toBe('plan');
        expect(row.attempts).toBe(0);
        expect(row.description)
            .toBe('AI designer plan failed — plan was not valid JSON');
    });

    it('batch generate success names the drafted entity count and restore point', async () => {
        const scope = { scope: 'arc', levelRange: { min: 1, max: 3 } };
        const blueprint = { scope, npcs: [{ name: 'V' }], factions: [], quests: [], settlements: [], sessions: [], encounters: [], mapPlans: [] };
        const chatFn = vi.fn(async () => JSON.stringify(blueprint));
        applyBlueprint.mockResolvedValue({ ok: true, created: { npcs: 1 }, snapshot: 's.zip', errors: [] });
        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        const row = auditRows().find(e => e.stage === 'generate' && !e.fallback);
        expect(row.attempts).toBe(1);
        expect(row.description).toBe('AI designer drafted 1 entity (restore point s.zip)');
    });

    it('mid-batch apply failure with a restore point names the snapshot, never “wrote nothing”', async () => {
        const scope = { scope: 'arc', levelRange: { min: 1, max: 3 } };
        const blueprint = { scope, npcs: [], factions: [], quests: [], settlements: [], sessions: [], encounters: [], mapPlans: [] };
        const chatFn = vi.fn(async () => JSON.stringify(blueprint));
        applyBlueprint.mockResolvedValue({
            ok: false,
            errors: ['apply failed mid-batch: disk on fire — restore point: s.zip'],
            created: {}, snapshot: 's.zip',
        });
        await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        const row = auditRows().find(e => e.stage === 'generate' && !e.fallback);
        expect(row.description).toBe(
            'AI designer generate stopped (restore point s.zip) — apply failed mid-batch: disk on fire — restore point: s.zip');
    });

    it('truncation fallback leg stamps a description naming the per-entity resume and the error', async () => {
        const scope = { scope: 'session', sessionNumber: 4, entityPlan: [{ kind: 'faction', count: 1 }] };
        const chatFn = vi.fn(async (cfg) => {
            if (cfg.schemaName === 'campaign_blueprint') return 'garbage-not-json';
            return JSON.stringify({ name: 'F0' });
        });
        applyBlueprint.mockResolvedValue({ ok: true, created: { factions: 1 }, snapshot: 's.zip', errors: [] });
        await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        const fallback = auditRows().find(e => e.fallback);
        expect(fallback.description).toBe(
            'AI designer generate fell back to per-entity resume — blueprint was not valid JSON (likely truncated output)');
    });

    it('full-success resume says entities were drafted via per-entity resume', async () => {
        const scope = {
            scope: 'arc', levelRange: { min: 3, max: 5 },
            entityPlan: [{ kind: 'faction', count: 1 }, { kind: 'quest', count: 1 }],
        };
        const chatFn = vi.fn(async (cfg) => {
            if (cfg.schemaName === 'campaign_blueprint') return 'garbage-not-json';
            return JSON.stringify({ name: `E-${cfg.schemaName}` });
        });
        applyBlueprint.mockResolvedValue({ ok: true, created: { factions: 1, quests: 1 }, snapshot: 's.zip', errors: [] });
        await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        const success = auditRows().find(e => e.stage === 'generate' && !e.fallback);
        expect(success.resumed).toBe(true);
        expect(success.description).toBe('AI designer drafted 2 entities via per-entity resume (restore point s.zip)');
    });

    it('mid-resume partial stop names drafted/planned counts and the stop error', async () => {
        const scope = {
            scope: 'arc', levelRange: { min: 3, max: 5 },
            entityPlan: [{ kind: 'faction', count: 1 }, { kind: 'quest', count: 1 }],
        };
        const chatFn = vi.fn(async (cfg) => {
            if (cfg.schemaName === 'campaign_blueprint') return 'garbage-not-json';
            if (cfg.schemaName === 'draft_faction') return JSON.stringify({ name: 'The Salvage Court' });
            return 'still not json';
        });
        applyBlueprint.mockResolvedValue({ ok: true, created: { factions: 1, maps: 0 }, snapshot: 's.zip', errors: [] });
        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.partial).toEqual({ drafted: 1, planned: 2 });
        const row = auditRows().find(e => e.stage === 'generate-resume');
        expect(row.description).toBe(
            'AI designer drafted 1 of 2 entities before stopping — generation stopped at quest #1/1 — model output kept failing validation');
    });

    it('zero-success stop and subset-integrity failure both say nothing was written and name the error', async () => {
        const scope = {
            scope: 'arc', levelRange: { min: 3, max: 5 },
            entityPlan: [{ kind: 'faction', count: 1 }, { kind: 'quest', count: 1 }],
        };
        // Zero-success stop: the very first entity keeps failing validation.
        const deadChat = vi.fn(async (cfg) => (cfg.schemaName === 'campaign_blueprint' ? 'garbage-not-json' : 'still not json'));
        await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn: deadChat, log });
        expect(auditRows().find(e => e.stage === 'generate-resume').description).toBe(
            'AI designer generate-resume stopped — wrote nothing — generation stopped at faction #1/1 — model output kept failing validation');

        // Subset-failure leg: the faction drafts fine but the completed subset
        // itself fails whole-set integrity — nothing written, snapshot null.
        log.mockClear();
        const subsetChat = vi.fn(async (cfg) => {
            if (cfg.schemaName === 'campaign_blueprint') return 'garbage-not-json';
            if (cfg.schemaName === 'draft_faction') return JSON.stringify({ name: 'The Salvage Court' });
            return 'still not json';
        });
        applyBlueprint.mockResolvedValue({
            ok: false, errors: ['quests cannot be audited — but nothing was written'],
            created: {}, snapshot: null,
        });
        await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn: subsetChat, log });
        expect(auditRows().find(e => e.stage === 'generate-resume').description).toContain('wrote nothing');
    });

    it('every ai_designer row shape carries a non-empty description', async () => {
        // Sweep every leg one more time and assert the invariant broadly.
        const scope = {
            scope: 'one_shot', levelRange: { min: 1, max: 2 },
            entityPlan: [{ kind: 'faction', count: 1 }],
        };
        const chatFn = vi.fn(async (cfg) => {
            if (cfg.schemaName === 'campaign_blueprint') return 'garbage-not-json';
            return JSON.stringify({ name: 'F0' });
        });
        applyBlueprint.mockResolvedValue({ ok: true, created: { factions: 1 }, snapshot: 's.zip', errors: [] });
        await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        await proposePlan({ campaign: 'c', aiConfig: AI, chatFn: vi.fn(async () => 'not json'), log });
        const rows = auditRows();
        expect(rows.length).toBeGreaterThanOrEqual(3); // fallback + generate-success + plan-failure
        for (const row of rows) {
            expect(typeof row.description).toBe('string');
            expect(row.description.trim().length).toBeGreaterThan(0);
        }
    });
});
