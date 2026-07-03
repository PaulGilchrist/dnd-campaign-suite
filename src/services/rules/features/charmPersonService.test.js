// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerCharmPerson } from './charmPersonService.js';
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

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

describe('charmPersonService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        addEntry.mockResolvedValue({});
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('triggerCharmPerson', () => {
        it('returns null for non-Charm Person spells', async () => {
            const result = await triggerCharmPerson(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is undefined', async () => {
            const result = await triggerCharmPerson({}, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('executes handler and returns result for valid Charm Person spell', async () => {
            getCombatContext.mockResolvedValue(null);
            const expectedResult = { type: 'popup', payload: { type: 'automation_info' } };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Charm Person',
                    automation: expect.objectContaining({
                        type: 'charm_person',
                        saveDc: 15,
                        targetName: 'Goblin',
                    }),
                    spellSlotLevel: 1,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('is case-insensitive for spell name matching', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson({ name: 'CHARM PERSON', level: 1 }, { targetName: 'Goblin' }, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalled();
        });

        it('returns no-target popup when metaCtx lacks targetName and combat context is empty', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No target selected for Charm Person.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns no-target popup when metaCtx is null', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                null,
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No target selected for Charm Person.' },
            });
        });

        it('falls back to first non-caster creature from combat context when targetName is missing', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Goblin' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });

        it('returns no-target popup when combat context has only the caster', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Wizard', type: 'player' }],
            });

            const result = await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No target selected for Charm Person.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns non-humanoid popup when target is not a Humanoid', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Wolf', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Beast' });

            const result = await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Wolf' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No effect. Wolf is not a Humanoid.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                characterName: 'Wizard',
                abilityName: 'Charm Person',
            }));
        });

        it('defaults to Humanoid when creature is not found in combat context', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Wizard', type: 'player' }],
            });
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'UnknownCreature' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('defaults to Humanoid when creature is a player type', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Fighter', type: 'player' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Fighter' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
        });

        it('defaults to Humanoid when getMonsterData throws', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Mystery', type: 'npc' },
                ],
            });
            getMonsterData.mockRejectedValue(new Error('Network error'));
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Mystery' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
        });

        it('defaults to Humanoid when getMonsterData returns no type', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Oddity', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({});
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Oddity' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
        });

        it('proceeds when caster and target are both in combat context', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
        });

        it('proceeds when combat context is null', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
        });

        it('passes advantage=true when target is in combat', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ advantage: true }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes advantage=false when target is not in combat', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ advantage: false }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spellSaveDc from metaCtx when provided', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin', spellSaveDc: 18, slotLevel: 2 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 18 }),
                    spellSlotLevel: 2,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 15 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when no spellAbilities.saveDc', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 3 };

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 11 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('uses default proficiency of 2 when not available', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard' };

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 10 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('returns error popup when executeHandler throws', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'Failed to execute Charm Person.' },
            });
        });

        it('uses spell.level as default slotLevel', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 1 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses metaCtx slotLevel when provided', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Goblin', slotLevel: 3 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 3 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('checks target validity in correct order: humanoid -> fighting', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Wolf', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Beast' });

            const result = await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Wolf' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No effect. Wolf is not a Humanoid.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('passes targetName in automation to executeHandler', async () => {
            getCombatContext.mockResolvedValue(null);
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCharmPerson(
                { name: 'Charm Person', level: 1 },
                { targetName: 'Shopkeeper' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        targetName: 'Shopkeeper',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });
    });
});
