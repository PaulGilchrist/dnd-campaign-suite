// @maintained-by-ai
// Campaign-authoring Phase 4 — designer orchestration with a scripted model:
// whole-blueprint emit, repair retry, truncation→per-entity RESUME, and the
// fail-closed refusals. IO deps (conversation store, story bible, apply) are
// stubbed so this is a pure funnel test against a fake model function.
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
    collectBlueprintErrors: vi.fn(() => []), // funnel test supplies its own verdicts below where needed
}));

import { designChat, proposePlan, generateBlueprint } from './designer.js';
import { appendMessages, recordPlan } from './designNotes.js';
import { collectBlueprintErrors } from './apply.js';

const AI = { mode: 'autopilot', endpoint: 'http://localhost:1234/v1', model: 'm' };
const log = vi.fn();
beforeEach(() => { log.mockClear(); applyBlueprint.mockReset(); appendMessages.mockClear(); recordPlan.mockClear(); collectBlueprintErrors.mockReset().mockReturnValue([]); });

describe('designChat', () => {
    it('sends the message + persists the thread', async () => {
        const chatFn = vi.fn(async () => 'Tell me about your villain.');
        const res = await designChat({ campaign: 'c', message: 'I want a cult', aiConfig: AI, chatFn, log });
        expect(res).toMatchObject({ ok: true, reply: 'Tell me about your villain.' });
        expect(appendMessages).toHaveBeenCalledWith('c', { role: 'gm', content: 'I want a cult' }, { role: 'ai', content: 'Tell me about your villain.' });
    });
    it('AI_OFF when config is off; refuses empty messages', async () => {
        expect((await designChat({ campaign: 'c', message: 'x', aiConfig: { mode: 'off' }, chatFn: vi.fn(), log })).code).toBe('AI_OFF');
        expect((await designChat({ campaign: 'c', message: '  ', aiConfig: AI, chatFn: vi.fn(), log })).code).toBe('NO_MESSAGE');
    });
});

describe('proposePlan', () => {
    it('parses + records a scope plan', async () => {
        const scope = { scope: 'session', sessionNumber: 4, entityPlan: [{ kind: 'encounter', count: 1 }] };
        const chatFn = vi.fn(async () => JSON.stringify(scope));
        const res = await proposePlan({ campaign: 'c', aiConfig: AI, chatFn, log });
        expect(res).toMatchObject({ ok: true, scope });
        expect(recordPlan).toHaveBeenCalledWith('c', scope, { storySummary: undefined });
    });
    it('retries once on invalid JSON, then needs-human', async () => {
        const chatFn = vi.fn(async () => 'not json');
        const res = await proposePlan({ campaign: 'c', aiConfig: AI, chatFn, log });
        expect(chatFn).toHaveBeenCalledTimes(2);
        expect(res.ok).toBe(false);
        expect(res.code).toBe('AI_NEEDS_HUMAN');
    });
});

describe('generateBlueprint — whole-set path', () => {
    const scope = { scope: 'arc', levelRange: { min: 6, max: 8 } };
    it('emits, validates, applies once the set is clean', async () => {
        const blueprint = { scope, npcs: [{ name: 'V' }], factions: [], quests: [], settlements: [], sessions: [], encounters: [], mapPlans: [] };
        const chatFn = vi.fn(async () => JSON.stringify(blueprint));
        applyBlueprint.mockResolvedValue({ ok: true, created: { npcs: 1 }, snapshot: 's.zip', pendingMaps: 0, errors: [] });
        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        expect(collectBlueprintErrors).toHaveBeenCalledWith('c', expect.objectContaining({ scope }));
        expect(applyBlueprint).toHaveBeenCalledWith('c', expect.objectContaining({ npcs: [{ name: 'V' }] }), expect.anything());
    });

    it('feeds validation errors back for a repair retry (attempt 2 succeeds)', async () => {
        const good = { scope, npcs: [], factions: [], quests: [], settlements: [], sessions: [], encounters: [], mapPlans: [] };
        let n = 0;
        const chatFn = vi.fn(async () => {
            n += 1;
            // attempt 1 invalid (collectBlueprintErrors says no), attempt 2 clean
            collectBlueprintErrors.mockReturnValueOnce(n === 1 ? ['npcs[0] bad name'] : []);
            return n === 1 ? JSON.stringify({ scope, npcs: [{ name: 123 }] }) : JSON.stringify(good);
        });
        applyBlueprint.mockResolvedValue({ ok: true, created: {}, snapshot: 's.zip', pendingMaps: 0, errors: [] });
        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        // The repair attempt's messages include the GM-visible error copy.
        const secondCall = chatFn.mock.calls[1][0];
        const repairUser = secondCall.messages[secondCall.messages.length - 1];
        expect(repairUser.role).toBe('user');
        expect(repairUser.content).toMatch(/bad name/);
    });
});

describe('generateBlueprint — stage:generate audit shape', () => {
    const scope = { scope: 'arc', levelRange: { min: 1, max: 3 } };
    const blueprint = { scope, npcs: [], factions: [], quests: [], settlements: [], sessions: [], encounters: [], mapPlans: [] };

    const generateAudit = () => log.mock.calls
        .map(([, entry]) => entry)
        .find(e => e.type === 'ai_designer' && e.stage === 'generate');

    it('persists rejection reasons (capped at 5) when applyBlueprint rejects', async () => {
        const chatFn = vi.fn(async () => JSON.stringify(blueprint));
        const rejectionErrors = [
            'encounters[0] "Ambush": unknown bestiary index "monster-index-1"',
            'npcs[0] "Cultist": shadow-name collision',
            'quests[0] "Rite": unknown faction reference',
            'settlements[0] "Villa": unknown map reference',
            'sessions[0] "Finale": unknown quest reference',
            'sixth error must be truncated away',
        ];
        applyBlueprint.mockResolvedValue({ ok: false, errors: rejectionErrors, created: {}, snapshot: null });
        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(false);
        const entry = generateAudit();
        expect(entry).toBeTruthy();
        expect(entry.created).toEqual({});
        expect(entry.errors).toEqual(rejectionErrors.slice(0, 5));
        expect(entry.errors).toHaveLength(5);
    });

    it('keeps the success-path payload byte-clean (no errors key)', async () => {
        const chatFn = vi.fn(async () => JSON.stringify(blueprint));
        applyBlueprint.mockResolvedValue({ ok: true, errors: [], created: { npcs: 1 }, snapshot: 's.zip' });
        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        const entry = generateAudit();
        expect(entry).toBeTruthy();
        expect('errors' in entry).toBe(false);
        expect(Object.keys(entry).sort()).toEqual(['attempts', 'created', 'name', 'snapshot', 'stage', 'type']);
    });
});

describe('generateBlueprint — truncation → per-entity resume', () => {
    const scope = { scope: 'session', sessionNumber: 4, entityPlan: [{ kind: 'faction', count: 2 }], storySummary: 'x' };
    it('resumes entity-by-entity when the whole-set emit fails twice', async () => {
        let wholeSetCalls = 0;
        const chatFn = vi.fn(async () => {
            wholeSetCalls += 1;
            if (wholeSetCalls <= 2) { wholeSetAttempts.push(collectBlueprintErrors()); return 'garbage-not-json'; }
            return JSON.stringify({ name: `F${perEntity++}` });
        });
        const wholeSetAttempts = [];
        let perEntity = 0;
        collectBlueprintErrors.mockImplementation(() => ['blueprint was truncated']);
        applyBlueprint.mockResolvedValue({ ok: true, created: { factions: 2 }, snapshot: 's.zip', pendingMaps: 0, errors: [] });

        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        // Two faction rows generated one at a time, then applied as one draft set.
        const [campaignArg, bp] = applyBlueprint.mock.calls[0];
        expect(campaignArg).toBe('c');
        expect(bp.factions).toEqual([{ name: 'F0' }, { name: 'F1' }]);
    });

    it('honest failure if a single entity keeps failing validation', async () => {
        const chatFn = vi.fn(async () => 'still not json');
        collectBlueprintErrors.mockImplementation(() => ['truncated']);
        // entity validation genuinely fails (no apply call expected)
        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(false);
        expect(res.code).toBe('AI_NEEDS_HUMAN');
        expect(applyBlueprint).not.toHaveBeenCalled();
    });
});
