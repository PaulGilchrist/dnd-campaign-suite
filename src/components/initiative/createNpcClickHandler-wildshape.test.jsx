// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { loadMonsters, fetchRaceData } from '../../services/ui/dataLoader.js';
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
    getRuntimeValue: vi.fn(),
}));

const baseBear = {
    index: 'bear',
    name: 'Brown Bear',
    armor_class: 11,
    hit_points: 34,
    ability_scores: { str: 19, dex: 10, con: 16, int: 3, wis: 13, cha: 7 },
    saving_throws: { str: { modifier: 6 }, dex: { modifier: 2 }, con: { modifier: 5 } },
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

const moonDruidCharacters = [
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
            automation: {
                passives: [{ type: 'damage_type_choice', effect: 'lunar_radiance' }],
            },
        },
    },
];

const nonMoonDruidCharacters = [
    {
        name: 'DruidBob',
        computedStats: {
            hitPoints: 20,
            currentHitPoints: 20,
            armorClass: 15,
            abilities: [
                { name: 'Intelligence', score: 16 },
                { name: 'Wisdom', score: 14 },
                { name: 'Charisma', score: 12 },
            ],
            languages: ['Common'],
            class: { major: { name: 'Land' } },
        },
    },
];

const makeCombatCreature = (overrides = {}) => ({
    name: 'DruidAlice',
    wildShapeSource: 'DruidAlice',
    beastIndex: 'bear',
    beastName: 'Brown Bear',
    ac: 11,
    currentHp: 15,
    ...overrides,
});

const mockRuntimeValues = (overrides = {}) => {
    const defaults = {
        currentHitPoints: 15,
        circleFormsAC: null,
        polymorphTempHp: 0,
        shapechangeTempHp: 0,
    };
    const values = { ...defaults, ...overrides };
    vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
        return prop in values ? values[prop] : null;
    });
};

describe('createNpcClickHandler - Wild Shape form path', () => {
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
            characters: moonDruidCharacters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        vi.mocked(getMonsterData).mockResolvedValue(null);
        vi.mocked(npcToMonsterFormat).mockReturnValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should load wild shape form with basic beast data and druid overrides', async () => {
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        expect(setViewingMonster).toHaveBeenCalled();
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('DruidAlice');
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.name).toBe('Brown Bear');
        expect(monster.hit_points).toBe(15);
        expect(monster.ability_scores.int).toBe(16);
        expect(monster.ability_scores.wis).toBe(14);
        expect(monster.ability_scores.cha).toBe(12);
        expect(monster.languages).toBe('Common, Elvish');
    });

    it('should apply circleFormsAC when set', async () => {
        mockRuntimeValues({ circleFormsAC: 18 });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.armor_class).toBe(18);
    });

    it('should set saving throws from base monster saving_throws', async () => {
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.saving_throws.str.modifier).toBe(6);
        expect(monster.saving_throws.dex.modifier).toBe(2);
        expect(monster.saving_throws.con.modifier).toBe(7);
    });

    it('should fall back to ability_score_modifiers for saving throws when saving_throws missing', async () => {
        mockRuntimeValues({ currentHitPoints: 10 });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ beastIndex: 'cat', beastName: 'Panther', ac: 12, currentHp: 10 })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseCat]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.saving_throws.str.modifier).toBe(1);
        expect(monster.saving_throws.dex.modifier).toBe(2);
    });

    it('should tag attacks with Lunar Radiance damage type choices for Moon Druid lv6+', async () => {
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([
            {
                ...baseBear,
                actions: [
                    { name: 'Bite', attack_bonus: 5, damage_type_primary: 'Bludgeoning', damage_type_secondary: 'Piercing', description: '5 Bludgeoning damage' },
                    { name: 'Claw', attack_bonus: 5, damage_type_primary: 'Slashing', description: 'Claw attack dealing Slashing damage' },
                ],
            },
        ]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.actions[0].damage_type_primary).toBe('Bludgeoning');
        expect(monster.actions[0].damage_type_secondary).toBe('Piercing');
        expect(monster.actions[0].damage_type_choices).toEqual(['Bludgeoning', 'Radiant']);
        expect(monster.actions[0].description).toContain('Bludgeoning or Radiant damage');
        expect(monster.actions[1].damage_type_choices).toEqual(['Slashing', 'Radiant']);
        expect(monster.actions[1].description).toContain('Slashing or Radiant damage');
    });

    it('should not add Lunar Radiance choices for Moon Druid below level 6', async () => {
        const youngMoonDruid = [
            {
                name: 'DruidAlice',
                computedStats: {
                    abilities: [{ name: 'Wisdom', score: 14 }],
                    class: { major: { name: 'Circle of the Moon' } },
                    automation: { passives: [] },
                },
            },
        ];
        const handler2 = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters: youngMoonDruid,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([
            {
                ...baseBear,
                actions: [
                    { name: 'Bite', attack_bonus: 5, damage_type_primary: 'Piercing', description: '7 Piercing damage' },
                ],
            },
        ]);

        await handler2({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.actions[0].damage_type_choices).toBeUndefined();
        expect(monster.actions[0].damage_type_primary).toBe('Piercing');
        expect(monster.actions[0].description).toBe('7 Piercing damage');
    });

    it('should not convert or tag attacks for non-Moon druid wild shape', async () => {
        const handler2 = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters: nonMoonDruidCharacters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ name: 'DruidBob', wildShapeSource: 'DruidBob' })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([
            {
                ...baseBear,
                actions: [
                    { name: 'Bite', attack_bonus: 5, damage_type_primary: 'Piercing', description: '7 Piercing damage' },
                ],
            },
        ]);

        await handler2({ name: 'DruidBob' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.actions[0].damage_type_choices).toBeUndefined();
        expect(monster.actions[0].damage_type_primary).toBe('Piercing');
        expect(monster.actions[0].description).toBe('7 Piercing damage');
    });

    it('should add lunarFormAction when present', async () => {
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({
                lunarFormAction: { name: 'Lunar Form', attack_bonus: 7, damage_type_primary: 'Radiant', description: 'Moon magic attack' },
            })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.actions.length).toBe(1);
        expect(monster.actions[0].name).toBe('Lunar Form');
    });

    it('should use druidCharacter abilities fallback when computedStats missing', async () => {
        const charactersNoComputed = [
            {
                name: 'DruidAlice',
                abilities: [
                    { name: 'Intelligence', score: 10 },
                    { name: 'Wisdom', score: 20 },
                    { name: 'Charisma', score: 8 },
                ],
                languages: 'Common',
            },
        ];
        const handler2 = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters: charactersNoComputed,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler2({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.ability_scores.int).toBe(10);
        expect(monster.ability_scores.wis).toBe(20);
        expect(monster.ability_scores.cha).toBe(8);
    });

    it('should match druid character by name with suffix', async () => {
        const charactersWithSuffix = [
            {
                name: 'DruidAlice (Wild Shape)',
                computedStats: {
                    abilities: [
                        { name: 'Intelligence', score: 18 },
                        { name: 'Wisdom', score: 16 },
                        { name: 'Charisma', score: 14 },
                    ],
                    languages: ['Common', 'Sylvan'],
                },
            },
        ];
        const handler2 = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters: charactersWithSuffix,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler2({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.ability_scores.int).toBe(18);
        expect(monster.languages).toBe('Common, Sylvan');
    });

    it('should not modify CON save for non-Moon Druid', async () => {
        const handler2 = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters: nonMoonDruidCharacters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ name: 'DruidBob', wildShapeSource: 'DruidBob' })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([
            { ...baseBear, saving_throws: { con: { modifier: 5 } } },
        ]);

        await handler2({ name: 'DruidBob' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.saving_throws.con.modifier).toBe(5);
    });

    it('should fall back to creature.currentHp when runtime currentHitPoints is null', async () => {
        mockRuntimeValues({ currentHitPoints: null });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice', currentHp: 25 });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.hit_points).toBe(25);
    });
});

describe('createNpcClickHandler - Wild Shape raw-disk druid retention (CLA-391)', () => {
    const baseRat = {
        index: 'rat',
        name: 'Rat',
        armor_class: 10,
        hit_points: 1,
        ability_scores: { str: 2, dex: 11, con: 9, int: 2, wis: 10, cha: 4 },
        ability_score_modifiers: { str: -4, dex: 0, con: -1, int: -4, wis: 0, cha: -3 },
        actions: [],
        size: 'Tiny',
        type: 'Beast',
        challenge_rating: 0,
    };

    // Raw character JSON as persisted to disk: abilities carry baseScore +
    // increases and NEVER a computed `.score`; no computedStats wrapper.
    const rawDiskDruidCharacters = [
        {
            name: 'Wild_Sage_Druid',
            rules: '2024',
            race: { name: 'Human', subrace: { name: '' } },
            languages: ['Common', 'Druidic'],
            abilities: [
                { name: 'Strength', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
                { name: 'Dexterity', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
                { name: 'Constitution', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
                { name: 'Intelligence', baseScore: 8, featIncrease: 0, backgroundIncrease: 1, miscIncrease: 0 },
                { name: 'Wisdom', baseScore: 16, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
                { name: 'Charisma', baseScore: 8, featIncrease: 0, backgroundIncrease: 1, miscIncrease: 0 },
            ],
        },
    ];

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
            characters: rawDiskDruidCharacters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
        vi.mocked(getMonsterData).mockResolvedValue(null);
        vi.mocked(npcToMonsterFormat).mockReturnValue(null);
        vi.mocked(fetchRaceData).mockResolvedValue({ name: 'Human', creature_type: 'Humanoid' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('retains druid INT/WIS/CHA derived from baseScore+increases, not the beast scores', async () => {
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ name: 'Wild_Sage_Druid', wildShapeSource: 'Wild_Sage_Druid', beastIndex: 'rat', beastName: 'Rat' })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseRat]);

        await handler({ name: 'Wild_Sage_Druid' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.ability_scores.int).toBe(9);
        expect(monster.ability_scores.wis).toBe(16);
        expect(monster.ability_scores.cha).toBe(9);
        expect(monster.ability_scores.str).toBe(2);
        expect(monster.ability_scores.dex).toBe(11);
        expect(monster.ability_score_modifiers.int).toBe(-1);
        expect(monster.ability_score_modifiers.wis).toBe(3);
        expect(monster.ability_score_modifiers.cha).toBe(-1);
        expect(monster.ability_score_modifiers.str).toBe(-4);
    });

    it('retains the druid humanoid creature type and merges languages', async () => {
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ name: 'Wild_Sage_Druid', wildShapeSource: 'Wild_Sage_Druid', beastIndex: 'rat', beastName: 'Rat' })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseRat]);

        await handler({ name: 'Wild_Sage_Druid' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.type).toBe('Humanoid');
        expect(fetchRaceData).toHaveBeenCalledWith('Human', '2024');
        expect(monster.languages).toBe('Common, Druidic');
    });

    it('keeps the beast type when race data carries no creature_type', async () => {
        vi.mocked(fetchRaceData).mockResolvedValue({ name: 'Human' });
        mockRuntimeValues();
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ name: 'Wild_Sage_Druid', wildShapeSource: 'Wild_Sage_Druid', beastIndex: 'rat', beastName: 'Rat' })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseRat]);

        await handler({ name: 'Wild_Sage_Druid' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.type).toBe('Beast');
    });
});