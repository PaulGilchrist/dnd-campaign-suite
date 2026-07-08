// @cleaned-by-ai
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
    addEntry: vi.fn(() => Promise.resolve()),
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
        it('returns default values when combat context or lastAttack is absent', async () => {
            getCombatContext.mockResolvedValue(null);
            let result = await findLastAttack(campaignName);
            expect(result).toEqual({
                attackEvent: null, attackerName: null, targetName: null,
                primaryDamage: 0, secondaryDamage: 0, totalDamage: 0, damageTypes: [],
            });

            getCombatContext.mockResolvedValue({ creatures: [] });
            result = await findLastAttack(campaignName);
            expect(result.attackEvent).toBeNull();
            expect(result.totalDamage).toBe(0);
        });

        it('prefers actualDamage over primary + secondary sum', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({ primaryDamage: 8, secondaryDamage: 3, actualDamage: 5 }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);
            expect(result.totalDamage).toBe(5);
            expect(result.primaryDamage).toBe(8);
            expect(result.secondaryDamage).toBe(3);
        });

        it('sums primary and secondary when actualDamage is absent', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({ primaryDamage: 8, secondaryDamage: 3 }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);
            expect(result.totalDamage).toBe(11);
        });

        it('falls back to rawDamage when primaryDamage is falsy', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({ primaryDamage: 0, rawDamage: 7 }),
            });
            getCombatContext.mockResolvedValue(cs);
            const result = await findLastAttack(campaignName);
            expect(result.primaryDamage).toBe(7);
            expect(result.totalDamage).toBe(7);
        });

        it('returns damageTypes from attack event or empty array when absent', async () => {
            let cs = makeCombatContext({
                lastAttack: makeLastAttack({ damageTypes: ['Fire', 'Cold'] }),
            });
            getCombatContext.mockResolvedValue(cs);
            let result = await findLastAttack(campaignName);
            expect(result.damageTypes).toEqual(['Fire', 'Cold']);

            cs = makeCombatContext({
                lastAttack: makeLastAttack({ damageTypes: undefined }),
            });
            getCombatContext.mockResolvedValue(cs);
            result = await findLastAttack(campaignName);
            expect(result.damageTypes).toEqual([]);
        });

        it('returns attackerName, targetName, and attackEvent from the attack event', async () => {
            const cs = makeCombatContext({
                lastAttack: makeLastAttack({ attackerName: 'Orc', targetName: 'Wizard', d20: 17, hit: true }),
            });
            getCombatContext.mockResolvedValue(cs);

            const result = await findLastAttack(campaignName);
            expect(result.attackEvent).toBe(cs.lastAttack);
            expect(result.attackerName).toBe('Orc');
            expect(result.targetName).toBe('Wizard');
        });
    });

    // ─── findAttackRollAgainstTarget ─────────────────────────

    describe('findAttackRollAgainstTarget', () => {
        it('returns null when no lastAttack exists or targetName does not match', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });
            let result = await findAttackRollAgainstTarget('Hero', campaignName);
            expect(result).toEqual({ attackEvent: null, attackerName: null });

            const attack = makeLastAttack({ targetName: 'Wizard' });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);
            result = await findAttackRollAgainstTarget('Hero', campaignName);
            expect(result.attackEvent).toBeNull();
            expect(result.attackerName).toBeNull();
        });

        it('returns attack event and attackerName when targetName matches', async () => {
            const attack = makeLastAttack({ targetName: 'Hero', attackerName: 'Goblin' });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);

            const result = await findAttackRollAgainstTarget('Hero', campaignName);
            expect(result.attackEvent).toBe(attack);
            expect(result.attackerName).toBe('Goblin');
        });
    });

    // ─── rollbackDamage ────────────────────────────────────────

    describe('rollbackDamage', () => {
        it('returns 0 and skips healing when conditions are not met', async () => {
            // no lastAttack
            getCombatContext.mockResolvedValue({ creatures: [] });
            let result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');
            expect(result).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();

            // attackerName mismatch
            const cs1 = makeCombatContext({ lastAttack: makeLastAttack({ attackerName: 'Orc' }) });
            getCombatContext.mockResolvedValue(cs1);
            result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');
            expect(result).toBe(0);

            // targetName mismatch
            const cs2 = makeCombatContext({ lastAttack: makeLastAttack({ targetName: 'Wizard' }) });
            getCombatContext.mockResolvedValue(cs2);
            result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');
            expect(result).toBe(0);

            // zero damage
            const cs3 = makeCombatContext({ lastAttack: makeLastAttack({ primaryDamage: 0, secondaryDamage: 0, actualDamage: 0 }) });
            getCombatContext.mockResolvedValue(cs3);
            result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');
            expect(result).toBe(0);

            // negative damage
            const cs4 = makeCombatContext({ lastAttack: makeLastAttack({ actualDamage: -5 }) });
            getCombatContext.mockResolvedValue(cs4);
            result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');
            expect(result).toBe(0);
        });

        it('heals target and returns totalDamage when all conditions match', async () => {
            const attack = makeLastAttack({ primaryDamage: 10, secondaryDamage: 2 });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);
            applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 12, oldHp: 13 });

            const result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');

            expect(result).toBe(12);
            expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Hero', 12, campaignName);
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

        it('logs an ability_use entry with full details on successful rollback', async () => {
            const attack = makeLastAttack({
                attackerName: 'Orc',
                targetName: 'Cleric',
                primaryDamage: 5,
                secondaryDamage: 0,
            });
            const cs = makeCombatContext({ lastAttack: attack });
            getCombatContext.mockResolvedValue(cs);
            applyHealingToTarget.mockReturnValue({ newHp: 20, actualHeal: 5, oldHp: 15 });

            await rollbackDamage('Orc', 'Cleric', campaignName, 'Feather Fall');

            expect(addEntry).toHaveBeenCalledTimes(1);
            const [logCampaign, logPayload] = addEntry.mock.calls[0];
            expect(logCampaign).toBe(campaignName);
            expect(logPayload.type).toBe('ability_use');
            expect(logPayload.characterName).toBe('Cleric');
            expect(logPayload.abilityName).toBe('Feather Fall');
            expect(logPayload.targetName).toBe('Orc');
            expect(typeof logPayload.timestamp).toBe('number');
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
        it('returns null when combat context is null or creatures array is absent', async () => {
            getCombatContext.mockResolvedValue(null);
            let result = await findRollsByCreature(campaignName);
            expect(result).toBeNull();

            getCombatContext.mockResolvedValue({ lastAttack: makeLastAttack() });
            result = await findRollsByCreature(campaignName);
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

        it('maps lastAttack to the correct event field based on rollType', async () => {
            const rollTypeTests = [
                { rollType: 'attack', eventKey: 'attackEvent', expectedType: 'attack' },
                { rollType: 'check', eventKey: 'abilityEvent', expectedType: 'check' },
                { rollType: 'skill', eventKey: 'abilityEvent', expectedType: 'skill' },
                { rollType: 'save', eventKey: 'saveEvent', expectedType: 'save' },
            ];

            for (const { rollType, eventKey, expectedType } of rollTypeTests) {
                const attack = makeLastAttack({ rollType });
                getCombatContext.mockResolvedValue({ creatures: [{ name: 'Hero' }], lastAttack: attack });

                const result = await findRollsByCreature(campaignName);

                expect(result.Hero[eventKey]).toBe(attack);
                expect(result.Hero.rollType).toBe(expectedType);
            }
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
    });

    // ─── findMostRecentRollAcrossCreatures ─────────────────────

    describe('findMostRecentRollAcrossCreatures', () => {
        it('returns null when combat context is null or no lastAttack exists', async () => {
            getCombatContext.mockResolvedValue(null);
            let result = await findMostRecentRollAcrossCreatures(campaignName);
            expect(result).toBeNull();

            getCombatContext.mockResolvedValue({ creatures: [] });
            result = await findMostRecentRollAcrossCreatures(campaignName);
            expect(result).toBeNull();
        });

        it('returns the correct eventType based on rollType with creatureName fallback', async () => {
            const rollTypeTests = [
                { rollType: 'attack', attackerName: 'Goblin', targetName: null, eventType: 'attack', creatureName: 'Goblin' },
                { rollType: 'check', attackerName: 'Hero', targetName: null, eventType: 'ability', creatureName: 'Hero' },
                { rollType: 'skill', attackerName: null, targetName: 'Hero', eventType: 'ability', creatureName: 'Hero' },
                { rollType: 'save', attackerName: null, targetName: 'Wizard', eventType: 'save', creatureName: 'Wizard' },
            ];

            for (const { rollType, attackerName, targetName, eventType, creatureName } of rollTypeTests) {
                const attack = makeLastAttack({ rollType, attackerName, targetName });
                getCombatContext.mockResolvedValue({ lastAttack: attack });

                const result = await findMostRecentRollAcrossCreatures(campaignName);

                expect(result.eventType).toBe(eventType);
                expect(result.creatureName).toBe(creatureName);
                expect(result.eventData).toBe(attack);
                expect(result.isStale).toBe(false);
            }
        });


    });
});
