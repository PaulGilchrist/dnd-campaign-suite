// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeManeuver } from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

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
/*  executeManeuver — attack/bonus action effects                      */
/* ------------------------------------------------------------------ */

describe('executeManeuver — attack/bonus action effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles ally_movement effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Maneuvering Attack'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Maneuvering Attack'
        );

        expect(result.payload.description).toContain('Reaction to move');
    });

    it('handles attack_roll_bonus effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Precision Attack'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Precision Attack'
        );

        expect(result.payload.description).toContain('Add 4 to the attack roll');
    });

    it('handles secondary_damage effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Sweeping Attack'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Sweeping Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/No other creature is within 5 feet of Goblin/);
    });

    it('handles ac_bonus_disengage effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Evasive Footwork'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Evasive Footwork'
        );

        expect(result.payload.description).toContain('Disengage action');
        expect(result.payload.description).toContain('+4 AC');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'baitAndSwitchActive', true, 'test-campaign');
    });

    it('handles advantage_and_damage effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Feinting Attack'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Feinting Attack'
        );

        expect(result.payload.description).toContain('Advantage on your next attack roll');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'feintingAttackDieValue', 4, 'test-campaign');
    });

    it('handles dash_and_damage effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Lunging Attack'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Lunging Attack'
        );

        expect(result.payload.description).toContain('Dash action');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'lungingAttackDieValue', 4, 'test-campaign');
    });

    it('returns popup with logEntries for basic maneuver', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Trip Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].characterName).toBe('TestFighter');
    });

    it('uses custom uses_max from automation config', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 3;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority', uses_max: 5 } },
            makePlayerStats(),
            'test-campaign',
            'Trip Attack'
        );

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 2, 'test-campaign');
    });

    it('uses Relentless when passive exists and not used this round', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            if (key === 'relentlessUsedRound') return undefined;
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Trip Attack', automation: { type: 'combat_superiority' } },
            makePlayerStats({
                automation: { passives: [{ type: 'passive_rule', effect: 'relentless' }] },
            }),
            'test-campaign',
            'Trip Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Relentless');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'relentlessUsedRound', 1, 'test-campaign');
    });

    it('MN-008: Feinting Attack — regression test for advantage_and_damage effect', async () => {
        const mockTargetEffects = [];
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Feinting Attack'];
            if (key === 'targetEffects') return mockTargetEffects;
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Feinting Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Advantage on your next attack roll');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'feintingAttackDieValue', 4, 'test-campaign');

        const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
            call => call[1] === 'targetEffects'
        );
        expect(targetEffectsCalls.length).toBeGreaterThan(0);
        const lastTargetEffectCall = targetEffectsCalls[targetEffectsCalls.length - 1];
        const newEffect = lastTargetEffectCall[2].slice(-1)[0];
        expect(newEffect.effect).toBe('next_attack_advantage');
        expect(newEffect.target).toBe('TestFighter');
        expect(newEffect.vexTarget).toBe('Goblin');
        expect(newEffect.duration).toBe('until_end_of_turn');

        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].characterName).toBe('TestFighter');
        expect(result.logEntries[0].abilityName).toBe('Feinting Attack');
    });
});
