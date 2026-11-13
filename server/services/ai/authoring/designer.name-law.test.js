// @maintained-by-ai
// Regression (bug-designer-draft-accepts-kind-word-entity-name): the per-entity
// resume lane drafted the harbourmaster NPC literally named "npc" — schema-only
// validation accepted it, so the row landed as an approvable draft. With the
// shared name law inside validateEntity, the SAME lane must (a) feed the model
// a repair turn quoting the law, and (b) honestly stop instead of drafting a
// kind-word row when the model keeps violating it. Same scripted-model rig as
// designer.test.js (providers, notes, bible and apply are stubbed; the funnel
// and the REAL entitySchemas validator run for genuine).
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
vi.mock('./apply.js', () => ({
    applyBlueprint: (...a) => applyBlueprint(...a),
    collectBlueprintErrors: vi.fn(() => []),
}));

import { generateBlueprint } from './designer.js';

const AI = { mode: 'autopilot', endpoint: 'http://localhost:1234/v1', model: 'm' };
const log = vi.fn();
// The bug's exact plan shape: one NPC via per-entity resume (the batch emit
// truncates, which fail-fasts straight into resume).
const scope = {
    scope: 'session', sessionNumber: 1, storySummary: 'A fogbound harbour hides relic smugglers.',
    entityPlan: [{ kind: 'npc', count: 1 }],
};
const resumeOnly = (npcAnswers) => {
    let n = 0;
    return vi.fn(async (cfg) => {
        if (cfg.schemaName === 'campaign_blueprint') return 'garbage-not-json';
        return JSON.stringify(npcAnswers[Math.min(n++, npcAnswers.length - 1)]);
    });
};
beforeEach(() => { log.mockClear(); applyBlueprint.mockReset(); });

describe('generateBlueprint resume — a kind-word name earns the repair turn', () => {
    it('attempt 1 "npc" fails validation and the attempt-2 repair message quotes the name law', async () => {
        const chatFn = resumeOnly([
            { name: 'npc', personality: 'Suspicious harbourmaster' },
            { name: 'Maren tidal-Voss', personality: 'Suspicious harbourmaster' },
        ]);
        applyBlueprint.mockResolvedValue({ ok: true, created: { npcs: 1 }, snapshot: 's.zip', errors: [] });

        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(true);
        const npcCalls = chatFn.mock.calls.filter(([cfg]) => cfg.schemaName === 'draft_npc');
        expect(npcCalls).toHaveLength(2); // the kind-word row was never accepted
        const repairUser = npcCalls[1][0].messages.at(-1);
        expect(repairUser.role).toBe('user');
        expect(repairUser.content).toMatch(/^Invalid: name "npc" is a kind word/);
        expect(repairUser.content).toMatch(/proper, unique in-world name/);
        // Only the repaired row reaches the draft writer.
        const [, bp] = applyBlueprint.mock.calls[0];
        expect(bp.npcs).toEqual([{ name: 'Maren tidal-Voss', personality: 'Suspicious harbourmaster' }]);
    });

    it('a model that keeps violating the law honestly stops — no kind-word draft is ever applied', async () => {
        const chatFn = resumeOnly([{ name: 'npc' }]);

        const res = await generateBlueprint({ campaign: 'c', scope, aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(false);
        expect(res.code).toBe('AI_NEEDS_HUMAN');
        expect(res.errors[0]).toMatch(/generation stopped at npc #1\/1/);
        expect(applyBlueprint).not.toHaveBeenCalled(); // zero drafts: nothing written
        const stopAudit = log.mock.calls.map(([, entry]) => entry)
            .find(e => e.type === 'ai_designer' && e.stage === 'generate-resume');
        expect(stopAudit.errors[0]).toMatch(/stopped at npc #1\/1/);
    });
});
