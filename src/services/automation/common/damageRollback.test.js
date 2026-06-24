// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    findLastAttack,
    findAttackRollAgainstTarget,
    rollbackDamage,
    findRollsByCreature,
    findMostRecentRollAcrossCreatures,
} from './damageRollback.js';

// ── Mocks BEFORE imports ─────────────────────────────────────────

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../rules/combat/applyHealing.js';
import { addEntry } from '../../ui/logService.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function resetMocks() {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue(null);
    applyHealingToTarget.mockReturnValue(null);
    addEntry.mockResolvedValue(undefined);
}

function makeLastAttack(overrides = {}) {
    return {
        attackerName: 'Goblin',
        targetName: 'Hero',
        d20: 15,
        hit: true,
        primaryDamage: 8,
        rawDamage: 8,
        secondaryDamage: 0,
        damageTypes: ['Slashing'],
        rollType: 'attack',
        ...overrides,
    };
}

function makeCombatContext(overrides = {}) {
    return {
        creatures: [{ name: 'Hero', hitPoints: 30 }, { name: 'Goblin', hitPoints: 7 }],
        lastAttack: makeLastAttack(),
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────

describe('damageRollback', () => {
    beforeEach(resetMocks);
    afterEach(vi.restoreAllMocks);

    // ─── findLastAttack ────────────────────────────────────────

    describe('findLastAttack', () => {
        it('returns null fields when lastAttack is absent', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await findLastAttack(campaignName);

            expect(result).toEqual({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            expect(getCombatContext).toHaveBeenCalledWith(campaignName);
        });

        it('returns null fields when combatSummary is null', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await findLastAttack(campaignName);

            expect(result.attackEvent).toBeNull();
            expect(result.totalDamage).toBe(0);
        });

        it('prefers actualDamage over primary + secondary sum', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({
                    primaryDamage: 8,
                    secondaryDamage: 3,
                    actualDamage: 5,
                }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);

            expect(result.totalDamage).toBe(5);
            expect(result.primaryDamage).toBe(8);
            expect(result.secondaryDamage).toBe(3);
        });

        it('sums primary and secondary when actualDamage is absent', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({
                    primaryDamage: 8,
                    secondaryDamage: 3,
                }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);

            expect(result.totalDamage).toBe(11);
        });

        it('falls back to rawDamage when primaryDamage is absent', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({ primaryDamage: undefined, rawDamage: 12 }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);

            expect(result.primaryDamage).toBe(12);
            expect(result.totalDamage).toBe(12);
        });

        it('defaults primaryDamage to 0 when both primaryDamage and rawDamage are absent', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({ primaryDamage: undefined, rawDamage: undefined }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);

            expect(result.primaryDamage).toBe(0);
        });

        it('defaults primaryDamage to rawDamage when primaryDamage is 0', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({ primaryDamage: 0, rawDamage: 7 }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);

            expect(result.primaryDamage).toBe(7);
        });

        it('defaults totalDamage to primary + secondary when actualDamage is undefined', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({
                    primaryDamage: 8,
                    secondaryDamage: 3,
                    actualDamage: undefined,
                }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);

            expect(result.totalDamage).toBe(11);
        });

        it('returns the full attack event as attackEvent', async () => {
            const attack = makeLastAttack({ d20: 17, hit: true });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);

            expect(result.attackEvent).toBe(attack);
        });

        it('returns attackerName and targetName from the attack event', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({ attackerName: 'Orc', targetName: 'Wizard' }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);

            expect(result.attackerName).toBe('Orc');
            expect(result.targetName).toBe('Wizard');
        });

        it('returns damageTypes from attack event or empty array when absent', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({ damageTypes: undefined }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);

            expect(result.damageTypes).toEqual([]);
        });

        it('returns damageTypes when present', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({ damageTypes: ['Fire', 'Cold'] }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);

            expect(result.damageTypes).toEqual(['Fire', 'Cold']);
        });
    });

    // ─── findAttackRollAgainstTarget ─────────────────────────

    describe('findAttackRollAgainstTarget', () => {
        it('returns null when no lastAttack exists', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await findAttackRollAgainstTarget('Hero', campaignName);

            expect(result).toEqual({ attackEvent: null, attackerName: null });
        });

        it('returns attack event when targetName matches', async () => {
            const attack = makeLastAttack({ targetName: 'Hero', attackerName: 'Goblin' });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);

            const result = await findAttackRollAgainstTarget('Hero', campaignName);

            expect(result.attackEvent).toBe(attack);
            expect(result.attackerName).toBe('Goblin');
        });

        it('returns null when targetName does not match', async () => {
            const attack = makeLastAttack({ targetName: 'Wizard' });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);

            const result = await findAttackRollAgainstTarget('Hero', campaignName);

            expect(result.attackEvent).toBeNull();
            expect(result.attackerName).toBeNull();
        });

        it('is case-sensitive for targetName matching', async () => {
            const attack = makeLastAttack({ targetName: 'hero' });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);

            const result = await findAttackRollAgainstTarget('Hero', campaignName);

            expect(result.attackEvent).toBeNull();
        });
    });

    // ─── rollbackDamage ────────────────────────────────────────

    describe('rollbackDamage', () => {
        it('returns 0 and skips healing when no lastAttack exists', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await rollbackDamage(
                'Goblin',
                'Hero',
                campaignName,
                'Mirror Image'
            );

            expect(result).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns 0 and skips healing when attackerName does not match', async () => {
            const attack = makeLastAttack({ attackerName: 'Orc' });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);

            const result = await rollbackDamage(
                'Goblin',
                'Hero',
                campaignName,
                'Mirror Image'
            );

            expect(result).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns 0 and skips healing when targetName does not match', async () => {
            const attack = makeLastAttack({ targetName: 'Wizard' });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);

            const result = await rollbackDamage(
                'Goblin',
                'Hero',
                campaignName,
                'Mirror Image'
            );

            expect(result).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns 0 and skips healing when totalDamage is zero', async () => {
            const attack = makeLastAttack({ primaryDamage: 0, secondaryDamage: 0, actualDamage: 0 });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);

            const result = await rollbackDamage(
                'Goblin',
                'Hero',
                campaignName,
                'Mirror Image'
            );

            expect(result).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns 0 and skips healing when totalDamage is negative', async () => {
            const attack = makeLastAttack({ actualDamage: -5 });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);

            const result = await rollbackDamage(
                'Goblin',
                'Hero',
                campaignName,
                'Mirror Image'
            );

            expect(result).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns 0 and skips healing when totalDamage is NaN', async () => {
            const attack = makeLastAttack();
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValueOnce(cs);
            getCombatContext.mockResolvedValueOnce(null);

            const result = await rollbackDamage(
                'Goblin',
                'Hero',
                campaignName,
                'Mirror Image'
            );

            expect(result).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns 0 when combat context is null after first call', async () => {
            const attack = makeLastAttack();
            getCombatContext.mockResolvedValueOnce({ lastAttack: attack });
            getCombatContext.mockResolvedValueOnce(null);

            const result = await rollbackDamage(
                'Goblin',
                'Hero',
                campaignName,
                'Mirror Image'
            );

            expect(result).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('heals target and returns totalDamage when all conditions match', async () => {
            const attack = makeLastAttack({ primaryDamage: 10, secondaryDamage: 2 });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);
            applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 12, oldHp: 13 });

            const result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');

            expect(result).toBe(12);
            expect(applyHealingToTarget).toHaveBeenCalledWith(
                cs,
                'Hero',
                12,
                campaignName
            );
        });

        it('returns 0 when applyHealingToTarget returns no newHp', async () => {
            const attack = makeLastAttack();
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);
            applyHealingToTarget.mockReturnValue(null);

            const result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');

            expect(result).toBe(0);
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns 0 when applyHealingToTarget returns object without newHp', async () => {
            const attack = makeLastAttack();
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);
            applyHealingToTarget.mockReturnValue({ otherField: 'value' });

            const result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');

            expect(result).toBe(0);
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('logs an ability_use entry on successful rollback', async () => {
            const attack = makeLastAttack({ primaryDamage: 7, secondaryDamage: 3 });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);
            applyHealingToTarget.mockReturnValue({ newHp: 20, actualHeal: 10, oldHp: 10 });

            await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');

            expect(addEntry).toHaveBeenCalledTimes(1);
            const [logCampaign, logPayload] = addEntry.mock.calls[0];
            expect(logCampaign).toBe(campaignName);
            expect(logPayload.type).toBe('ability_use');
            expect(logPayload.characterName).toBe('Hero');
            expect(logPayload.abilityName).toBe('Mirror Image');
            expect(logPayload.targetName).toBe('Goblin');
            expect(typeof logPayload.timestamp).toBe('number');
        });

        it('includes attacker, target, and damage amount in log description', async () => {
            const attack = makeLastAttack({
                attackerName: 'Orc',
                targetName: 'Cleric',
                primaryDamage: 5,
            });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);
            applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 5, oldHp: 20 });

            await rollbackDamage('Orc', 'Cleric', campaignName, 'Feather Fall');

            const logPayload = addEntry.mock.calls[0][1];
            expect(logPayload.description).toContain('Orc');
            expect(logPayload.description).toContain('Cleric');
            expect(logPayload.description).toContain('5 HP');
            expect(logPayload.description).toContain('Feather Fall');
        });

        it('re-throws addEntry errors after logging them', async () => {
            const attack = makeLastAttack();
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);
            applyHealingToTarget.mockReturnValue({ newHp: 20, actualHeal: 8, oldHp: 12 });
            addEntry.mockRejectedValue(new Error('DB error'));

            await expect(
                rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image')
            ).rejects.toThrow('DB error');
        });
    });

    // ─── findRollsByCreature ───────────────────────────────────

    describe('findRollsByCreature', () => {
        it('returns null when combat context is null', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await findRollsByCreature(campaignName);

            expect(result).toBeNull();
        });

        it('returns null when creatures array is absent', async () => {
            getCombatContext.mockResolvedValue({ lastAttack: makeLastAttack() });

            const result = await findRollsByCreature(campaignName);

            expect(result).toBeNull();
        });

        it('returns empty map when creatures array is empty', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await findRollsByCreature(campaignName);

            expect(result).toEqual({});
        });

        it('returns null rollType entries for every creature when no lastAttack', async () => {
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Hero' }, { name: 'Goblin' }] });

            const result = await findRollsByCreature(campaignName);

            expect(result).toEqual({
                Hero: { attackEvent: null, abilityEvent: null, saveEvent: null, rollType: null },
                Goblin: { attackEvent: null, abilityEvent: null, saveEvent: null, rollType: null },
            });
        });

        it('maps lastAttack to attackEvent when rollType is attack', async () => {
            const attack = makeLastAttack({ rollType: 'attack' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Hero' }],
                lastAttack: attack,
            });

            const result = await findRollsByCreature(campaignName);

            expect(result.Hero.attackEvent).toBe(attack);
            expect(result.Hero.abilityEvent).toBeNull();
            expect(result.Hero.saveEvent).toBeNull();
            expect(result.Hero.rollType).toBe('attack');
        });

        it('maps lastAttack to abilityEvent when rollType is check', async () => {
            const attack = makeLastAttack({ rollType: 'check' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Hero' }],
                lastAttack: attack,
            });

            const result = await findRollsByCreature(campaignName);

            expect(result.Hero.abilityEvent).toBe(attack);
            expect(result.Hero.attackEvent).toBeNull();
            expect(result.Hero.saveEvent).toBeNull();
            expect(result.Hero.rollType).toBe('check');
        });

        it('maps lastAttack to abilityEvent when rollType is skill', async () => {
            const attack = makeLastAttack({ rollType: 'skill' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Hero' }],
                lastAttack: attack,
            });

            const result = await findRollsByCreature(campaignName);

            expect(result.Hero.abilityEvent).toBe(attack);
            expect(result.Hero.rollType).toBe('skill');
        });

        it('maps lastAttack to saveEvent when rollType is save', async () => {
            const attack = makeLastAttack({ rollType: 'save' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Hero' }],
                lastAttack: attack,
            });

            const result = await findRollsByCreature(campaignName);

            expect(result.Hero.saveEvent).toBe(attack);
            expect(result.Hero.rollType).toBe('save');
        });

        it('returns the same lastAttack reference for every creature', async () => {
            const attack = makeLastAttack();
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Hero' }, { name: 'Goblin' }, { name: 'Wizard' }],
                lastAttack: attack,
            });

            const result = await findRollsByCreature(campaignName);

            expect(result.Hero.attackEvent).toBe(attack);
            expect(result.Goblin.attackEvent).toBe(attack);
            expect(result.Wizard.attackEvent).toBe(attack);
        });

        it('uses creature names as keys in the result map', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
            });

            const result = await findRollsByCreature(campaignName);

            expect(Object.keys(result)).toEqual(['A', 'B', 'C']);
        });
    });

    // ─── findMostRecentRollAcrossCreatures ─────────────────────

    describe('findMostRecentRollAcrossCreatures', () => {
        it('returns null when no lastAttack exists', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await findMostRecentRollAcrossCreatures(campaignName);

            expect(result).toBeNull();
        });

        it('returns null when combat context is null', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await findMostRecentRollAcrossCreatures(campaignName);

            expect(result).toBeNull();
        });

        it('returns attack event type for rollType attack', async () => {
            const attack = makeLastAttack({ rollType: 'attack', attackerName: 'Goblin' });
            getCombatContext.mockResolvedValue({ lastAttack: attack });

            const result = await findMostRecentRollAcrossCreatures(campaignName);

            expect(result.creatureName).toBe('Goblin');
            expect(result.eventType).toBe('attack');
            expect(result.eventData).toBe(attack);
            expect(result.isStale).toBe(false);
        });

        it('returns ability event type for rollType check', async () => {
            const attack = makeLastAttack({ rollType: 'check', attackerName: 'Hero' });
            getCombatContext.mockResolvedValue({ lastAttack: attack });

            const result = await findMostRecentRollAcrossCreatures(campaignName);

            expect(result.eventType).toBe('ability');
            expect(result.creatureName).toBe('Hero');
        });

        it('returns ability event type for rollType skill', async () => {
            const attack = makeLastAttack({ rollType: 'skill', attackerName: null, targetName: 'Hero' });
            getCombatContext.mockResolvedValue({ lastAttack: attack });

            const result = await findMostRecentRollAcrossCreatures(campaignName);

            expect(result.eventType).toBe('ability');
            expect(result.creatureName).toBe('Hero');
        });

        it('returns save event type for rollType save', async () => {
            const attack = makeLastAttack({ rollType: 'save', attackerName: null, targetName: 'Wizard' });
            getCombatContext.mockResolvedValue({ lastAttack: attack });

            const result = await findMostRecentRollAcrossCreatures(campaignName);

            expect(result.eventType).toBe('save');
            expect(result.creatureName).toBe('Wizard');
        });

        it('falls back to targetName for creatureName when attackerName is absent', async () => {
            const attack = makeLastAttack({ attackerName: null, targetName: 'Dragon' });
            getCombatContext.mockResolvedValue({ lastAttack: attack });

            const result = await findMostRecentRollAcrossCreatures(campaignName);

            expect(result.creatureName).toBe('Dragon');
        });

        it('returns null creatureName when both attackerName and targetName are absent', async () => {
            const attack = makeLastAttack({ attackerName: null, targetName: null });
            getCombatContext.mockResolvedValue({ lastAttack: attack });

            const result = await findMostRecentRollAcrossCreatures(campaignName);

            expect(result.creatureName).toBeNull();
        });

        it('returns the full lastAttack object as eventData', async () => {
            const attack = makeLastAttack({ d20: 19, hit: true, primaryDamage: 15 });
            getCombatContext.mockResolvedValue({ lastAttack: attack });

            const result = await findMostRecentRollAcrossCreatures(campaignName);

            expect(result.eventData).toBe(attack);
        });

        it('always sets isStale to false', async () => {
            const attack = makeLastAttack();
            getCombatContext.mockResolvedValue({ lastAttack: attack });

            const result = await findMostRecentRollAcrossCreatures(campaignName);

            expect(result.isStale).toBe(false);
        });
    });
});
