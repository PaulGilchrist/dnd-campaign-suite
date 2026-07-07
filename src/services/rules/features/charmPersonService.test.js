// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerCharmPerson } from './charmPersonService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

describe('charmPersonService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerCharmPerson', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const baseSpell = { name: 'Charm Person' };
        const baseMetaCtx = { targetName: 'Goblin' };
        const baseStats = {
            name: 'Bard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Charisma' },
            proficiency: 4,
        };

        function callTrigger(spell = baseSpell, metaCtx = baseMetaCtx, stats = baseStats) {
            return triggerCharmPerson(spell, metaCtx, stats, campaignName, mapName);
        }

        it('returns null when spell name is missing, null, or does not match "charm person"', async () => {
            for (const name of [null, undefined, '', 'Charm', 'Person', 'Charming Person']) {
                const result = await callTrigger({ ...baseSpell, name });
                expect(result).toBeNull();
            }
        });

        it('returns popup when no targetName and no creatures in combat context', async () => {
            vi.mocked(getCombatContext).mockResolvedValue({ creatures: [] });
            const result = await callTrigger(baseSpell, { ...baseMetaCtx, targetName: null }, baseStats);
            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No target selected for Charm Person.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('calls executeHandler with correct action shape including saveDc, targetName, and spell', async () => {
            executeHandler.mockResolvedValue({ success: true });
            await callTrigger();

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Charm Person',
                    automation: expect.objectContaining({
                        type: 'charm_person',
                        saveDc: 15,
                        targetName: 'Goblin',
                    }),
                    spell: baseSpell,
                }),
                baseStats, campaignName, mapName,
            );
        });

        it('returns executeHandler result on success', async () => {
            const expectedResult = { type: 'popup', payload: { text: 'Charm Person activated' } };
            executeHandler.mockResolvedValue(expectedResult);
            const result = await callTrigger();
            expect(result).toBe(expectedResult);
        });

        it('returns popup on handler error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            const result = await callTrigger();
            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'Failed to execute Charm Person.' },
            });
        });
    });
});
