// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { loadMonsters } from '../../services/ui/dataLoader.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import { npcToMonsterFormat } from '../../services/encounters/npcStatBlockUtils.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

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
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_key, _prop, _campaign) => {
        if (_prop === 'currentHitPoints') return 15;
        if (_prop === 'circleFormsAC') return null;
        if (_prop === 'polymorphTempHp') return 0;
        if (_prop === 'shapechangeTempHp') return 0;
        return null;
    }),
}));

const baseBear = {
    index: 'bear',
    name: 'Brown Bear',
    armor_class: 11,
    hit_points: 34,
    ability_scores: { str: 19, dex: 10, con: 16, int: 3, wis: 13, cha: 7 },
    saving_throws: {},
    actions: [],
    size: 'Large',
    type: 'Beast',
    challenge_rating: 1,
};

const baseCat = {
    index: 'cat',
    name: 'Panther',
    armor_class: 12,
    hit_points: 13,
    ability_scores: { str: 12, dex: 14, con: 12, int: 3, wis: 12, cha: 8 },
    ability_score_modifiers: { str: 1, dex: 2, con: 1, int: -4, wis: 1, cha: -1 },
    actions: [],
    size: 'Small',
    type: 'Beast',
    challenge_rating: 0.25,
};

const characters = [
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

const makeCombatCreature = (overrides = {}) => ({
    name: 'DruidAlice',
    polymorphSource: 'DruidAlice',
    polymorphBeast: { index: 'bear', challengeRating: 2 },
    ac: 14,
    size: 'Large',
    speed: { walk: '40 ft.' },
    currentHp: 25,
    ...overrides,
});

describe('createNpcClickHandler - Polymorph form path', () => {
    let handler;
    let setViewingMonster;
    let setViewingMonsterCreatureName;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        vi.mocked(getMonsterData).mockResolvedValue(null);
        vi.mocked(npcToMonsterFormat).mockReturnValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should load polymorph form with beast data and verify all merged properties', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 0;
            if (prop === 'circleFormsAC') return null;
            if (prop === 'shapechangeTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        expect(setViewingMonster).toHaveBeenCalled();
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.name).toBe('Brown Bear');
        expect(monster.hit_points).toBe(25);
        expect(monster.armor_class).toBe(14);
        expect(monster.type).toBe('beast');
        expect(monster.size).toBe('Large');
        expect(monster.challenge_rating).toBe(2);
        expect(monster.speed).toEqual({ walk: '40 ft.' });
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('DruidAlice');
    });

    it('should use beastName from runtimeCreature when available', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ beastName: 'Greater Bear Form' })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.name).toBe('Greater Bear Form');
    });

    it('should set polymorphTempHp when positive', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'polymorphTempHp') return 10;
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'circleFormsAC') return null;
            if (prop === 'shapechangeTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.hit_points_temp).toBe(10);
    });

    it('should apply druid abilities and languages to polymorph form', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.ability_scores.int).toBe(16);
        expect(monster.ability_scores.wis).toBe(14);
        expect(monster.ability_scores.cha).toBe(12);
        expect(monster.languages).toBe('Common, Elvish');
    });

    it('should keep the beast normal damage types for polymorph', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([
            {
                ...baseBear,
                actions: [
                    { name: 'Bite', attack_bonus: 5, damage_type_primary: 'Bludgeoning', damage_type_secondary: 'Piercing', description: '5 Bludgeoning damage' },
                ],
            },
        ]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.actions[0].damage_type_primary).toBe('Bludgeoning');
        expect(monster.actions[0].damage_type_secondary).toBe('Piercing');
        expect(monster.actions[0].damage_type_choices).toBeUndefined();
        expect(monster.actions[0].description).toBe('5 Bludgeoning damage');
    });

    it('should use ability_score_modifiers for saving throws when saving_throws is missing', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ polymorphBeast: { index: 'cat', challengeRating: 0.5 } })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseCat]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.saving_throws.str.modifier).toBe(1);
        expect(monster.saving_throws.dex.modifier).toBe(2);
        expect(monster.saving_throws.con.modifier).toBe(1);
    });

    it('should not set viewing monster when polymorphBeast is missing', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ polymorphBeast: undefined })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        expect(setViewingMonster).not.toHaveBeenCalled();
    });

    it('should not set viewing monster when base monster not found', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ polymorphBeast: { index: 'nonexistent', challengeRating: 2 } })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([]);

        await handler({ name: 'DruidAlice' });

        expect(setViewingMonster).not.toHaveBeenCalled();
    });

    it('should fall back to getMonsterData when no polymorph form exists', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [{ name: 'DruidAlice', currentHp: 25 }],
        });
        const fallbackMonster = { name: 'Owlbear', hit_points: 59 };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        await handler({ name: 'DruidAlice' });

        expect(setViewingMonster).toHaveBeenCalledWith(fallbackMonster);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('DruidAlice');
    });

    it('should fall back to creature.currentHp when runtime currentHitPoints is null', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return null;
            if (prop === 'polymorphTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice', currentHp: 25 });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.hit_points).toBe(25);
    });

    it('should use base monster challenge_rating when polymorphBeast.challengeRating is missing', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ polymorphBeast: { index: 'bear' } })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.challenge_rating).toBe(1);
    });

    it('should use base monster size when runtimeCreature.size is missing', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ size: undefined })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.size).toBe('Large');
    });
});
