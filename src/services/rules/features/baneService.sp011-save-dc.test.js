import { describe, it, expect, vi, beforeEach } from 'vitest';

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
// App data dc_type CHA is the SAVE ability, not the caster's DC source.
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

describe('SP-011 applyBaneEffect — real buildSaveDc lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false, roll: 2, total: 2 }),
            promptId: 'sp011-prompt',
        });
    });

    it('resolves prompt/save/log DC to the caster spell save DC 17, never 10', async () => {
        await applyBaneEffect(BANE_SP, CLERIC, CAMPAIGN, null, ['Bandit 1', 'Bandit 2', 'Bandit 3']);

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

        const saves = addEntry.mock.calls.filter(c => c[1]?.type === 'save_result');
        expect(saves.length).toBe(3);
        expect(saves[0][1].saveDc).toBe(17);
    });

    it('an explicit numeric automation.saveDc still wins over the token', async () => {
        await applyBaneEffect({ ...BANE_SP, automation: { type: 'bane', saveDc: 19 } }, CLERIC, CAMPAIGN, null, ['Bandit 1']);
        expect(createSaveListener.mock.calls[0][1].saveDc).toBe(19);
    });

    it('SP-011: paid lv2 stamps te slotLevel:2 and logs spellLevel:2', async () => {
        // Runner seam (useSimpleSpellHandlers applySpell) forwards the paid level as
        // wrapper.level (stampPaidSlotLevel / CLA-086); base lv1 must stay lv1.
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

    it('lv1 cast keeps te slotLevel:1 and spellLevel:1', async () => {
        await applyBaneEffect({ name: 'Bane', spell: BANE_SP, level: 1, casting_time: 'Action' }, CLERIC, CAMPAIGN, null, ['Bandit 1']);

        const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
        expect(teWrite[2][0]).toEqual(expect.objectContaining({ slotLevel: 1 }));

        const castLog = addEntry.mock.calls.find(c => c[1]?.type === 'spell' && c[1]?.targetName);
        expect(castLog[1].spellLevel).toBe(1);
    });
});
