// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getAvailableAttackRiderManeuvers,
    getAvailableAttackRiderManeuversByTrigger,
    getAvailableSkillCheckManeuvers,
    getAttackRiderOptions,
    getAttackRiderOptionsByContext,
    getManeuversForRules,
    handleAttackRiderPrompt,
    handleSkillCheckPrompt,
} from './combatSuperiorityHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

const allManeuvers = [
    { name: 'Trip Attack', effect: 'knock_prone', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
    { name: 'Pushing Attack', effect: 'push', actionType: 'attack_rider', trigger: 'weapon_attack_hit', saveType: 'STR', value: 15 },
    { name: 'Rally', effect: 'temp_hp', actionType: 'bonus_action' },
    { name: 'Distracting Strike', effect: 'distracting_strike_advantage', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
    { name: 'Maneuvering Attack', effect: 'ally_movement', actionType: 'attack_rider', trigger: 'any', damageBonus: true },
    { name: 'Precision Attack', effect: 'attack_roll_bonus', actionType: 'attack_rider', trigger: 'any' },
    { name: 'Ambush', actionType: 'skill_check', skills: ['Stealth', 'DEX'], initiativeBonus: false },
    { name: 'Quick Insight', actionType: 'skill_check', initiativeBonus: true },
];

const makePlayerStats = (overrides = {}) => ({
    name: 'TestFighter',
    proficiency: 3,
    abilities: [
        { name: 'STR', bonus: 4 },
        { name: 'DEX', bonus: 2 },
        { name: 'CON', bonus: 1 },
        { name: 'INT', bonus: 0 },
        { name: 'WIS', bonus: 0 },
        { name: 'CHA', bonus: 0 },
    ],
    level: 5,
    rules: '2024',
    size: 'Medium',
    ...overrides,
});

// ── Shared helpers ─────────────────────────────────────────────────────

async function populateManeuverCache() {
    await getManeuversForRules('2024');
}

// ── Shared early-return setup ──────────────────────────────────────────

const makeNoManeuversRuntime = () =>
    vi.fn().mockImplementation((_playerName, key, _campaignName) => {
        if (key === 'superiorityDice') return 4;
        if (key === SELECTION_KEY) return [];
        return undefined;
    });

const makeNoDiceRuntime = () =>
    vi.fn().mockImplementation((_playerName, key, _campaignName) => {
        if (key === 'superiorityDice') return 0;
        if (key === SELECTION_KEY) return ['Trip Attack'];
        return undefined;
    });

const makeReadyRuntime = (maneuverNames = ['Trip Attack', 'Pushing Attack']) =>
    vi.fn().mockImplementation((_playerName, key, _campaignName) => {
        if (key === 'superiorityDice') return 4;
        if (key === SELECTION_KEY) return maneuverNames;
        return undefined;
    });

// ── getAvailableAttackRiderManeuvers ───────────────────────────────────

describe('getAvailableAttackRiderManeuvers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
    });

    it('returns empty when no maneuvers known or no superiority dice', async () => {
        getRuntimeValue.mockImplementation(makeNoManeuversRuntime());

        const result = await getAvailableAttackRiderManeuvers(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true }
        );

        expect(result).toEqual([]);
    });

    it('returns empty when no superiority dice even with known maneuvers', async () => {
        getRuntimeValue.mockImplementation(makeNoDiceRuntime());

        const result = await getAvailableAttackRiderManeuvers(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true }
        );

        expect(result).toEqual([]);
    });

    it('filters known attack_rider maneuvers by trigger', async () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Trip Attack', 'Maneuvering Attack']));
        await populateManeuverCache();

        const result = await getAvailableAttackRiderManeuvers(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true }
        );

        expect(result).toHaveLength(2);
        expect(result.map(m => m.name)).toEqual(['Trip Attack', 'Maneuvering Attack']);
    });
});

// ── getAvailableAttackRiderManeuversByTrigger ──────────────────────────

describe('getAvailableAttackRiderManeuversByTrigger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
    });

    it('returns empty when no maneuvers known or no superiority dice', async () => {
        getRuntimeValue.mockImplementation(makeNoManeuversRuntime());

        const result = await getAvailableAttackRiderManeuversByTrigger(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true }
        );

        expect(result).toEqual([]);
    });

    it('filters miss-triggered maneuvers when attack missed', async () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Precision Attack']));
        await populateManeuverCache();

        const result = await getAvailableAttackRiderManeuversByTrigger(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: false }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Precision Attack');
    });

    it('excludes melee-only maneuvers on ranged miss', async () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Trip Attack', 'Precision Attack']));
        await populateManeuverCache();

        const result = await getAvailableAttackRiderManeuversByTrigger(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'ranged', hit: false }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Precision Attack');
    });
});

// ── getAvailableSkillCheckManeuvers ────────────────────────────────────

describe('getAvailableSkillCheckManeuvers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
    });

    it('returns empty when no maneuvers known or no superiority dice', async () => {
        getRuntimeValue.mockImplementation(makeNoManeuversRuntime());

        const result = getAvailableSkillCheckManeuvers(
            makePlayerStats(),
            'test-campaign',
            'Stealth',
            false
        );

        expect(result).toEqual([]);
    });

    it('filters skill_check maneuvers by skill name', async () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Ambush', 'Quick Insight']));
        await populateManeuverCache();

        const result = getAvailableSkillCheckManeuvers(
            makePlayerStats(),
            'test-campaign',
            'Stealth',
            false
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Ambush');
    });

    it('returns initiative maneuvers when isInitiative is true', async () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Ambush', 'Quick Insight']));
        await populateManeuverCache();

        const result = getAvailableSkillCheckManeuvers(
            makePlayerStats(),
            'test-campaign',
            'Stealth',
            true
        );

        expect(result).toHaveLength(2);
    });
});

// ── handleAttackRiderPrompt ────────────────────────────────────────────

describe('handleAttackRiderPrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
    });

    it('returns null when no pending prompt', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await handleAttackRiderPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result).toBeNull();
    });

    it('returns null when no maneuvers known or no superiority dice', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { attackContext: { hit: true } };
            if (key === SELECTION_KEY) return [];
            return undefined;
        });

        const result = await handleAttackRiderPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result).toBeNull();
    });

    it('returns modal with available maneuvers when conditions are met', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { attackContext: { hit: true, weaponType: 'melee' } };
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            return undefined;
        });
        await populateManeuverCache();

        const result = await handleAttackRiderPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatSuperiority');
        expect(result.payload.knownManeuvers).toEqual(['Trip Attack']);
    });
});

// ── handleSkillCheckPrompt ─────────────────────────────────────────────

describe('handleSkillCheckPrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
    });

    it('returns null when no pending prompt', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await handleSkillCheckPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result).toBeNull();
    });

    it('returns null when no maneuvers known or no superiority dice', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { skillContext: { skillName: 'Stealth' } };
            if (key === SELECTION_KEY) return [];
            return undefined;
        });

        const result = await handleSkillCheckPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result).toBeNull();
    });

    it('returns modal with skill check maneuvers when conditions are met', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { skillContext: { skillName: 'Stealth', isInitiative: false } };
            if (key === SELECTION_KEY) return ['Ambush'];
            if (key === 'superiorityDice') return 4;
            return undefined;
        });

        const result = await handleSkillCheckPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatSuperiority');
        expect(result.payload.knownManeuvers).toEqual(['Ambush']);
        expect(result.payload.skillContext).toEqual({ skillName: 'Stealth', isInitiative: false });
    });
});

// ── getAttackRiderOptions ──────────────────────────────────────────────

describe('getAttackRiderOptions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
    });

    it('returns empty when no maneuvers known or no superiority dice', async () => {
        getRuntimeValue.mockImplementation(makeNoManeuversRuntime());

        const result = await getAttackRiderOptions(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true }
        );

        expect(result).toEqual([]);
    });

    it('returns formatted options for known attack rider maneuvers', async () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Trip Attack', 'Pushing Attack']));

        await handleAttackRiderPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        const result = await getAttackRiderOptions(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(
            expect.objectContaining({
                name: 'Trip Attack',
                effect: 'knock_prone',
                damageBonus: false,
                saveType: null,
                saveAbility: null,
                conditionInflicted: null,
                value: null,
                range: null,
                dieExpression: 'superiority_die',
            })
        );
    });
});

// ── getAttackRiderOptionsByContext ─────────────────────────────────────

describe('getAttackRiderOptionsByContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
    });

    it('returns empty when no maneuvers known or no superiority dice', async () => {
        getRuntimeValue.mockImplementation(makeNoManeuversRuntime());

        const result = await getAttackRiderOptionsByContext(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true },
            'hit'
        );

        expect(result).toEqual([]);
    });

    it('includes maneuvers without trigger for any context', async () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Maneuvering Attack']));

        await handleAttackRiderPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        const result = await getAttackRiderOptionsByContext(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'ranged', hit: false },
            'miss'
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Maneuvering Attack');
    });
});
