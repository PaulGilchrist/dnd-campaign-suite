// MN-017: Riposte trigger gates — gated arm-then-row (CLA-297/CLA-310 house standard)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeReactionManeuver } from './executeActionManeuvers.js';
import { getRuntimeValue, setRuntimeValue, setRuntimeBatch } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
    setRuntimeBatch: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Riposte', description: 'Make a melee attack against the attacker.', actionType: 'reaction', effect: 'melee_attack_reaction', trigger: 'melee_attack_miss', dieExpression: 'superiority_die' },
    ]),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'EvasiveFighter' }, { name: 'Thug 1' }], round: 1, activeCreatureName: 'Thug 1' }),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn().mockReturnValue({ total: 7 }),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 12),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

const makePlayerStats = () => ({
    name: 'EvasiveFighter',
    level: 18,
    rules: '2024',
    attacks: [{ name: 'Shortsword', type: 'Action', hitBonus: 9, damage: '1d6+4', damageType: 'Piercing', range: 5 }],
    automation: { passives: [] },
});

const missTrigger = {
    attackEvent: { attackerName: 'Thug 1', targetName: 'EvasiveFighter', hit: false, weaponType: 'melee', d20: 2, bonus: 3 },
    attackerName: 'Thug 1',
    targetName: 'EvasiveFighter',
    totalDamage: 0,
};

function mockKeys(extra = {}) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key in extra) return extra[key];
        if (key === 'superiorityDice') return 6;
        return null;
    });
}

describe('executeReactionManeuver — MN-017 Riposte gates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findLastAttack.mockResolvedValue({ ...missTrigger });
        isWithinRange.mockResolvedValue(true);
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'EvasiveFighter' }, { name: 'Thug 1' }], round: 1, activeCreatureName: 'Thug 1' });
        mockKeys();
    });

    it('accepted riposte on valid melee miss: pool --, pending armed, attack vs attacker, latches stamped, ability_use log entry', async () => {
        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('attack_roll');
        expect(result.payload.targetName).toBe('Thug 1');
        expect(result.payload.attack.name).toBe('Shortsword');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', 5, 'test-campaign');
        // MN-017 Defect 1 fix: die arm + both latches land in ONE merged batch.
        expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
        expect(setRuntimeBatch).toHaveBeenCalledWith('EvasiveFighter', {
            pendingRiposteDieValue: 7,
            _Riposte_appliedAttack: 'd20:2+3:Thug 1',
            _Riposte_usedRound: 1,
        }, 'test-campaign');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].description).toContain('Riposte (Reaction)');
        expect(result.logEntries[0].description).toContain('Thug 1');
        expect(result.logEntries[0].targetName).toBe('Thug 1');
    });

    it('refuses with no recent attack: no roll, no spend, no stamp, no log', async () => {
        findLastAttack.mockResolvedValue({ attackEvent: null, attackerName: null, targetName: null, totalDamage: 0 });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No recent attack found');
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.logEntries).toBeUndefined();
    });

    it('refuses when holder was not the target of the last attack', async () => {
        findLastAttack.mockResolvedValue({ ...missTrigger, attackEvent: { ...missTrigger.attackEvent, targetName: 'HexWarlock' }, targetName: 'HexWarlock' });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('You were not the target of the last attack');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses self-trigger (stale self-overwritten lastAttack)', async () => {
        findLastAttack.mockResolvedValue({ ...missTrigger, attackEvent: { ...missTrigger.attackEvent, attackerName: 'EvasiveFighter' }, attackerName: 'EvasiveFighter' });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('you cannot attack yourself');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when the last attack HIT (hit !== false)', async () => {
        findLastAttack.mockResolvedValue({ ...missTrigger, attackEvent: { ...missTrigger.attackEvent, hit: true }, totalDamage: 5 });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('was not a miss');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses a ranged triggering attack (weaponType ranged)', async () => {
        findLastAttack.mockResolvedValue({ ...missTrigger, attackEvent: { ...missTrigger.attackEvent, weaponType: 'ranged' } });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Ranged attack');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when attacker is out of 5 ft on a mapped combat', async () => {
        isWithinRange.mockResolvedValue(false);

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('not within 5 feet');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it("refuses on the holder's own turn (reaction timing)", async () => {
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'EvasiveFighter' }], round: 1, activeCreatureName: 'EvasiveFighter' });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('own turn');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses a second riposte against the SAME attack instance (attack-instance latch)', async () => {
        mockKeys({ _Riposte_appliedAttack: 'd20:2+3:Thug 1' });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already riposted this attack roll');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses a second riposte in the SAME round on a different attack (reaction economy)', async () => {
        mockKeys({ _Riposte_appliedAttack: 'd20:5+3:Thug 1', _Riposte_usedRound: 1 });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already used Riposte this round');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('re-arms on the next round (round latch cleared at round wrap)', async () => {
        getCombatContext.mockResolvedValue({ creatures: [], round: 2, activeCreatureName: 'Thug 1' });
        findLastAttack.mockResolvedValue({
            attackEvent: { attackerName: 'Thug 1', targetName: 'EvasiveFighter', hit: false, weaponType: 'melee', d20: 7, bonus: 3 },
            attackerName: 'Thug 1',
            targetName: 'EvasiveFighter',
            totalDamage: 0,
        });
        mockKeys({ _Riposte_appliedAttack: 'd20:2+3:Thug 1', _Riposte_usedRound: 1 });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('attack_roll');
        expect(setRuntimeBatch).toHaveBeenCalledWith('EvasiveFighter', expect.objectContaining({ _Riposte_usedRound: 2 }), 'test-campaign');
    });

    it('pool-0 gate keeps the exact verified popup and consults no trigger data', async () => {
        mockKeys({ superiorityDice: 0 });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Riposte: No Superiority Dice remaining. Recharges on a Short or Long Rest.');
        expect(findLastAttack).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('rolls a free Relentless d8 without spending a die on a valid trigger', async () => {
        const stats = makePlayerStats();
        stats.automation.passives = [{ type: 'passive_rule', effect: 'relentless' }];
        mockKeys({ relentlessUsedRound: null });
        rollExpression.mockReturnValue({ total: 5 });

        const result = await executeReactionManeuver({ name: 'Riposte' }, stats, 'test-campaign', 'Riposte');

        expect(result.type).toBe('attack_roll');
        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'relentlessUsedRound', 1, 'test-campaign');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', 5, 'test-campaign');
        expect(setRuntimeBatch).toHaveBeenCalledWith('EvasiveFighter', expect.objectContaining({ pendingRiposteDieValue: 5 }), 'test-campaign');
    });

    it('timestamped lastAttack identity is honored for the instance latch', async () => {
        findLastAttack.mockResolvedValue({
            ...missTrigger,
            attackEvent: { ...missTrigger.attackEvent, timestamp: 1234 },
        });
        mockKeys({ _Riposte_appliedAttack: '1234' });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already riposted this attack roll');
    });

    it('refuses on the holder\'s own turn via __initiative__ authority even when the cs mirror is stale (live defect 2)', async () => {
        // Live 2026-10-09: turn-start gate stamped "7:EvasiveFighter" but
        // combatSummary.activeCreatureName still lagged "Thug 1" → press FIRED.
        getCombatContext.mockResolvedValue({ creatures: [], round: 7, activeCreatureName: 'Bandit 1' });
        mockKeys({ '__initiative__': null });
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === '__initiative__' && key === 'lastAppliedTurnStartCreature') return '7:EvasiveFighter';
            if (key === 'superiorityDice') return 6;
            return null;
        });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('you cannot use it on your own turn');
        expect(setRuntimeBatch).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', expect.anything(), 'test-campaign');
    });

    it('fires when __initiative__ gate names another creature even if the cs mirror stale-shows the holder', async () => {
        getCombatContext.mockResolvedValue({ creatures: [], round: 7, activeCreatureName: 'EvasiveFighter' });
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === '__initiative__' && key === 'lastAppliedTurnStartCreature') return '7:Thug 1';
            if (key === 'superiorityDice') return 6;
            return null;
        });

        const result = await executeReactionManeuver({ name: 'Riposte' }, makePlayerStats(), 'test-campaign', 'Riposte');

        expect(result.type).toBe('attack_roll');
        expect(setRuntimeBatch).toHaveBeenCalledWith('EvasiveFighter', expect.objectContaining({ _Riposte_usedRound: 7 }), 'test-campaign');
    });
});
