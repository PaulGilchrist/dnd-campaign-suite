// @maintained-by-ai: 2026-10-15
// executeAttackRider.js lane — executeAttackRiderManeuver() direct contracts:
// guard short-circuits (not-found / no-dice), die roll + expend, each save-outcome
// effect branch (prone / push / goad / frightened / disarm / distracting /
// ally_movement), the Brutal Strike attack_rider-options branch, the Sweeping
// Attack chooser (modal + no-candidates popup), and the null-combatSummary guard.
// Deliberately NOT duplicated here: the size gate (executeAttackRider.mn015 +
// validateSizeLimit.mn015), save-DC resolution and the MN-020 success-branch log
// (executeAttackRider.mn020), the Maneuvering grant internals
// (executeAttackRider.maneuveringGrant), and the executeManeuver router's own
// effect implementations (combatSuperiorityHandlerManeuver-attack).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAttackRiderManeuver } from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async (_rules) => [
        { name: 'Trip Attack', effect: 'prone', trigger: 'weapon_attack_hit', saveType: 'STR', conditionInflicted: 'Prone', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Pushing Attack', effect: 'push', trigger: 'weapon_attack_hit', saveType: 'STR', value: 15, damageBonus: true, actionType: 'attack_rider' },
        { name: 'Goading Attack', effect: 'goad', trigger: 'weapon_attack_hit', saveType: 'WIS', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Disarming Attack', effect: 'disarm', trigger: 'weapon_attack_hit', saveType: 'STR', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Menacing Attack', effect: 'frightened', trigger: 'weapon_attack_hit', saveType: 'WIS', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Distracting Strike', effect: 'distracting_strike_advantage', trigger: 'weapon_attack_hit', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Maneuvering Attack', effect: 'ally_movement', trigger: 'weapon_attack_hit', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Precision Attack', effect: 'attack_roll_bonus', trigger: 'attack_roll_miss', actionType: 'attack_rider' },
        { name: 'Sweeping Attack', effect: 'secondary_damage', trigger: 'melee_weapon_attack_hit', damageBonus: false, actionType: 'attack_rider' },
        // MN-015 real-data shape carries sizeLimit ("large_or_smaller") — omitted here
        // so these lane's Trip/Push tests never hit the size gate (getMonsterData is
        // unmocked); the gate itself is pinned in executeAttackRider.mn015 /
        // validateSizeLimit.mn015.
        { name: 'Brutal Strike', effect: 'secondary_damage', trigger: 'strength_attack_hit_after_reckless', damageBonus: true, actionType: 'attack_rider', automation: { type: 'attack_rider', damageType: 'same_as_weapon', options: [{ name: 'Forceful Blow', effect: 'push_15ft' }] } },
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

const withDice = (selection, extra = {}) =>
    (_playerName, key, _campaignName) => {
        if (key === 'superiorityDice') return extra.superiorityDice ?? 4;
        if (key === SELECTION_KEY) return [selection];
        if (key === 'targetEffects' || key === 'activeConditions') return [];
        return extra[key];
    };

// clearAllMocks does not restore mockResolvedValue implementations, so tests
// that mutate getCombatContext (null combatSummary, sweeping candidates) would
// leak into later tests — re-arm the default combat context before every test.
const resetCombatContext = async () => {
    const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
};

// ── executeAttackRiderManeuver ─────────────────────────────────────────

describe('executeAttackRiderManeuver', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await resetCombatContext();
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
        getRuntimeValue.mockImplementation(withDice('Trip Attack', { superiorityDice: 0 }));

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
        getRuntimeValue.mockImplementation(withDice('Trip Attack'));

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
        getRuntimeValue.mockImplementation(withDice('Trip Attack'));

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
        getRuntimeValue.mockImplementation(withDice('Pushing Attack'));

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
        getRuntimeValue.mockImplementation(withDice('Goading Attack'));

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
        getRuntimeValue.mockImplementation(withDice('Menacing Attack'));

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Menacing Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('Frightened');
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['frightened']), 'test-campaign');
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
            targetName: 'Goblin',
            effects: [{ type: 'condition', condition: 'frightened' }],
            rounds: 2,
        }));
    });

    it('handles distracting_strike_advantage effect', async () => {
        getRuntimeValue.mockImplementation(withDice('Distracting Strike'));

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Distracting Strike',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('next attack against Goblin');
        expect(result.payload.description).toContain('Advantage');
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
            expect.objectContaining({ effect: 'distracting_strike_advantage', target: 'Goblin' }),
        ]), 'test-campaign');
    });

    it('returns sweeping chooser modal for secondary_damage effect', async () => {
        getRuntimeValue.mockImplementation(withDice('Sweeping Attack'));

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
        getRuntimeValue.mockImplementation(withDice('Disarming Attack'));

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Disarming Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.payload.description).toContain('dropped the object');
    });

    it('appends ally movement reaction text for ally_movement effect', async () => {
        getRuntimeValue.mockImplementation(withDice('Maneuvering Attack'));

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Maneuvering Attack',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Reaction to move');
    });

    it('logs console error but still resolves when getCombatContext returns null', async () => {
        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue(null);

        getRuntimeValue.mockImplementation(withDice('Trip Attack'));

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

    it('saveType with no target appends the save prompt description with conditionInflicted', async () => {
        getRuntimeValue.mockImplementation(withDice('Trip Attack'));

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true }
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Target must make a STR save DC 15 or gain Prone condition');
        expect(result.payload.description).toContain('Added 4 to the damage roll');
    });
});

// ── executeAttackRiderManeuver - attack_rider options (Brutal Strike) ─

describe('executeAttackRiderManeuver - attack_rider options', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await resetCombatContext();
    });

    it('Brutal Strike: writes secondary_damage targetEffect and applies rider damage', async () => {
        getRuntimeValue.mockImplementation(withDice('Brutal Strike'));

        const result = await executeAttackRiderManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Brutal Strike',
            { weaponType: 'melee', hit: true, targetName: 'Goblin', damageType: 'slashing' }
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Rolled d8 for 4');
        expect(result.payload.description).toContain('Goblin takes 4 force damage');
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
            expect.objectContaining({ effect: 'secondary_damage', target: 'Goblin', value: 4 }),
        ]), 'test-campaign');
        expect(result.logEntries?.[0]).toMatchObject({
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'Brutal Strike',
        });
    });
});

// ── executeAttackRiderManeuver - no secondary targets ──────────────────

describe('executeAttackRiderManeuver - no secondary targets', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await resetCombatContext();
    });

    it('returns popup when no secondary targets available', async () => {
        getRuntimeValue.mockImplementation(withDice('Sweeping Attack'));

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
