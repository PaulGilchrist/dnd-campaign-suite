// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    executeSweepingAttack,
    executeBaitAndSwitchChoice,
    executeCommanderStrikeChoice,
    executeRallyChoice,
    validateSizeLimit,
} from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';
import * as expirations from '../../../../services/rules/effects/expirations.js';
import * as tempHpService from '../../../../services/automation/handlers/buffs/tempHpService.js';

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
    loadMonsters: vi.fn(async () => []),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin' }] }),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin' }] }),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 4 })),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

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

// ── executeSweepingAttack ──────────────────────────────────────────────

describe('executeSweepingAttack', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with error when no pending data', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await executeSweepingAttack(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Goblin'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Sweeping Attack');
        expect(result.payload.description).toContain('No pending data');
        expect(result.payload.description).toContain('attack rider');
    });

    it('returns popup with error when secondary target not in pending list', async () => {
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
        expect(result.payload.name).toBe('Sweeping Attack');
        expect(result.payload.description).toContain('Goblin is not a valid secondary target');
    });

    it('reuses the original attack roll vs the second AC, applies damage on hit, clears pending', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingSweepingAttack') return {
                dieValue: 4,
                damageType: 'slashing',
                primaryTarget: 'Goblin',
                targetName: 'Goblin',
                originalTotal: 15,
                originalD20Roll: 11,
                attackBonus: 4,
                secondaryTargets: [{ name: 'Skeleton', ac: 11 }],
            };
            if (key === 'targetEffects') return [];
            return undefined;
        });

        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Skeleton', ac: 11 }],
        });

        const result = await executeSweepingAttack(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Skeleton'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Sweeping Attack');
        expect(result.payload.description).toContain('hits Skeleton');
        expect(result.payload.description).toContain('slashing');
        expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.objectContaining({ creatures: [{ name: 'Skeleton', ac: 11 }] }), 'Skeleton', 4, ['slashing'], 'test-campaign', [], { ignoreResistance: false, attackerName: 'TestFighter' });
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSweepingAttack', null, 'test-campaign');
    });

    it('MISSES (no damage) when the original roll is below the second AC', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingSweepingAttack') return {
                dieValue: 4,
                damageType: 'slashing',
                primaryTarget: 'Goblin',
                targetName: 'Goblin',
                originalTotal: 8,
                originalD20Roll: 4,
                attackBonus: 4,
                secondaryTargets: [{ name: 'Skeleton', ac: 11 }],
            };
            if (key === 'targetEffects') return [];
            return undefined;
        });

        damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Skeleton', ac: 11 }] });

        const result = await executeSweepingAttack(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Skeleton'
        );

        expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
        expect(result.payload.description).toMatch(/misses Skeleton/i);
    });

    it('uses applyDamageToTarget finalDamage as the applied amount', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingSweepingAttack') return {
                dieValue: 6,
                damageType: 'bludgeoning',
                primaryTarget: 'Goblin',
                targetName: 'Goblin',
                originalTotal: 20,
                originalD20Roll: 14,
                attackBonus: 6,
                secondaryTargets: [{ name: 'Ogre', ac: 11 }],
            };
            if (key === 'targetEffects') return [];
            return undefined;
        });

        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ogre', ac: 11 }],
        });
        applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 2 });

        const result = await executeSweepingAttack(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Ogre'
        );

        expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.objectContaining({ creatures: [{ name: 'Ogre', ac: 11 }] }), 'Ogre', 6, ['bludgeoning'], 'test-campaign', [], { ignoreResistance: false, attackerName: 'TestFighter' });
        expect(result.payload.description).toContain('hits Ogre');
        expect(result.payload.description).toContain('2 bludgeoning damage');
    });

    it('registers a secondary_damage targetEffect on a hit via setRuntimeValue', async () => {
        applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 4 });
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingSweepingAttack') return {
                dieValue: 4,
                damageType: 'slashing',
                primaryTarget: 'Goblin',
                targetName: 'Goblin',
                originalTotal: 15,
                originalD20Roll: 11,
                attackBonus: 4,
                secondaryTargets: [{ name: 'Skeleton', ac: 11 }],
            };
            if (key === 'targetEffects') return [{ target: 'Existing', effect: 'prone' }];
            return undefined;
        });

        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Skeleton', ac: 11 }],
        });

        await executeSweepingAttack(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Skeleton'
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                { target: 'Existing', effect: 'prone' },
                expect.objectContaining({
                    target: 'Skeleton',
                    source: 'Sweeping Attack',
                    effect: 'secondary_damage',
                    value: 4,
                    damageType: 'slashing',
                    duration: 'instant',
                }),
            ]),
            'test-campaign'
        );
    });
});

// ── executeBaitAndSwitchChoice ─────────────────────────────────────────

describe('executeBaitAndSwitchChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with error when required args are null', async () => {
        let result = await executeBaitAndSwitchChoice(
            { dieValue: 4, maneuverName: 'Bait and Switch' },
            makePlayerStats(),
            'test-campaign',
            null
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Bait and Switch');
        expect(result.payload.description).toContain('No target selected');

        result = await executeBaitAndSwitchChoice(
            { dieValue: 4, maneuverName: 'Bait and Switch' },
            null,
            'test-campaign',
            'Ally1'
        );
        expect(result.payload.description).toContain('No target selected');

        result = await executeBaitAndSwitchChoice(
            { dieValue: 4, maneuverName: 'Bait and Switch' },
            makePlayerStats(),
            null,
            'Ally1'
        );
        expect(result.payload.description).toContain('No target selected');
    });

    it('sets bait and switch state and expiration on chosen target', async () => {
        const result = await executeBaitAndSwitchChoice(
            { dieValue: 4, maneuverName: 'Bait and Switch' },
            makePlayerStats(),
            'test-campaign',
            'Ally1'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Bait and Switch');
        expect(result.payload.description).toContain('Ally1 gains +4 AC');
        expect(result.payload.description).toContain("start of TestFighter's next turn");
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'baitAndSwitchActive', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'baitAndSwitchBonus', 4, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'baitAndSwitchSource', 'Bait and Switch', 'test-campaign');
        expect(expirations.addExpiration).toHaveBeenCalledWith(
            'TestFighter',
            'Ally1',
            expect.arrayContaining([{ type: 'bait_and_switch_clear' }]),
            'test-campaign',
            undefined,
            'TestFighter'
        );
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].characterName).toBe('TestFighter');
        expect(result.logEntries[0].abilityName).toBe('Bait and Switch');
    });

    it('uses default maneuver name when not provided', async () => {
        const result = await executeBaitAndSwitchChoice(
            { dieValue: 6 },
            makePlayerStats(),
            'test-campaign',
            'Ally1'
        );

        expect(result.payload.name).toBe('Bait and Switch');
        expect(result.payload.description).toContain('Ally1 gains +6 AC');
        expect(result.logEntries[0].description).toContain('Bait and Switch');
    });
});

// ── executeCommanderStrikeChoice ───────────────────────────────────────

describe('executeCommanderStrikeChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with error when required args are null', async () => {
        let result = await executeCommanderStrikeChoice(
            { dieValue: 4, maneuverName: "Commander's Strike" },
            makePlayerStats(),
            'test-campaign',
            null
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe("Commander's Strike");
        expect(result.payload.description).toContain('No target selected');

        result = await executeCommanderStrikeChoice(
            { dieValue: 4, maneuverName: "Commander's Strike" },
            null,
            'test-campaign',
            'Ally1'
        );
        expect(result.payload.description).toContain('No target selected');

        result = await executeCommanderStrikeChoice(
            { dieValue: 4, maneuverName: "Commander's Strike" },
            makePlayerStats(),
            null,
            'Ally1'
        );
        expect(result.payload.description).toContain('No target selected');
    });

    it('sets commander strike state on chosen ally without expiration', async () => {
        const result = await executeCommanderStrikeChoice(
            { dieValue: 4, maneuverName: "Commander's Strike" },
            makePlayerStats(),
            'test-campaign',
            'Ally1'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe("Commander's Strike");
        expect(result.payload.description).toContain("Ally1 will add 4 to their next attack's damage roll");
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'commanderStrikeActive', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'commanderStrikeBonus', 4, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'commanderStrikeSource', "Commander's Strike", 'test-campaign');
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].characterName).toBe('TestFighter');
        expect(result.logEntries[0].abilityName).toBe("Commander's Strike");
    });

    it('uses default maneuver name when not provided', async () => {
        const result = await executeCommanderStrikeChoice(
            { dieValue: 6 },
            makePlayerStats(),
            'test-campaign',
            'Ally1'
        );

        expect(result.payload.name).toBe("Commander's Strike");
        expect(result.payload.description).toContain("Ally1 will add 6 to their next attack's damage roll");
    });
});

// ── executeRallyChoice ─────────────────────────────────────────────────

describe('executeRallyChoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with error when required args are null', async () => {
        let result = await executeRallyChoice(
            { dieValue: 4, maneuverName: 'Rally' },
            makePlayerStats(),
            'test-campaign',
            null,
            8,
            4,
            'Rally description'
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Rally');
        expect(result.payload.description).toContain('No target selected');

        result = await executeRallyChoice(
            { dieValue: 4, maneuverName: 'Rally' },
            null,
            'test-campaign',
            'Ally1',
            8,
            4,
            'Rally description'
        );
        expect(result.payload.description).toContain('No target selected');

        result = await executeRallyChoice(
            { dieValue: 4, maneuverName: 'Rally' },
            makePlayerStats(),
            null,
            'Ally1',
            8,
            4,
            'Rally description'
        );
        expect(result.payload.description).toContain('No target selected');
    });

    it('sets temp HP and expiration on chosen ally', async () => {
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
        expect(result.payload.name).toBe('Rally');
        expect(result.payload.description).toBe('Rally description');
        expect(tempHpService.setTempHp).toHaveBeenCalledWith('Ally1', 8, 'test-campaign');
        expect(expirations.addExpiration).toHaveBeenCalledWith(
            'TestFighter',
            'Ally1',
            expect.arrayContaining([{ type: 'rally_clear' }]),
            'test-campaign',
            undefined,
            'TestFighter'
        );
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].characterName).toBe('TestFighter');
        expect(result.logEntries[0].abilityName).toBe('Rally');
        expect(result.logEntries[0].description).toContain('gains 8 temporary hit points');
        expect(result.logEntries[0].d10Roll).toBe(4);
    });

    it('uses default maneuver name when not provided', async () => {
        const result = await executeRallyChoice(
            { dieValue: 6 },
            makePlayerStats(),
            'test-campaign',
            'Ally1',
            10,
            4,
            'Rally description'
        );

        expect(result.payload.name).toBe('Rally');
        expect(result.logEntries[0].description).toContain('Rally');
    });
});

// ── validateSizeLimit ──────────────────────────────────────────────────

describe('validateSizeLimit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns valid when maneuver has no sizeLimit', async () => {
        const result = await validateSizeLimit(
            {},
            'Goblin',
            'test-campaign',
            makePlayerStats()
        );

        expect(result).toEqual({ valid: true });
    });

    it('returns valid when target size is within limit', async () => {
        const scenarios = [
            { sizeLimit: 'large_or_smaller', targetSize: 'Small', expected: true },
            { sizeLimit: 'medium_or_smaller', targetSize: 'Small', expected: true },
            { sizeLimit: 'one_size_larger', targetSize: 'Large', expected: true },
        ];

        for (const { sizeLimit, targetSize, expected } of scenarios) {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', size: targetSize }],
            });

            const result = await validateSizeLimit(
                { sizeLimit, name: 'Trip Attack' },
                'Goblin',
                'test-campaign',
                makePlayerStats({ size: 'Medium' })
            );

            expect(result).toEqual({ valid: expected });
        }
    });

    it('returns invalid when target is too large for size limit', async () => {
        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ogre', size: 'Large' }],
        });

        let result = await validateSizeLimit(
            { sizeLimit: 'medium_or_smaller', name: 'Trip Attack' },
            'Ogre',
            'test-campaign',
            makePlayerStats({ size: 'Medium' })
        );

        expect(result.valid).toBe(false);
        expect(result.description).toContain('Target is Large');
        expect(result.description).toContain('Medium or smaller');

        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Huge Beast', size: 'Huge' }],
        });

        result = await validateSizeLimit(
            { sizeLimit: 'one_size_larger', name: 'Trip Attack' },
            'Huge Beast',
            'test-campaign',
            makePlayerStats({ size: 'Medium' })
        );

        expect(result.valid).toBe(false);
        expect(result.description).toContain('Target is Huge');
        expect(result.description).toContain('up to one size larger than you');
    });
});
