import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeManeuver } from './combatSuperiorityHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async (_rules) => [
        { name: 'Trip Attack', effect: 'prone', trigger: 'weapon_attack_hit', saveType: 'STR', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Pushing Attack', effect: 'push', trigger: 'weapon_attack_hit', saveType: 'STR', value: 15, damageBonus: true, actionType: 'attack_rider' },
        { name: 'Goading Attack', effect: 'goad', trigger: 'weapon_attack_hit', saveType: 'WIS', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Disarming Attack', effect: 'disarm', trigger: 'weapon_attack_hit', saveType: 'STR', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Menacing Attack', effect: 'frightened', trigger: 'weapon_attack_hit', saveType: 'WIS', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Distracting Strike', effect: 'distracting_strike_advantage', trigger: 'weapon_attack_hit', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Maneuvering Attack', effect: 'ally_movement', trigger: 'weapon_attack_hit', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Precision Attack', effect: 'attack_roll_bonus', trigger: 'attack_roll_miss', actionType: 'attack_rider' },
        { name: 'Sweeping Attack', effect: 'secondary_damage', trigger: 'melee_weapon_attack_hit', damageBonus: false, actionType: 'attack_rider' },
        { name: 'Evasive Footwork', effect: 'ac_bonus_disengage', actionType: 'bonus_action' },
        { name: 'Feinting Attack', effect: 'advantage_and_damage', actionType: 'bonus_action' },
        { name: 'Lunging Attack', effect: 'dash_and_damage', actionType: 'bonus_action' },
        { name: 'Rally', effect: 'temp_hp', actionType: 'bonus_action', extraHpExpression: '1d4' },
        { name: "Commander's Strike", effect: null, actionType: 'grant_attack' },
        { name: 'Bait and Switch', effect: 'ac_bonus_and_swap', actionType: 'movement' },
        { name: 'Ambush', actionType: 'skill_check', skills: ['Stealth'], initiativeBonus: true, dieExpression: 'superiority_die' },
        { name: 'Tactical Assessment', actionType: 'skill_check', skills: ['Insight'], ability: 'Wisdom', dieExpression: 'superiority_die' },
        { name: 'Commanding Presence', actionType: 'skill_check', reactionSaveType: 'WIS', reactionEffect: 'disadvantage_next_attack', reactionDuration: 'until_end_of_next_turn' },
        { name: 'Parry', effect: 'damage_reduction', actionType: 'reaction' },
        { name: 'Riposte', effect: 'melee_attack_reaction', actionType: 'reaction' },
    ]),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin' }] }),
}));

vi.mock('../../../../services/automation/common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue({ target: { name: 'Goblin' } }),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 4 })),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => {
        if (expr === 'superiority_die') return 8;
        if (expr === '1d6') return 6;
        return expr;
    }),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../../services/automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(() => ({
        promise: Promise.resolve({ success: false }),
    })),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 4 })),
}));

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => 5),
    rangeToFeet: vi.fn((range) => {
        if (range === '5_ft') return 5;
        if (range === '8_ft') return 8;
        return 5;
    }),
}));

vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

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
    attacks: [{ name: 'Longsword', weaponType: 'melee', damage: '1d8+4', damageType: 'slashing' }],
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

/* ------------------------------------------------------------------ */
/*  executeManeuver — modal/reaction/skill_check effects               */
/* ------------------------------------------------------------------ */

describe('executeManeuver — modal/reaction/skill_check effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles grant_attack by showing ally selection modal', async () => {
        const combatContext = {
            creatures: [
                { name: 'TestFighter' },
                { name: 'Ally1' },
            ],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ["Commander's Strike"];
            return undefined;
        });

        const result = await executeManeuver(
            { name: "Commander's Strike", automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            "Commander's Strike"
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('commanderStrikeChoice');
        expect(result.payload.options).toHaveLength(1);
    });

    it('handles ac_bonus_and_swap by showing bait and switch modal', async () => {
        const combatContext = {
            creatures: [
                { name: 'TestFighter' },
                { name: 'Ally1' },
            ],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Bait and Switch'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Bait and Switch', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Bait and Switch'
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('baitAndSwitchChoice');
        expect(result.payload.options).toHaveLength(2);
    });

    it('handles temp_hp (Rally) by showing ally selection modal', async () => {
        const combatContext = {
            creatures: [
                { name: 'TestFighter' },
                { name: 'Ally1' },
            ],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Rally'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Rally', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Rally'
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('rallyChoice');
        expect(result.payload.allyOptions).toHaveLength(1);
    });

    it('handles temp_hp when no allies available', async () => {
        const combatContext = {
            creatures: [{ name: 'TestFighter' }],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Rally'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Rally', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Rally'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No allies available to receive Rally');
    });

    it('handles damage_reduction effect with Parry', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Parry'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Parry', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Parry'
        );

        expect(result.payload.description).toContain('Damage reduced by');
        expect(result.payload.description).toContain('HP restored');
    });

    it('handles melee_attack_reaction (Riposte) with attack_roll return', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Riposte'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Riposte', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Riposte'
        );

        expect(result.type).toBe('attack_roll');
        expect(result.payload.attack).toBeDefined();
        expect(result.context).toBeDefined();
        expect(result.context.superiorityDieValue).toBe(4);
    });

    it('handles melee_attack_reaction when no attacks available', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Riposte'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Riposte', automation: { type: 'combat_superiority' } },
            makePlayerStats({ attacks: [] }),
            'test-campaign',
            'Riposte'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No melee attack available');
    });

    it('handles skill_check actionType', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Tactical Assessment'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Tactical Assessment', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Tactical Assessment'
        );

        expect(result.payload.description).toContain('Add 4 to the ability check');
    });

    it('handles sizeLimit validation - target too large', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            return undefined;
        });

        const combatContext = {
            creatures: [{ name: 'Ogre', size: 'Large' }],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats({ size: 'Medium' }),
            'test-campaign',
            'Trip Attack'
        );

        expect(result.type).toBe('popup');
    });
});
