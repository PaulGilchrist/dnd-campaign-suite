// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { loadMonsters } from '../../services/ui/dataLoader.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(() => Promise.resolve([])),
    fetchRaceData: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

describe('createNpcClickHandler - Regular monster from campaign data path', () => {
    let handler;
    let setViewingMonster;
    let setViewingMonsterCreatureName;
    let characters;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
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
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
    });

    it('should load monster by runtimeCreature.monsterIndex with full property merging', async () => {
        const combatSummary = {
            creatures: [
                {
                    name: 'Goblin',
                    type: 'npc',
                    monsterIndex: 'goblin',
                    ac: 15,
                    currentHp: 7,
                    size: 'Small',
                    speed: { walk: '30 ft.' },
                    saveBonuses: { dex: 4 },
                    resistances: 'cold',
                    immunities: 'bludgeoning;piercing',
                    actions: [{ name: 'Scimitar', attack_bonus: 4, damage_type_primary: 'Slashing', description: '4 Slashing damage' }],
                },
            ],
        };
        vi.mocked(getCombatSummary).mockReturnValue(combatSummary);
        vi.mocked(loadMonsters).mockResolvedValue([
            {
                index: 'goblin',
                name: 'Goblin',
                armor_class: 15,
                hit_points: 7,
                ability_scores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 8 },
                saving_throws: { dex: { modifier: 4 } },
                actions: [],
                size: 'Small',
                type: 'Humanoid',
                challenge_rating: 0.25,
            },
        ]);

        await handler({ name: 'Goblin' });

        expect(setViewingMonster).toHaveBeenCalled();
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('Goblin');
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.name).toBe('Goblin');
        expect(monster.armor_class).toBe(15);
        expect(monster.hit_points).toBe(7);
        expect(monster.type).toBe('Humanoid');
        expect(monster.size).toBe('Small');
        expect(monster.speed).toEqual({ walk: '30 ft.' });
        expect(monster.saving_throws.dex.modifier).toBe(4);
        expect(monster.damage_resistances).toBe('cold');
        expect(monster.damage_immunities).toBe('bludgeoning;piercing');
        expect(monster.actions[0].name).toBe('Scimitar');
    });

    it('should apply druid abilities and languages when runtimeCreature has wildShapeSource', async () => {
        const combatSummary = {
            creatures: [
                {
                    name: 'Goblin',
                    type: 'npc',
                    monsterIndex: 'goblin',
                    ac: 15,
                    currentHp: 7,
                    wildShapeSource: 'DruidAlice',
                },
            ],
        };
        vi.mocked(getCombatSummary).mockReturnValue(combatSummary);
        vi.mocked(loadMonsters).mockResolvedValue([
            {
                index: 'goblin',
                name: 'Goblin',
                armor_class: 15,
                hit_points: 7,
                ability_scores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 8 },
                saving_throws: {},
                actions: [],
                size: 'Small',
                type: 'Humanoid',
                challenge_rating: 0.25,
            },
        ]);

        await handler({ name: 'Goblin' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('Goblin');
        expect(monster.ability_scores.int).toBe(16);
        expect(monster.ability_scores.wis).toBe(14);
        expect(monster.ability_scores.cha).toBe(12);
        expect(monster.languages).toBe('Common, Elvish');
    });

    it('should override save bonuses from runtime creature', async () => {
        const combatSummary = {
            creatures: [
                {
                    name: 'Goblin',
                    type: 'npc',
                    monsterIndex: 'goblin',
                    ac: 15,
                    currentHp: 7,
                    saveBonuses: { dex: 6, con: 3 },
                },
            ],
        };
        vi.mocked(getCombatSummary).mockReturnValue(combatSummary);
        vi.mocked(loadMonsters).mockResolvedValue([
            {
                index: 'goblin',
                name: 'Goblin',
                armor_class: 15,
                hit_points: 7,
                ability_scores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 8 },
                saving_throws: { str: { modifier: -1 }, dex: { modifier: 2 }, con: { modifier: 0 } },
                actions: [],
                size: 'Small',
                type: 'Humanoid',
                challenge_rating: 0.25,
            },
        ]);

        await handler({ name: 'Goblin' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.saving_throws.dex.modifier).toBe(6);
        expect(monster.saving_throws.con.modifier).toBe(3);
        expect(monster.saving_throws.str.modifier).toBe(-1);
    });
});
