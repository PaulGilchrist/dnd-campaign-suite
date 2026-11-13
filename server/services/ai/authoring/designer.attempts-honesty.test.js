// @maintained-by-ai
// Backlog 2026-11-13 YB (ai_designer attempts honesty) — every ai_designer audit
// row's `attempts` equals the model calls ACTUALLY consumed at that point,
// mirroring the sibling law 114009c66 (referee/director/world report consumed
// calls): the `fell back to per-entity resume` row carries the failed batch
// leg's burn, and the final success/failure row after a fallback ride carries
// the cumulative total (batch + resume calls). Pre-loop refusals make zero
// calls, so they emit no audit row at all — never a "0 model calls" lie after
// calls fired, and never an inflated count before any fired.
// Same stubbed-funnel shape as designer.test.js.
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

import { proposePlan, generateBlueprint } from './designer.js';
import { collectBlueprintErrors } from './apply.js';

const AI = { mode: 'autopilot', endpoint: 'http://localhost:1234/v1', model: 'm' };
const log = vi.fn();
beforeEach(() => { log.mockClear(); applyBlueprint.mockReset(); collectBlueprintErrors.mockReset().mockReturnValue([]); });

const rows = () => log.mock.calls.map(([, entry]) => entry).filter(e => e.type === 'ai_designer');
const fallbackRow = () => rows().find(e => e.fallback);
const successRow = () => rows().find(e => e.stage === 'generate' && !e.fallback);
const resumeRow = () => rows().find(e => e.stage === 'generate-resume');

describe('ai_designer attempts honesty — calls actually consumed (114009c66 law)', () => {
    const twoFactions = { scope: 'session', sessionNumber: 4, entityPlan: [{ kind: 'faction', count: 2 }] };

    it('truncation fallback row carries the ONE batch call it rode; resume success carries the cumulative total', async () => {
        let n = 0;
        const chatFn = vi.fn(async (cfg) => (cfg.schemaName === 'campaign_blueprint' ? 'garbage-not-json' : JSON.stringify({ name: `F${n++}` })));
        applyBlueprint.mockResolvedValue({ ok: true, created: { factions: 2 }, snapshot: 's.zip', errors: [] });

        const res = await generateBlueprint({ campaign: 'c', scope: twoFactions, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        expect(chatFn).toHaveBeenCalledTimes(3); // 1 batch + 2 resume calls
        expect(fallbackRow().attempts).toBe(1); // consumed before the fallback — never 0
        expect(successRow()).toMatchObject({ attempts: 3, resumed: true });
    });

    it('thrown batch call still counts as consumed (fail-fast fallback attempts: 1)', async () => {
        const err = Object.assign(new Error('local model endpoint unreachable'), { code: 'AI_UNAVAILABLE' });
        let n = 0;
        const chatFn = vi.fn(async (cfg) => {
            if (cfg.schemaName === 'campaign_blueprint') throw err;
            return JSON.stringify({ name: `F${n++}` });
        });
        applyBlueprint.mockResolvedValue({ ok: true, created: { factions: 2 }, snapshot: 's.zip', errors: [] });

        await generateBlueprint({ campaign: 'c', scope: twoFactions, aiConfig: AI, chatFn, log });
        expect(fallbackRow().attempts).toBe(1); // thrown transport call burned a call
        expect(successRow().attempts).toBe(3);
    });

    it('two-attempt repair lane: fallback row says attempts: 2 (e.g. after two batch attempts)', async () => {
        const scope = { scope: 'arc', levelRange: { min: 1, max: 3 }, entityPlan: [{ kind: 'faction', count: 1 }] };
        collectBlueprintErrors.mockReturnValue(['npcs[0] bad name']); // every batch emit rejected
        const chatFn = vi.fn(async (cfg) => (
            cfg.schemaName === 'campaign_blueprint' ? JSON.stringify({ scope, npcs: [{ name: 123 }] }) : JSON.stringify({ name: 'F0' })
        ));
        applyBlueprint.mockResolvedValue({ ok: true, created: { factions: 1 }, snapshot: 's.zip', errors: [] });

        await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(fallbackRow().attempts).toBe(2); // both batch attempts fired
        expect(successRow().attempts).toBe(3); // 2 batch + 1 resume
    });

    it('mid-resume partial stop row carries batch + every resume call consumed up to the stop', async () => {
        const scope = { scope: 'arc', entityPlan: [{ kind: 'faction', count: 1 }, { kind: 'quest', count: 1 }] };
        const chatFn = vi.fn(async (cfg) => {
            if (cfg.schemaName === 'campaign_blueprint') return 'garbage-not-json'; // 1
            if (cfg.schemaName === 'draft_faction') return JSON.stringify({ name: 'The Salvage Court' }); // 1
            return 'still not json'; // quest burns 2 attempts, then the stop
        });
        applyBlueprint.mockResolvedValue({ ok: true, created: { factions: 1 }, snapshot: 's.zip', errors: [] });

        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.code).toBe('AI_NEEDS_HUMAN');
        expect(fallbackRow().attempts).toBe(1);
        expect(resumeRow()).toMatchObject({ attempts: 4, partial: { drafted: 1, planned: 2 } });
    });

    it('zero-success stop row carries 1 batch + 2 failed entity calls', async () => {
        const scope = { scope: 'arc', entityPlan: [{ kind: 'faction', count: 1 }] };
        const chatFn = vi.fn(async (cfg) => (cfg.schemaName === 'campaign_blueprint' ? 'garbage-not-json' : 'still not json'));

        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.code).toBe('AI_NEEDS_HUMAN');
        expect(fallbackRow().attempts).toBe(1);
        expect(resumeRow().attempts).toBe(3);
        expect(applyBlueprint).not.toHaveBeenCalled();
    });

    it('pre-loop refusals (AI off / BAD_SCOPE / plan AI off) consume zero calls and audit nothing', async () => {
        const chatFn = vi.fn(async () => 'unused');
        expect((await generateBlueprint({ campaign: 'c', scope: twoFactions, aiConfig: { mode: 'off' }, chatFn, log })).code).toBe('AI_OFF');
        expect((await generateBlueprint({ campaign: 'c', scope: null, aiConfig: AI, chatFn, log })).code).toBe('BAD_SCOPE');
        expect((await proposePlan({ campaign: 'c', aiConfig: { mode: 'off' }, chatFn, log })).code).toBe('AI_OFF');
        expect(chatFn).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled(); // pre-loop refusal never audits — nothing to count
    });

    it('clean batch success stays honest at attempts: 1 (one call consumed, no resume)', async () => {
        const scope = { scope: 'arc', levelRange: { min: 1, max: 3 } };
        const chatFn = vi.fn(async () => JSON.stringify({ scope, npcs: [], factions: [], quests: [], settlements: [], sessions: [], encounters: [], mapPlans: [] }));
        applyBlueprint.mockResolvedValue({ ok: true, created: {}, snapshot: 's.zip', errors: [] });

        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        expect(fallbackRow()).toBeUndefined();
        expect(successRow()).toMatchObject({ attempts: 1 });
        expect('resumed' in successRow()).toBe(false);
    });
});
