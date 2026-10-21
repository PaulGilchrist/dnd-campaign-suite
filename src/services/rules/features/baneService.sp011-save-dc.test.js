// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// SP-011 lane: the ONLY bane lane that runs applyBaneEffect against the REAL
// buildSaveDc (baneService.test.js mocks it; runner lanes mock applyBaneEffect).
// This is where the composed caster DC is produced for Bane targets.

vi.mock('../../../services/automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../../services/automation/common/savePrompt.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        createSaveListener: vi.fn(() => ({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'sp011-prompt',
        })),
    };
});

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { applyBaneEffect } from './baneService.js';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN = 'TestCampaign';

// Divine_Cleric lv17 Life (test-campaign): WIS 16 (+3), PB +6 → spell save DC 17.
// Falsifying swaps all miss 17: buildSaveDc's old default would give 10, a
// CHA-sourced DC would give 8 + 6 + 0 = 14. App data dc_type CHA is the SAVE
// ability the targets roll, not the caster's DC source.
const CLERIC = {
    name: 'Divine_Cleric',
    level: 17,
    proficiency: 6,
    spellAbilities: { modifier: 3, saveDc: 17 },
    abilities: [
        { name: 'Wisdom', bonus: 3 },
        { name: 'Charisma', bonus: 0 },
    ],
    computedStats: { saveBonuses: { CHA: 0 } },
};

const BANE_SP = { name: 'Bane', level: 1, casting_time: 'Action', range: '30 feet' };
const TARGETS = ['Bandit 1', 'Bandit 2', 'Bandit 3'];

describe('SP-011 applyBaneEffect — real buildSaveDc lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'sp011-prompt',
        });
    });

    it('lv1 caster DC 17 flows to every prompt, log, and targetEffect — never the DC 10 default', async () => {
        await applyBaneEffect(BANE_SP, CLERIC, CAMPAIGN, null, TARGETS);

        const configs = createSaveListener.mock.calls.map(c => c[1]);
        expect(configs.length).toBe(3);
        for (const cfg of configs) {
            expect(cfg.saveDc).toBe(17);
            expect(cfg.saveType).toBe('CHA');
            expect(cfg.dcSuccess).toBe('none');
        }

        // 3 per-target cast entries (carry promptId) + 1 summary entry
        const castLogs = addEntry.mock.calls.filter(c => c[1]?.type === 'spell' && c[1]?.promptId);
        expect(castLogs.length).toBe(3);
        expect(castLogs[0][1].description).toContain('DC 17');
        expect(castLogs.map(c => c[1].spellLevel)).toEqual([1, 1, 1]);

        const saves = addEntry.mock.calls.filter(c => c[1]?.type === 'save_result');
        expect(saves.length).toBe(3);
        expect(saves[0][1].saveDc).toBe(17);

        // How Bane applies to targets: one concentration penalty per failed target.
        const teWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
        expect(teWrites.length).toBe(3);
        expect(teWrites.map(c => c[2][0].target)).toEqual(TARGETS);
        for (const write of teWrites) {
            expect(write[2][0]).toEqual(expect.objectContaining({
                effect: 'bane_penalty',
                source: 'Divine_Cleric',
                slotLevel: 1,
                duration: 'concentration',
            }));
        }
    });

    it('an explicit numeric automation.saveDc wins over the spell_save_dc token', async () => {
        // Discriminates the auto merge order: flipping { saveDc: token, ...automation }
        // would resolve 17 here instead of 19.
        await applyBaneEffect({ ...BANE_SP, automation: { type: 'bane', saveDc: 19 } }, CLERIC, CAMPAIGN, null, ['Bandit 1']);
        expect(createSaveListener.mock.calls[0][1].saveDc).toBe(19);
    });

    it('paid lv2 wrapper (runner stampPaidSlotLevel seam) stamps te slotLevel:2 and logs spellLevel:2', async () => {
        // useSimpleSpellHandlers forwards the paid level as wrapper.level
        // (stampPaidSlotLevel / CLA-086); the base lv1 number lives on the
        // nested spell object, which applyBaneEffect must not read.
        await applyBaneEffect({ name: 'Bane', spell: BANE_SP, level: 2, casting_time: 'Action' }, CLERIC, CAMPAIGN, null, ['Bandit 1']);

        const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
        expect(teWrite[2][0]).toEqual(expect.objectContaining({
            target: 'Bandit 1',
            effect: 'bane_penalty',
            source: 'Divine_Cleric',
            slotLevel: 2,
            duration: 'concentration',
        }));

        const castLog = addEntry.mock.calls.find(c => c[1]?.type === 'spell' && c[1]?.targetName);
        expect(castLog[1].spellLevel).toBe(2);
    });
});
