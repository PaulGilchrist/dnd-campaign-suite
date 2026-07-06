// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerCharmPerson } from './charmPersonService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
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

        it('returns null when spell name is missing/null/undefined', async () => {
            for (const name of [null, undefined, '']) {
                const result = await callTrigger({ ...baseSpell, name });
                expect(result).toBeNull();
            }
        });

        it('returns null for non-matching spell names', async () => {
            const results = await Promise.all([
                callTrigger({ name: 'Charm' }),
                callTrigger({ name: 'Person' }),
                callTrigger({ name: 'Charming Person' }),
            ]);
            expect(results).toEqual([null, null, null]);
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns popup when no targetName in metaCtx and no creatures in combat context', async () => {
            const result = await callTrigger(baseSpell, { ...baseMetaCtx, targetName: null }, baseStats);
            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No target selected for Charm Person.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('calls executeHandler with correct action shape including saveDc and targetName', async () => {
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
                }),
                baseStats, campaignName, mapName,
            );
        });

        it('passes spell object and metaCtx into the action', async () => {
            executeHandler.mockResolvedValue({ success: true });
            const spell = { name: 'Charm Person', level: 1 };
            await callTrigger(spell, { targetName: 'Goblin' });
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                baseStats, campaignName, mapName,
            );
        });

        it('returns executeHandler result on success', async () => {
            const expectedResult = { type: 'popup', payload: { text: 'Charm Person activated' } };
            executeHandler.mockResolvedValue(expectedResult);
            const result = await callTrigger();
            expect(result).toBe(expectedResult);
        });

        it('returns popup on handler error (not null)', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            const result = await callTrigger();
            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'Failed to execute Charm Person.' },
            });
        });
    });
});
