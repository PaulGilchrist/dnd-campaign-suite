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

vi.mock('../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

describe('charmPersonService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        addEntry.mockResolvedValue({});
    });

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

    describe('triggerCharmPerson', () => {
        it('returns null when spell name is missing, null, or does not match "charm person"', async () => {
            for (const name of [null, undefined, '', 'Charm', 'Person', 'Charming Person']) {
                const result = await callTrigger({ ...baseSpell, name });
                expect(result).toBeNull();
            }
        });

        it('is case-insensitive for spell name matching', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [] });

            for (const name of ['CHARM PERSON', 'charm person', 'ChArM PeRsOn']) {
                const result = await triggerCharmPerson({ name }, { targetName: 'Goblin' }, baseStats, campaignName, mapName);
                expect(result).toEqual({ type: 'popup' });
                vi.clearAllMocks();
                addEntry.mockResolvedValue({});
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

        it('returns popup when no targetName and combat context is null', async () => {
            vi.mocked(getCombatContext).mockResolvedValue(null);
            const result = await callTrigger(baseSpell, { ...baseMetaCtx, targetName: null }, baseStats);
            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No target selected for Charm Person.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns popup when no targetName and all creatures are the caster', async () => {
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [{ name: 'Bard', type: 'player' }],
            });
            const result = await callTrigger(baseSpell, { ...baseMetaCtx, targetName: null }, baseStats);
            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No target selected for Charm Person.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('auto-selects first non-caster creature from combat context when targetName is missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Bard', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                    { name: 'Orc', type: 'npc' },
                ],
            });

            const result = await callTrigger(baseSpell, { targetName: null }, baseStats);
            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Goblin' }),
                }),
                baseStats, campaignName, mapName,
            );
        });

        it('auto-selects first creature whose name differs from caster', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Bard', type: 'player' },
                    { name: 'Bard', type: 'npc' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });

            await callTrigger(baseSpell, { targetName: null }, baseStats);

            // First creature with name !== 'Bard' is 'Goblin'
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Goblin' }),
                }),
                baseStats, campaignName, mapName,
            );
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

        it('logs to campaign when target is not a Humanoid', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Bard', type: 'player' },
                    { name: 'Wolf', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Beast' });

            const result = await callTrigger(baseSpell, { targetName: 'Wolf' }, baseStats);

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No effect. Wolf is not a Humanoid.' },
            });
            expect(executeHandler).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'Bard',
                abilityName: 'Charm Person',
                description: 'Bard casts Charm Person on Wolf but it has no effect — Wolf is not a Humanoid.',
            });
        });

        it('proceeds to executeHandler when target is a Humanoid NPC', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Bard', type: 'player' },
                    { name: 'Shopkeeper', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });

            const result = await callTrigger(baseSpell, { targetName: 'Shopkeeper' }, baseStats);

            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Shopkeeper' }),
                }),
                baseStats, campaignName, mapName,
            );
        });

        it('treats player-type creatures as Humanoid without calling getMonsterData', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Bard', type: 'player' },
                    { name: 'Cleric', type: 'player' },
                ],
            });

            const result = await callTrigger(baseSpell, { targetName: 'Cleric' }, baseStats);

            expect(result).toEqual({ type: 'popup' });
            expect(getMonsterData).not.toHaveBeenCalled();
            expect(executeHandler).toHaveBeenCalled();
        });

        it('defaults to Humanoid when getMonsterData throws', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Mystery', type: 'npc' }],
            });
            getMonsterData.mockRejectedValue(new Error('Failed to load'));

            const result = await callTrigger(baseSpell, { targetName: 'Mystery' }, baseStats);

            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalled();
        });

        it('defaults to Humanoid when creature not found in combat context', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await callTrigger(baseSpell, { targetName: 'Unknown' }, baseStats);

            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalled();
        });

        it('defaults to Humanoid when combat context is null/undefined', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue(null);

            const result = await callTrigger(baseSpell, { targetName: 'Unknown' }, baseStats);

            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalled();
        });

        it('sets advantage:true when target is in combat, false otherwise', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            // Target in combat
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Bard', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });

            await callTrigger();

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ advantage: true }),
                }),
                baseStats, campaignName, mapName,
            );
            vi.clearAllMocks();
            addEntry.mockResolvedValue({});

            // Target not in combat (no creatures at all)
            getCombatContext.mockResolvedValue({ creatures: [] });

            await callTrigger(baseSpell, { targetName: 'Shopkeeper' }, baseStats);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ advantage: false }),
                }),
                baseStats, campaignName, mapName,
            );
        });

        it('resolves saveDc from metaCtx first, then playerStats, then default formula', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [] });

            // metaCtx takes priority
            await callTrigger(baseSpell, { ...baseMetaCtx, spellSaveDc: 20 }, baseStats);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 20 }),
                }),
                baseStats, campaignName, mapName,
            );
            vi.clearAllMocks();
            addEntry.mockResolvedValue({});

            // playerStats.spellAbilities.saveDc fallback
            await callTrigger(baseSpell, { targetName: 'Goblin' }, baseStats);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 15 }),
                }),
                baseStats, campaignName, mapName,
            );
            vi.clearAllMocks();
            addEntry.mockResolvedValue({});

            // proficiency-based fallback: 8 + proficiency
            const statsWithProf = { name: 'Bard', proficiency: 3 };
            await callTrigger(baseSpell, { targetName: 'Goblin' }, statsWithProf);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 11 }),
                }),
                statsWithProf, campaignName, mapName,
            );
            vi.clearAllMocks();
            addEntry.mockResolvedValue({});

            // default proficiency of 2: 8 + 2 = 10
            const statsDefault = { name: 'Bard' };
            await callTrigger(baseSpell, { targetName: 'Goblin' }, statsDefault);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 10 }),
                }),
                statsDefault, campaignName, mapName,
            );
        });

        it('resolves slotLevel from metaCtx first, then spell.level fallback', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [] });

            // metaCtx slotLevel takes priority
            await callTrigger(baseSpell, { ...baseMetaCtx, slotLevel: 3 }, baseStats);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 3 }),
                baseStats, campaignName, mapName,
            );
            vi.clearAllMocks();
            addEntry.mockResolvedValue({});

            // spell.level fallback
            await callTrigger({ name: 'Charm Person', level: 2 }, { targetName: 'Goblin' }, baseStats);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 2 }),
                baseStats, campaignName, mapName,
            );
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [] });
            const spell = { name: 'Charm Person', level: 1, school: 'Enchantment' };

            await triggerCharmPerson(spell, { targetName: 'Goblin' }, baseStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                baseStats, campaignName, mapName,
            );
        });

        it('passes mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [] });

            await triggerCharmPerson(baseSpell, { targetName: 'Goblin' }, baseStats, campaignName, 'otherMap');

            expect(executeHandler).toHaveBeenCalledWith(
                expect.anything(),
                baseStats,
                campaignName,
                'otherMap',
            );
        });

        it('handles undefined metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc' }],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });

            const result = await triggerCharmPerson(baseSpell, undefined, baseStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('does not call getMonsterData for player-type creatures', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'OtherPlayer', type: 'player' }],
            });

            await callTrigger(baseSpell, { targetName: 'OtherPlayer' }, baseStats);

            expect(getMonsterData).not.toHaveBeenCalled();
            expect(executeHandler).toHaveBeenCalled();
        });

        it('returns correct popup description for non-humanoid with correct target name', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Bard', type: 'player' },
                    { name: 'Oozy', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Ooze' });

            const result = await callTrigger(baseSpell, { targetName: 'Oozy' }, baseStats);

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Charm Person', description: 'No effect. Oozy is not a Humanoid.' },
            });
        });

        it('logs with correct characterName and abilityName for non-humanoid rejection', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'CustomBard', type: 'player' },
                    { name: 'Dragon', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Dragon' });

            await callTrigger(baseSpell, { targetName: 'Dragon' }, { ...baseStats, name: 'CustomBard' });

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'CustomBard',
                abilityName: 'Charm Person',
            }));
        });
    });
});
