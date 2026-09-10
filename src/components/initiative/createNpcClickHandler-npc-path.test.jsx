// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { loadMonsters } from '../../services/ui/dataLoader.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import { npcToMonsterFormat } from '../../services/encounters/npcStatBlockUtils.js';

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(() => Promise.resolve([])),
    fetchRaceData: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({
    npcToMonsterFormat: vi.fn(() => null),
}));

describe('createNpcClickHandler - NPC stat block path', () => {
    let handler;
    let setViewingMonster;
    let setViewingMonsterCreatureName;
    let campaignNpcs;
    let characters;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
        campaignNpcs = [];
        characters = [
            {
                name: 'DruidAlice',
                computedStats: {
                    hitPoints: 20,
                    currentHitPoints: 20,
                    armorClass: 15,
                    abilities: [
                        { name: 'Intelligence', score: 16 },
                        { name: 'Wisdom', score: 14 },
                        { name: 'Charisma', score: 12 },
                    ],
                    languages: ['Common', 'Elvish'],
                    class: { major: { name: 'Circle of the Moon' } },
                },
            },
        ];
        vi.mocked(loadMonsters).mockResolvedValue([]);
        vi.mocked(getCombatSummary).mockReturnValue(null);
        vi.mocked(getMonsterData).mockResolvedValue(null);
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs,
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
    });

    it('should format NPC via npcToMonsterFormat and set viewing monster when NPC is found', async () => {
        campaignNpcs = [
            {
                name: 'Goblin Warrior',
                armorClass: 15,
                hitPoints: 7,
                abilityScores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 8 },
                size: 'Small',
                classRole: 'NPC',
                speed: { walk: '30 ft.' },
                savingThrowBonuses: { dex: 4 },
                skillBonuses: {},
                initiativeBonus: 2,
                traits: [],
                actions: [],
                reactions: [],
                damageResistances: [],
                damageImmunities: [],
                conditionImmunities: [],
            },
        ];
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs,
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        const formatted = { name: 'Goblin Warrior', armor_class: 15 };
        vi.mocked(npcToMonsterFormat).mockReturnValue(formatted);

        await handler({ name: 'Goblin Warrior' });

        expect(npcToMonsterFormat).toHaveBeenCalledWith(campaignNpcs[0]);
        expect(setViewingMonster).toHaveBeenCalledWith(formatted);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('Goblin Warrior');
    });

    it('should fall through to getMonsterData when npcToMonsterFormat returns null for a found NPC', async () => {
        campaignNpcs = [
            {
                name: 'Goblin Warrior',
            },
        ];
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs,
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        vi.mocked(npcToMonsterFormat).mockReturnValue(null);
        const fallbackMonster = { index: 'goblin', name: 'Goblin' };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        await handler({ name: 'Goblin Warrior' });

        expect(npcToMonsterFormat).toHaveBeenCalled();
        expect(getMonsterData).toHaveBeenCalledWith('Goblin Warrior');
        expect(setViewingMonster).toHaveBeenCalledWith(fallbackMonster);
    });

    it('should skip npcToMonsterFormat and fall to getMonsterData when NPC lookup fails (empty list, null name, missing name)', async () => {
        const fallbackMonster = { index: 'goblin', name: 'Goblin' };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        // Empty campaignNpcs
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        await handler({ name: 'Goblin' });
        expect(npcToMonsterFormat).not.toHaveBeenCalled();
        expect(getMonsterData).toHaveBeenCalledWith('Goblin');
        vi.clearAllMocks();
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        // campaignNpcs with NPC that has no name property
        campaignNpcs = [
            {
                armorClass: 15,
                hitPoints: 7,
                abilityScores: {},
            },
        ];
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs,
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        await handler({ name: 'Goblin' });
        expect(npcToMonsterFormat).not.toHaveBeenCalled();
        expect(getMonsterData).toHaveBeenCalledWith('Goblin');
        vi.clearAllMocks();
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        // campaignNpcs with NPC that has null name
        campaignNpcs = [
            {
                name: null,
                armorClass: 15,
                hitPoints: 7,
                abilityScores: {},
            },
        ];
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs,
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        await handler({ name: 'Goblin' });
        expect(npcToMonsterFormat).not.toHaveBeenCalled();
        expect(getMonsterData).toHaveBeenCalledWith('Goblin');
    });

    it('should skip npcToMonsterFormat when creature name is null', async () => {
        campaignNpcs = [
            {
                name: 'Goblin',
                armorClass: 15,
                hitPoints: 7,
                abilityScores: {},
            },
        ];
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs,
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });

        await handler({ name: null });

        expect(npcToMonsterFormat).not.toHaveBeenCalled();
        expect(setViewingMonster).not.toHaveBeenCalled();
    });

    it('should perform case-insensitive NPC name matching', async () => {
        campaignNpcs = [
            {
                name: 'goblin warrior',
                armorClass: 15,
                hitPoints: 7,
                abilityScores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 8 },
            },
        ];
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs,
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        const formatted = { name: 'goblin warrior', armor_class: 15 };
        vi.mocked(npcToMonsterFormat).mockReturnValue(formatted);

        await handler({ name: 'GOBLIN WARRIOR' });

        expect(npcToMonsterFormat).toHaveBeenCalledWith(campaignNpcs[0]);
        expect(setViewingMonster).toHaveBeenCalledWith(formatted);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('GOBLIN WARRIOR');
    });
});
