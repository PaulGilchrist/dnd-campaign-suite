// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAttackRiderManeuver } from './combatSuperiorityHandler.js';
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
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin' }] }),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin' }] }),
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

vi.mock('../../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(async () => {}),
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
        expect(result.dieValue).toBe(4);
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
        expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
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

    it('calls applyConditionToTarget with null combatSummary when getCombatContext returns null', async () => {
        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(null);

        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            if (key === 'activeConditions') return [];
            return undefined;
        });

        const consoleSpy = vi.spyOn(console, 'error');

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('Target made STR save DC 15: Failure');
        expect(result.payload.description).toContain('fell Prone');
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[combatSuperiority] Failed to get combatSummary')
        );
        consoleSpy.mockRestore();
    });
});

// ── executeAttackRiderManeuver - attack_rider options (Brutal Strike) ─

describe('executeAttackRiderManeuver - attack_rider options', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles attack_rider options with secondary_damage effect and targetEffects', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            if (key === 'targetEffects') return [];
            return undefined;
        });

        const combatContext = {
            creatures: [{ name: 'Goblin' }],
        };

        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(combatContext);

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Added 4 to the damage roll');
    });

    it('returns popup with description when no targetName for sizeLimit check', async () => {
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
            { weaponType: 'melee', hit: true }
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Added 4 to the damage roll');
    });

    it('returns size limit error popup when target is too large', async () => {
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

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats({ size: 'Medium' }),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true, targetName: 'Ogre' }
        );

        expect(result.type).toBe('popup');
    });
});

// ── executeAttackRiderManeuver - saveType without target ───────────────

describe('executeAttackRiderManeuver - saveType without target', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows save description when maneuver has saveType but no target', async () => {
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
            { weaponType: 'melee', hit: true }
        );

        expect(result.type).toBe('popup');
    });
});

// ── executeAttackRiderManeuver - conditionInflicted ────────────────────

describe('executeAttackRiderManeuver - conditionInflicted', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles conditionInflicted on save failure', async () => {
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
    });
});

// ── executeAttackRiderManeuver - save success ──────────────────────────

describe('executeAttackRiderManeuver - save success', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles save success (no effect applied)', async () => {
        const savePrompt = await import('../../../../services/automation/common/savePrompt.js');
        savePrompt.createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: true }),
        });

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
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('Target made STR save DC 15: Success');
    });
});

// ── executeAttackRiderManeuver - no secondary targets ──────────────────

describe('executeAttackRiderManeuver - no secondary targets', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup when no secondary targets available', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Sweeping Attack'];
            return undefined;
        });

        const combatContext = {
            creatures: [
                { name: 'Goblin' },
                { name: 'TestFighter' },
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

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/No other creature is within 5 feet of Goblin/);
    });
});
