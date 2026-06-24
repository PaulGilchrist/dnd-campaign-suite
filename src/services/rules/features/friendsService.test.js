// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerFriends, endFriendsOnHostileAction } from './friendsService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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

describe('friendsService', () => {
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

    describe('triggerFriends', () => {
        it('returns null for non-Friends spells', async () => {
            const result = await triggerFriends(
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
            const result = await triggerFriends({}, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('executes handler and returns result for valid Friends spell', async () => {
            getCombatContext.mockResolvedValue(null);
            const expectedResult = { type: 'popup', payload: { type: 'automation_info' } };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Friends',
                    automation: expect.objectContaining({
                        type: 'friends',
                        saveDc: 15,
                        targetName: 'Goblin',
                    }),
                    spellSlotLevel: 0,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('is case-insensitive for spell name matching', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFriends({ name: 'FRIENDS', level: 0 }, { targetName: 'Goblin' }, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalled();
        });

        it('returns no-target popup when metaCtx lacks targetName and combat context is empty', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Friends', description: 'No target selected for Friends.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns no-target popup when metaCtx is null', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
                null,
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Friends', description: 'No target selected for Friends.' },
            });
        });

        it('falls back to first non-caster creature from combat context when targetName is missing', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });
            getRuntimeValue.mockReturnValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
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

            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Friends', description: 'No target selected for Friends.' },
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

            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
                { targetName: 'Wolf' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Friends', description: 'No effect. Wolf is not a Humanoid.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                characterName: 'Wizard',
                abilityName: 'Friends',
            }));
        });

        it('defaults to Humanoid when creature is not found in combat context', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Wizard', type: 'player' }],
            });
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
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
            getRuntimeValue.mockReturnValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFriends(
                { name: 'Friends', level: 0 },
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
            getRuntimeValue.mockReturnValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFriends(
                { name: 'Friends', level: 0 },
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
            getRuntimeValue.mockReturnValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFriends(
                { name: 'Friends', level: 0 },
                { targetName: 'Oddity' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
        });

        it('returns fighting popup when caster is fighting the target', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });

            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Friends', description: 'No effect. You are fighting Goblin.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                abilityName: 'Friends',
            }));
        });

        it('proceeds when caster is not in combat', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Fighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFriends(
                { name: 'Friends', level: 0 },
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

            await triggerFriends(
                { name: 'Friends', level: 0 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
        });

        it('returns cooldown popup when cast within 24 hours', async () => {
            getCombatContext.mockResolvedValue(null);
            getRuntimeValue.mockReturnValue(true);

            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Friends', description: 'No effect. You have already cast Friends on Goblin within the past 24 hours.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                abilityName: 'Friends',
            }));
        });

        it('records the cast on success', async () => {
            getCombatContext.mockResolvedValue(null);
            getRuntimeValue.mockReturnValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFriends(
                { name: 'Friends', level: 0 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Wizard',
                '_friends_24h_Wizard_Goblin',
                true,
                campaignName,
            );
        });

        it('uses spellSaveDc from metaCtx when provided', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFriends(
                { name: 'Friends', level: 0 },
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

            await triggerFriends(
                { name: 'Friends', level: 0 },
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

            await triggerFriends(
                { name: 'Friends', level: 0 },
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

            await triggerFriends(
                { name: 'Friends', level: 0 },
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

            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Friends', description: 'Failed to execute Friends.' },
            });
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            getCombatContext.mockResolvedValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFriends(
                { name: 'Friends', level: 3 },
                { targetName: 'Goblin', spellSaveDc: 17 },
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

        it('checks target validity in correct order: humanoid -> fighting -> cooldown', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Wolf', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Beast' });
            getRuntimeValue.mockReturnValue(true);

            // Both non-humanoid AND fighting AND on cooldown — should report non-humanoid first
            const result = await triggerFriends(
                { name: 'Friends', level: 0 },
                { targetName: 'Wolf' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Friends', description: 'No effect. Wolf is not a Humanoid.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('passes targetName in automation to executeHandler', async () => {
            getCombatContext.mockResolvedValue(null);
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });
            getRuntimeValue.mockReturnValue(null);
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFriends(
                { name: 'Friends', level: 0 },
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

    describe('endFriendsOnHostileAction', () => {
        const casterName = 'Wizard';

        it('does nothing when no active target exists', () => {
            getRuntimeValue.mockReturnValue(null);

            endFriendsOnHostileAction(casterName, campaignName);

            expect(getRuntimeValue).toHaveBeenCalledWith(campaignName, `_activeFriends_Wizard`, campaignName);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('removes Charmed condition from active target when present', () => {
            const activeTarget = 'Shopkeeper';
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === campaignName && prop === `_activeFriends_Wizard`) return activeTarget;
                if (key === activeTarget && prop === 'activeConditions') return ['Charmed', 'Invisible'];
                return null;
            });

            endFriendsOnHostileAction(casterName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                activeTarget,
                'activeConditions',
                ['Invisible'],
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                `_activeFriends_Wizard`,
                null,
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: casterName,
                abilityName: 'Friends',
                description: `${activeTarget} knows it was Charmed by ${casterName} as the Friends spell ends early.`,
            });
        });

        it('clears active target pointer when no Charmed condition exists', () => {
            const activeTarget = 'Shopkeeper';
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === campaignName && prop === `_activeFriends_Wizard`) return activeTarget;
                if (key === activeTarget && prop === 'activeConditions') return ['Invisible', 'Poisoned'];
                return null;
            });

            endFriendsOnHostileAction(casterName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                `_activeFriends_Wizard`,
                null,
                campaignName,
            );
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                activeTarget,
                'activeConditions',
                expect.anything(),
                campaignName,
            );
        });

        it('handles case-insensitive Charmed string', () => {
            const activeTarget = 'Shopkeeper';
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === campaignName && prop === `_activeFriends_Wizard`) return activeTarget;
                if (key === activeTarget && prop === 'activeConditions') return ['charmed', 'Invisible'];
                return null;
            });

            endFriendsOnHostileAction(casterName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                activeTarget,
                'activeConditions',
                ['Invisible'],
                campaignName,
            );
        });

        it('handles all-charmed conditions resulting in empty array', () => {
            const activeTarget = 'Shopkeeper';
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === campaignName && prop === `_activeFriends_Wizard`) return activeTarget;
                if (key === activeTarget && prop === 'activeConditions') return ['CHARMED'];
                return null;
            });

            endFriendsOnHostileAction(casterName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                activeTarget,
                'activeConditions',
                [],
                campaignName,
            );
        });

        it('preserves non-Charmed conditions when removing Charmed', () => {
            const activeTarget = 'Shopkeeper';
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === campaignName && prop === `_activeFriends_Wizard`) return activeTarget;
                if (key === activeTarget && prop === 'activeConditions') return ['Charmed', 'Charmed', 'Invisible'];
                return null;
            });

            endFriendsOnHostileAction(casterName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                activeTarget,
                'activeConditions',
                ['Invisible'],
                campaignName,
            );
        });

        it('does not fail when addEntry rejects', () => {
            const activeTarget = 'Shopkeeper';
            addEntry.mockRejectedValue(new Error('Log error'));
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === campaignName && prop === `_activeFriends_Wizard`) return activeTarget;
                if (key === activeTarget && prop === 'activeConditions') return ['Charmed'];
                return null;
            });

            expect(() => endFriendsOnHostileAction(casterName, campaignName)).not.toThrow();
        });
    });
});
