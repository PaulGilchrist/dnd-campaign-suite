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
    getRuntimeValue: vi.fn(),
}));

const baseDragon = {
    index: 'dragon',
    name: 'Dragon',
    armor_class: 18,
    hit_points: 100,
    ability_scores: { str: 20, dex: 10, con: 18, int: 10, wis: 14, cha: 16 },
    saving_throws: {},
    actions: [],
    size: 'Large',
    type: 'Dragon',
    challenge_rating: 3,
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
    shapechangeSource: 'DruidAlice',
    shapechangeForm: { index: 'dragon', challengeRating: 5 },
    ac: 18,
    size: 'Large',
    speed: { fly: '60 ft.', walk: '40 ft.' },
    currentHp: 50,
    ...overrides,
});

describe('createNpcClickHandler - Shapechange form path', () => {
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

    it('should load shapechange form with merged properties from base monster and runtime creature', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 50;
            if (prop === 'shapechangeTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseDragon]);

        await handler({ name: 'DruidAlice' });

        expect(setViewingMonster).toHaveBeenCalled();
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('DruidAlice');
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.name).toBe('Dragon');
        expect(monster.hit_points).toBe(50);
        expect(monster.armor_class).toBe(18);
        expect(monster.size).toBe('Large');
        expect(monster.challenge_rating).toBe(5);
        expect(monster.speed).toEqual({ fly: '60 ft.', walk: '40 ft.' });
    });

    it('should use formName from runtimeCreature when available instead of base monster name', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'currentHitPoints') return 80;
            if (prop === 'shapechangeTempHp') return 0;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature({ formName: 'Ancient Red Dragon', currentHp: 80, ac: 22 })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseDragon]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.name).toBe('Ancient Red Dragon');
    });

    it('should set shapechangeTempHp when positive', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop, _campaign) => {
            if (prop === 'shapechangeTempHp') return 20;
            if (prop === 'currentHitPoints') return 50;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeCombatCreature()],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseDragon]);

        await handler({ name: 'DruidAlice' });

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.hit_points_temp).toBe(20);
    });
});
