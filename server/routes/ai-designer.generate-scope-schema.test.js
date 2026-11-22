// @maintained-by-ai
// bug-designer-generate-malformed-scope-500 — the generate route takes a
// CLIENT-supplied scope, so it must run the SAME ENTITY_SCHEMAS.scope gate
// the plan lane runs on model output BEFORE any model call, audit row or
// design-notes write (the refine preflight / map-erasure-guard doctrine:
// refuse first, name every offender, zero side effects). A malformed-but-
// object scope (entityPlan as an object instead of the canonical array) used
// to sail past, burn the batch call, write the fallback ai_designer row, then
// crash the resume with a generic 500 + a design-notes lastError.
// Unlike ai-designer.test.js (service fully mocked), this file rides the REAL
// designer.js with only its peripherals stubbed, so the schema gate itself is
// under test.
import express from 'express';
import { vi } from 'vitest';
import { request } from '../test-utils/localhostSupertest.js';

vi.mock('../services/ai/index.js', () => ({ aiConfigLive: (c) => !!(c && c.mode && c.mode !== 'off') }));
const chat = vi.fn(async () => { throw Object.assign(new Error('local model endpoint unreachable'), { code: 'AI_UNAVAILABLE' }); });
vi.mock('../services/ai/providers/localProvider.js', () => ({ chat: (...a) => chat(...a), isLocalEndpoint: () => true }));
const loadNotes = vi.fn(() => ({ messages: [], plans: [], pendingPlan: null, lastError: null }));
const savePendingPlan = vi.fn((c, scope) => ({ pendingPlan: scope ? { ...scope, savedAt: 1 } : null }));
const setDesignerError = vi.fn();
vi.mock('../services/ai/authoring/designNotes.js', () => ({
    loadNotes: (...a) => loadNotes(...a),
    appendMessages: vi.fn(),
    recordPlan: vi.fn(),
    clearNotes: vi.fn(),
    savePendingPlan: (...a) => savePendingPlan(...a),
    setDesignerError: (...a) => setDesignerError(...a),
}));
vi.mock('../services/ai/authoring/storyBible.js', () => ({
    buildStoryBible: vi.fn(() => ({
        party: [], partyLevels: { min: 1, max: 1, size: 0 },
        quests: { active: [], completed: [], failed: [] },
        factions: [], npcs: [], settlements: [], sessions: [], encounters: [], maps: [], recentLog: [],
    })),
    monsterMenu: vi.fn(() => []),
}));
const applyBlueprint = vi.fn();
vi.mock('../services/ai/authoring/apply.js', () => ({
    applyBlueprint: (...a) => applyBlueprint(...a),
    collectBlueprintErrors: vi.fn(() => []),
}));
const addEntry = vi.fn();
vi.mock('./log.js', () => ({ addEntry: (...a) => addEntry(...a) }));

const store = new Map();
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    characterChangeData: { get: (c) => store.get(c) },
}));

import aiDesigner from './ai-designer.js';

const app = express();
app.use(express.json());
app.use(aiDesigner);

const GENERATE = '/api/campaigns/test-campaign/ai/designer/generate';
const post = (scope) => request(app).post(GENERATE).set('Host', 'localhost').send({ scope });

beforeEach(() => {
    store.set('test-campaign', { aiConfig: { mode: 'suggest', endpoint: 'http://localhost:9/v1', model: 'x', provider: 'openai' } });
    chat.mockClear();
    addEntry.mockClear();
    savePendingPlan.mockClear();
    setDesignerError.mockClear();
    applyBlueprint.mockClear();
});

describe('generate refuses malformed client scopes with an honest 400 — zero side effects', () => {
    it('object-shaped entityPlan → 400 naming the offender, no model call, no audit row, no design-notes write', async () => {
        const res = await post({ scope: 'bespoke', entityPlan: { npc: 1 }, levelRange: { min: 1, max: 2 } });
        expect(res.status).toBe(400);
        // Grammatical copy pinned verbatim (schema-400 article grammar backlog:
        // the old body read `must be a array`).
        expect(res.body.error).toBe('Build plan rejected: $.entityPlan must be of type array');
        expect(chat).not.toHaveBeenCalled(); // refused before the batch leg
        expect(addEntry).not.toHaveBeenCalled(); // no ai_designer audit row
        expect(applyBlueprint).not.toHaveBeenCalled();
        expect(setDesignerError).not.toHaveBeenCalled(); // design-notes lastError untouched
        expect(savePendingPlan).not.toHaveBeenCalled(); // stored pending plan untouched
    });

    it('names EVERY offender in one 400 (erasure-guard law), each with grammatical type copy', async () => {
        const res = await post({ entityPlan: [{ kind: 'bogus', count: 'two' }], bogusField: true });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('scope'); // required field named
        expect(res.body.error).toContain('entityPlan[0]'); // row kind + count named
        expect(res.body.error).toContain('$.entityPlan[0].count must be of type integer'); // string-instead-of-integer copy
        expect(res.body.error).toContain('bogusField'); // unknown field named
        expect(res.body.error).not.toMatch(/must be a[n]? (array|integer|object|string|number|boolean|null)\b/);
        expect(chat).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('the rehydrated pending plan’s server stamps (savedAt/proposedAt) still pass the gate', async () => {
        // Reload-then-regenerate POSTs design-notes' stamped plan back — the
        // strip must run BEFORE the schema (additionalProperties:false), or
        // every legitimate regenerate would self-reject with a 400.
        const res = await post({ scope: 'arc', entityPlan: [{ kind: 'npc', count: 1 }], savedAt: 123, proposedAt: 456 });
        expect(res.status).toBe(200); // reached the model lane, failed honestly there
        expect(chat).toHaveBeenCalled();
        expect(res.body.error || '').not.toContain('Build plan rejected');
    });

    it('a VALID array-shaped scope passes the gate and reaches the model lane', async () => {
        const res = await post({ scope: 'bespoke', entityPlan: [{ kind: 'npc', count: 1 }], levelRange: { min: 1, max: 2 } });
        // The dead-endpoint fail-closed face (playbook §48): honest 200-shaped
        // model failure with the fallback audit row — NOT a 400.
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(false);
        expect(chat).toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalled();
    });
});
