import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../automation/handlers/spells/shapechangeHandler.js', () => ({
    handle: vi.fn(),
}));
vi.mock('../../../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

import { handleMassSuggestion } from './modalSpells.js';

const playerStats = { name: 'DivinationWizard', level: 20, spellAbilities: { saveDc: 19 } };

describe('SP-079 modalSpells.handleMassSuggestion — pay-at-confirm flag forwarding', () => {
    it('forwards deferSlotPayment + slotLevel + castingTime when the open lane deferred payment', () => {
        const spell = {
            name: 'Mass Suggestion',
            level: 6,
            casting_time: 'Action',
            automation: { type: 'mass_suggestion' },
            _deferChooserSlotPayment: true,
            slotLevel: 6,
        };

        const { handled, result } = handleMassSuggestion(spell, 19, playerStats, 'test-campaign');

        expect(handled).toBe(true);
        expect(result.automationPopup.modalName).toBe('massSuggestion');
        expect(result.automationPopup.payload).toEqual(expect.objectContaining({
            deferSlotPayment: true,
            slotLevel: 6,
            castingTime: 'Action',
            saveDc: 19,
        }));
    });

    it('does NOT set deferSlotPayment for a paid-at-open lane (sorcerer metamagic twin)', () => {
        const spell = {
            name: 'Mass Suggestion',
            level: 6,
            casting_time: 'Action',
            automation: { type: 'mass_suggestion' },
        };

        const { result } = handleMassSuggestion(spell, 19, playerStats, 'test-campaign');

        expect(result.automationPopup.payload.deferSlotPayment).toBe(false);
    });
});
