// @maintained-by-ai
// Backlog 2026-11-08 EL: repeat-save prompt provenance chrome. The turn-END
// repeat-save PC prompt must carry `sourceName` (the te row's `source` +
// effect label) so SavePromptModal's existing `.sp-source` "Source:" row
// renders — the same payload channel Shield Bash riders use
// (createSaveListener → buildPromptPayload → current.sourceName). Backlog
// 2026-11-08 EN: the effect half prints the REGISTRY label
// (getEffectDefinition(te.effect).label, matching the paired `condition
// removed` row) with the raw key as fallback. This file pins only the
// dispatch config composition; prompt mechanics/queue lanes are
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

// Backlog 2026-11-08 EN: te.effect keys WITH a registry definition print the
// verbatim registry label (matching the badge and the paired `condition
// removed` row), not the lower-case raw key. thri_kreen_bite_poison →
// 'Poisoned' is the canonical face (label ≠ key).
describe('repeat-save prompt sourceName — registry label face', () => {
    function biteTe(over = {}) {
        return {
            target: PC,
            effect: 'thri_kreen_bite_poison',
            source: 'QA Test Effect',
            dc: 11,
            saveType: 'CON',
            repeatSave: { saveType: 'CON', dc: 11, condition: 'poisoned' },
            ...over,
        };
    }

    it('registered effect key: source — registry label (never the raw key)', async () => {
        store['campaign.targetEffects'] = [biteTe()];

        await applyRepeatSaveTurnEnd(CAMPAIGN, PC);

        expect(prompts[0].sourceName).toBe('QA Test Effect — Poisoned');
        // condition field stays the raw-key gating lane (advantage matchers),
        // only the Source chrome got the label.
        expect(prompts[0].condition).toBe('thri_kreen_bite_poison (repeat save)');
    });

    it('source IS the raw effect key of a registered effect: bare label alone, never "key — label"', async () => {
        store['campaign.targetEffects'] = [biteTe({ source: 'thri_kreen_bite_poison' })];

        await applyRepeatSaveTurnEnd(CAMPAIGN, PC);

        expect(prompts[0].sourceName).toBe('Poisoned');
    });

    it('source IS the registry label: bare label alone, never "Poisoned — Poisoned"', async () => {
        store['campaign.targetEffects'] = [biteTe({ source: 'Poisoned' })];

        await applyRepeatSaveTurnEnd(CAMPAIGN, PC);

        expect(prompts[0].sourceName).toBe('Poisoned');
    });

    it('source-less registered te row: label alone still renders the Source row', async () => {
        store['campaign.targetEffects'] = [biteTe({ source: null })];

        await applyRepeatSaveTurnEnd(CAMPAIGN, PC);

        expect(prompts[0].sourceName).toBe('Poisoned');
    });
});
