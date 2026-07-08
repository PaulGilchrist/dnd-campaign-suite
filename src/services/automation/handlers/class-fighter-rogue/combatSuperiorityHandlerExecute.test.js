// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    executeAttackRiderManeuver,
    executeBonusActionManeuver,
    executeGrantAttackManeuver,
    executeSweepingAttack,
    executeMovementManeuver,
    executeSkillCheckManeuver,
    executeCommandingPresenceReaction,
    executeBaitAndSwitchChoice,
    executeCommanderStrikeChoice,
    executeRallyChoice,
} from './combatSuperiorityHandler.js';
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
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../services/automation/common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue(null),
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



// ── executeAttackRiderManeuver ─────────────────────────────────────────

describe('executeAttackRiderManeuver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns error popup when maneuver not found', async () => {
        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Nonexistent Maneuver',
            { weaponType: 'melee', hit: true }
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('not found');
    });

    it('returns error popup when no dice and no relentless', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            return undefined;
        });

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true }
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No Superiority Dice remaining');
    });

    it('rolls die, deducts superiority die, and returns popup with description', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            return undefined;
        });

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin', damageType: 'slashing' }
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Rolled');
        expect(result.payload.description).toContain('Added 4 to the damage roll');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');
    });

    it('handles save failure with prone effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            if (key === 'activeConditions') return [];
            return undefined;
        });

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('Target made STR save DC 15: Failure');
        expect(result.payload.description).toContain('fell Prone');
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['prone']), 'test-campaign');
    });

    it('handles save failure with push effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Pushing Attack'];
            if (key === 'targetEffects') return [];
            return undefined;
        });

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Pushing Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('was pushed 15 feet');
        expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
            expect.objectContaining({ effect: 'push', value: 15 }),
        ]), 'test-campaign');
    });

    it('handles save failure with goad effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Goading Attack'];
            if (key === 'targetEffects') return [];
            return undefined;
        });

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Goading Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('Disadvantage on attacks against targets other than you');
    });

    it('handles save failure with frightened effect and expiration', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Menacing Attack'];
            if (key === 'activeConditions') return [];
            return undefined;
        });

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Menacing Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('Frightened');
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['frightened']), 'test-campaign');
    });

    it('handles distracting_strike_advantage effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Distracting Strike'];
            if (key === 'targetEffects') return [];
            return undefined;
        });

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Distracting Strike',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('next attack against Goblin');
        expect(result.payload.description).toContain('Advantage');
    });

    it('handles secondary_damage (sweeping attack) by setting pending state', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Sweeping Attack'];
            return undefined;
        });

        const combatContext = {
            creatures: [
                { name: 'Goblin', position: { gridX: 1, gridY: 1 } },
                { name: 'Skeleton', position: { gridX: 2, gridY: 1 } },
            ],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Sweeping Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin', damageType: 'slashing' }
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('sweepingAttackTarget');
    });

    it('handles disarm effect description', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Disarming Attack'];
            return undefined;
        });

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Disarming Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('dropped the object');
    });

    it('returns modal for ally_movement effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Maneuvering Attack'];
            return undefined;
        });

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Maneuvering Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('Reaction to move');
    });
});

// ── executeBonusActionManeuver ─────────────────────────────────────────

describe('executeBonusActionManeuver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with description for ac_bonus_disengage', async () => {
        const result = await executeBonusActionManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Evasive Footwork'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Disengage action');
        expect(result.payload.description).toContain('+4 AC');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'baitAndSwitchActive', true, 'test-campaign');
    });

    it('returns popup with description for advantage_and_damage', async () => {
        const result = await executeBonusActionManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Feinting Attack'
        );

        expect(result.payload.description).toContain('Advantage on your next attack roll');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'feintingAttackDieValue', 4, 'test-campaign');
    });

    it('returns popup with description for dash_and_damage', async () => {
        const result = await executeBonusActionManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Lunging Attack'
        );

        expect(result.payload.description).toContain('Dash action');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'lungingAttackDieValue', 4, 'test-campaign');
    });

    it('returns modal for temp_hp (Rally) when allies exist', async () => {
        const combatContext = {
            creatures: [
                { name: 'TestFighter' },
                { name: 'Ally1' },
                { name: 'Ally2' },
            ],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        const result = await executeBonusActionManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Rally'
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('rallyChoice');
        expect(result.payload.allyOptions).toHaveLength(2);
        expect(result.payload.dieValue).toBe(4);
    });
});

// ── executeGrantAttackManeuver ─────────────────────────────────────────

describe('executeGrantAttackManeuver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns modal with ally options when allies exist', async () => {
        const combatContext = {
            creatures: [
                { name: 'TestFighter' },
                { name: 'Ally1' },
            ],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        const result = await executeGrantAttackManeuver(
            { name: "Commander's Strike", automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            "Commander's Strike"
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('commanderStrikeChoice');
        expect(result.payload.options).toHaveLength(1);
    });

    it('returns error popup when no allies available', async () => {
        const combatContext = {
            creatures: [{ name: 'TestFighter' }],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        const result = await executeGrantAttackManeuver(
            { name: "Commander's Strike", automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            "Commander's Strike"
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No allies available');
    });
});

// ── executeSweepingAttack ──────────────────────────────────────────────

describe('executeSweepingAttack', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns error when no pending data', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await executeSweepingAttack(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Goblin'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No pending data');
    });

    it('returns error when secondary target not in pending list', async () => {
        getRuntimeValue.mockReturnValue({
            dieValue: 4,
            damageType: 'slashing',
            targetName: 'Goblin',
            secondaryTargets: [{ name: 'Skeleton' }],
        });

        const result = await executeSweepingAttack(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Goblin'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('not a valid secondary target');
    });

    it('applies damage to secondary target when valid', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingSweepingAttack') return {
                dieValue: 4,
                damageType: 'slashing',
                targetName: 'Goblin',
                secondaryTargets: [{ name: 'Skeleton' }],
            };
            if (key === 'targetEffects') return [];
            return undefined;
        });

        const combatContext = {
            creatures: [{ name: 'Skeleton' }],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        const result = await executeSweepingAttack(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Skeleton'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Skeleton takes');
        expect(result.payload.description).toContain('slashing damage');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSweepingAttack', null, 'test-campaign');
    });
});

// ── executeMovementManeuver ────────────────────────────────────────────

describe('executeMovementManeuver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with AC bonus description', async () => {
        const result = await executeMovementManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Bait and Switch'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('+4 AC');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
    });
});

// ── executeSkillCheckManeuver ──────────────────────────────────────────

describe('executeSkillCheckManeuver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rolls die, stores pending bonus, and returns popup', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Ambush'];
            return undefined;
        });

        const result = await executeSkillCheckManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Ambush'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Add 4 to your next');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', 4, 'test-campaign');
        expect(result.logEntries).toHaveLength(1);
    });

    it('logs the ability use entry', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Tactical Assessment'];
            return undefined;
        });

        const result = await executeSkillCheckManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Tactical Assessment'
        );

        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].characterName).toBe('TestFighter');
        expect(result.logEntries[0].abilityName).toBe('Tactical Assessment');
    });
});

// ── executeCommandingPresenceReaction ──────────────────────────────────

describe('executeCommandingPresenceReaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with disadvantage description', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Commanding Presence'];
            if (key === 'activeConditions') return [];
            return undefined;
        });

        const result = await executeCommandingPresenceReaction(
            {
                name: 'Test',
                automation: {
                    type: 'combat_superiority',
                    targetName: 'Goblin',
                    reactionEffect: 'disadvantage_next_attack',
                    reactionDuration: 'until_end_of_next_turn',
                },
            },
            makePlayerStats(),
            'test-campaign',
            'Commanding Presence'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Disadvantage on their next attack roll');
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['disadvantage']), 'test-campaign');
    });

    it('handles save_disadvantage reaction effect', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Commanding Presence'];
            return undefined;
        });

        const result = await executeCommandingPresenceReaction(
            {
                name: 'Test',
                automation: {
                    type: 'combat_superiority',
                    targetName: 'Goblin',
                    reactionEffect: 'save_disadvantage',
                },
            },
            makePlayerStats(),
            'test-campaign',
            'Commanding Presence'
        );

        expect(result.payload.description).toContain('Disadvantage on their next saving throw');
    });
});

// ── executeBaitAndSwitchChoice ─────────────────────────────────────────

describe('executeBaitAndSwitchChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns error when no target selected', async () => {
        const result = await executeBaitAndSwitchChoice(
            { dieValue: 4, maneuverName: 'Bait and Switch' },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
    });

    it('sets bait and switch state on chosen target', async () => {
        const result = await executeBaitAndSwitchChoice(
            { dieValue: 4, maneuverName: 'Bait and Switch' },
            makePlayerStats(),
            'test-campaign',
            'Ally1'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Ally1 gains +4 AC');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'baitAndSwitchActive', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'baitAndSwitchBonus', 4, 'test-campaign');
    });
});

// ── executeCommanderStrikeChoice ───────────────────────────────────────

describe('executeCommanderStrikeChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns error when no target selected', async () => {
        const result = await executeCommanderStrikeChoice(
            { dieValue: 4, maneuverName: "Commander's Strike" },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
    });

    it('sets commander strike state on chosen ally', async () => {
        const result = await executeCommanderStrikeChoice(
            { dieValue: 4, maneuverName: "Commander's Strike" },
            makePlayerStats(),
            'test-campaign',
            'Ally1'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Ally1 will add 4 to their next attack');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'commanderStrikeActive', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'commanderStrikeBonus', 4, 'test-campaign');
    });
});

// ── executeRallyChoice ─────────────────────────────────────────────────

describe('executeRallyChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns error when no target selected', async () => {
        const result = await executeRallyChoice(
            { dieValue: 4, maneuverName: 'Rally' },
            makePlayerStats(),
            'test-campaign',
            null,
            8,
            4,
            'Rally description'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
    });

    it('sets temp HP on chosen ally', async () => {
        const result = await executeRallyChoice(
            { dieValue: 4, maneuverName: 'Rally' },
            makePlayerStats(),
            'test-campaign',
            'Ally1',
            8,
            4,
            'Rally description'
        );

        expect(result.type).toBe('popup');
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].description).toContain('gains 8 temporary hit points');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'tempHp', 8, 'test-campaign');
    });
});
