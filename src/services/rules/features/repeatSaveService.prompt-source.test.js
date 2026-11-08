// @maintained-by-ai
// Backlog 2026-11-08 EL: repeat-save prompt provenance chrome. The turn-END
// repeat-save PC prompt must carry `sourceName` (the te row's `source` +
// effect label) so SavePromptModal's existing `.sp-source` "Source:" row
// renders — the same payload channel Shield Bash riders use
// (createSaveListener → buildPromptPayload → current.sourceName). This file
// pins only the dispatch config composition; prompt mechanics/queue lanes are
// owned by savePrompt/SavePromptModal tests, the strip/log ledger by
// repeatSaveService.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const CAMPAIGN = 'test-campaign';
const PC = 'ElderPaladin';

const store = {};
const prompts = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((owner, key) => store[`${owner}.${key}`]),
    setRuntimeValue: vi.fn((owner, key, value) => { store[`${owner}.${key}`] = value; }),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [{ name: PC, type: 'player' }] })),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn((campaignName, cfg) => {
        prompts.push(cfg);
        // Fail so the lane keeps the te and the test asserts nothing else.
        return { promise: Promise.resolve({ roll: 1, saveBonus: 0, success: false }) };
    }),
}));

import { applyRepeatSaveTurnEnd } from './repeatSaveService.js';

function poisonTe(over = {}) {
    return {
        target: PC,
        effect: 'poisoned_cloud',
        source: 'Green Dragon 1',
        dc: 15,
        saveType: 'CON',
        repeatSave: { saveType: 'CON', dc: 15, condition: 'poisoned' },
        ...over,
    };
}

beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    prompts.length = 0;
    store['campaign.targetEffects'] = [];
    store[`${PC}.activeConditions`] = ['poisoned'];
});

describe('repeat-save prompt sourceName — te.source + effect provenance', () => {
    it('source differs from effect: "source — effect" em-dash pair', async () => {
        store['campaign.targetEffects'] = [poisonTe()];

        await applyRepeatSaveTurnEnd(CAMPAIGN, PC);

        expect(prompts).toHaveLength(1);
        expect(prompts[0].sourceName).toBe('Green Dragon 1 — poisoned_cloud');
        // Existing provenance fields stay byte-identical alongside it.
        expect(prompts[0]).toMatchObject({
            attackerName: 'Green Dragon 1',
            condition: 'poisoned_cloud (repeat save)',
            suppressOutcomeLog: true,
        });
    });

    it('source IS the effect name (Shield-Bash-style row): deduped to one label, never "X — X"', async () => {
        store['campaign.targetEffects'] = [poisonTe({ source: 'poisoned_cloud' })];

        await applyRepeatSaveTurnEnd(CAMPAIGN, PC);

        expect(prompts[0].sourceName).toBe('poisoned_cloud');
    });

    it('source-less te row: effect label alone still renders the Source row', async () => {
        store['campaign.targetEffects'] = [poisonTe({ source: null })];

        await applyRepeatSaveTurnEnd(CAMPAIGN, PC);

        expect(prompts[0].sourceName).toBe('poisoned_cloud');
    });
});
