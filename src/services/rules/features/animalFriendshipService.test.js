import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerAnimalFriendship } from './animalFriendshipService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

describe('animalFriendshipService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        addEntry.mockResolvedValue({});
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const baseSpell = { name: 'Animal Friendship' };
    const baseMetaCtx = { targetNames: ['Wolf'] };
    const baseStats = {
        name: 'Druid',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Wisdom' },
        proficiency: 4,
    };

    function callTrigger(spell = baseSpell, metaCtx = baseMetaCtx, stats = baseStats) {
        return triggerAnimalFriendship(spell, metaCtx, stats, campaignName, mapName);
    }

    describe('triggerAnimalFriendship', () => {
        it('returns null when spell name does not match "animal friendship"', async () => {
            for (const name of [null, undefined, '', 'Animal', 'Friendship', 'Animal Friends']) {
                const result = await callTrigger({ ...baseSpell, name });
                expect(result).toBeNull();
            }
        });

        it('is case-insensitive for spell name matching', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [] });

            for (const name of ['ANIMAL FRIENDSHIP', 'animal friendship', 'Animal Friendship']) {
                const result = await triggerAnimalFriendship({ name }, { targetNames: ['Wolf'] }, baseStats, campaignName, mapName);
                expect(result).toEqual({ type: 'popup' });
                vi.clearAllMocks();
                addEntry.mockResolvedValue({});
            }
        });

        it('returns popup when no targetNames and no creatures in combat context', async () => {
            vi.mocked(getCombatContext).mockResolvedValue({ creatures: [] });
            const result = await callTrigger(baseSpell, { ...baseMetaCtx, targetNames: [] }, baseStats);
            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Animal Friendship', description: 'No Beast targets available for Animal Friendship.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns popup when no targetNames and combat context is null', async () => {
            vi.mocked(getCombatContext).mockResolvedValue(null);
            const result = await callTrigger(baseSpell, { ...baseMetaCtx, targetNames: [] }, baseStats);
            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Animal Friendship', description: 'No Beast targets available for Animal Friendship.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('auto-selects beasts from combat context when no targetNames provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wolf', type: 'npc' },
                    { name: 'Goblin', type: 'npc' },
                    { name: 'Druid', type: 'player' },
                ],
            });
            vi.mocked(getMonsterData).mockImplementation(async (name) => {
                if (name === 'Wolf') return { type: 'Beast' };
                if (name === 'Goblin') return { type: 'Humanoid' };
                return null;
            });

            const result = await triggerAnimalFriendship(baseSpell, { targetNames: null }, baseStats, campaignName, mapName);

            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetNames: ['Wolf'] }),
                }),
                baseStats,
                campaignName,
                mapName,
            );
        });

        it('filters out non-beast creatures from auto-selection', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc' },
                    { name: 'Ogre', type: 'npc' },
                ],
            });
            vi.mocked(getMonsterData).mockImplementation(async (name) => {
                if (name === 'Goblin') return { type: 'Humanoid' };
                if (name === 'Ogre') return { type: 'Giant' };
                return null;
            });

            const result = await triggerAnimalFriendship(baseSpell, { targetNames: null }, baseStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Animal Friendship', description: 'No Beast targets available for Animal Friendship.' },
            });
        });

        it('filters out player creatures from auto-selection', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Druid', type: 'player' },
                    { name: 'Bard', type: 'player' },
                ],
            });

            const result = await triggerAnimalFriendship(baseSpell, { targetNames: null }, baseStats, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Animal Friendship', description: 'No Beast targets available for Animal Friendship.' },
            });
        });

        it('passes explicit targetNames through to handler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await callTrigger(baseSpell, { targetNames: ['Wolf', 'Hawk'] }, baseStats);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetNames: ['Wolf', 'Hawk'] }),
                }),
                baseStats,
                campaignName,
                mapName,
            );
        });

        it('uses spellSaveDc from metaCtx or calculates from playerStats', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await callTrigger(baseSpell, { targetNames: ['Wolf'], spellSaveDc: 18 }, baseStats);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 18 }),
                }),
                baseStats,
                campaignName,
                mapName,
            );
        });

        it('uses slotLevel from metaCtx', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await callTrigger(baseSpell, { targetNames: ['Wolf'], slotLevel: 3 }, baseStats);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 3 }),
                baseStats,
                campaignName,
                mapName,
            );
        });

        it('defaults slotLevel to spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Animal Friendship', level: 1 };

            await callTrigger(spell, { targetNames: ['Wolf'] }, baseStats);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 1 }),
                baseStats,
                campaignName,
                mapName,
            );
        });

        it('passes through handler result', async () => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', name: 'Animal Friendship', description: 'Target charmed' } };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await callTrigger(baseSpell, baseMetaCtx, baseStats);

            expect(result).toBe(expectedResult);
        });

        it('returns error popup when handler throws', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await callTrigger(baseSpell, baseMetaCtx, baseStats);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Failed to execute Animal Friendship');
        });
    });
});
