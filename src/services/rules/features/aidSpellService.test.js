// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerAidSpell, confirmAidSpell } from './aidSpellService.js';
import { executeHandler, applyAidEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyAidEffect: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = { name: 'Cleric', proficiency: 4 };

describe('aidSpellService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerAidSpell', () => {
        it.each([
            { spell: {}, label: 'missing name' },
            { spell: { name: null }, label: 'null name' },
            { spell: { name: 'Cure Wounds', level: 1 }, label: 'non-Aid spell' },
        ])('returns null for $label', async ({ spell }) => {
            const result = await triggerAidSpell(spell, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns handler result on success', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const result = await triggerAidSpell({ name: 'Aid', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toEqual({ type: 'popup' });
        });

        it('returns null when handler returns null or throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            executeHandler.mockResolvedValue(null);
            let result = await triggerAidSpell({ name: 'Aid', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();

            executeHandler.mockRejectedValue(new Error('Handler failed'));
            result = await triggerAidSpell({ name: 'Aid', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[aidSpell] Failed to execute Aid handler:',
                expect.any(Error),
            );

            consoleSpy.mockRestore();
        });
    });

    describe('confirmAidSpell', () => {
        const action = {
            name: 'Aid',
            automation: { type: 'aid', maxTargets: 3, hpMaxIncreaseExpression: '5 + ((spellSlotLevel - 2) * 5)' },
            spellSlotLevel: 2,
        };
        const targetNames = ['Gromp', 'Liala', 'Kaelen'];

        it('returns the effect application result on success', async () => {
            applyAidEffect.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', name: 'Aid Applied' } });
            const result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info', name: 'Aid Applied' } });
        });

        it('returns null and logs error when effect application returns null or throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            applyAidEffect.mockResolvedValue(null);
            let result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);
            expect(result).toBeNull();

            applyAidEffect.mockRejectedValue(new Error('Aid effect failed'));
            result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[aidSpell] Failed to apply Aid effect:',
                expect.any(Error),
            );

            consoleSpy.mockRestore();
        });
    });
});
