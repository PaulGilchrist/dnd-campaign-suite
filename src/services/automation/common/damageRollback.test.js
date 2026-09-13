// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    findLastAttack,
    findAttackRollAgainstTarget,
    rollbackDamage,
    findRollsByCreature,
    findMostRecentRollAcrossCreatures,
    rollbackSpellEffects,
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

vi.mock('../../combat/conditions/conditionSaveService.js', () => ({
    removeCondition: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../rules/combat/applyHealing.js';
import { addEntry } from '../../ui/logService.js';
import { removeCondition } from '../../combat/conditions/conditionSaveService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function resetMocks() {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue(null);
    getRuntimeValue.mockReturnValue(null);
    setRuntimeValue.mockResolvedValue(undefined);
    applyHealingToTarget.mockReturnValue(null);
    removeCondition.mockReturnValue(undefined);
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


// ── Tests ────────────────────────────────────────────────────────

describe('damageRollback', () => {
    beforeEach(resetMocks);
    afterEach(vi.restoreAllMocks);

    // ─── findLastAttack ────────────────────────────────────────

    describe('findLastAttack', () => {
        it('returns default values when combat context or lastAttack is absent', async () => {
            getRuntimeValue.mockReturnValue(null);
            let result = await findLastAttack(campaignName);
            expect(result).toEqual({
                attackEvent: null, attackerName: null, targetName: null,
                primaryDamage: 0, secondaryDamage: 0, totalDamage: 0, damageTypes: [],
            });
        });

        it('prefers actualDamage over primary + secondary sum', async () => {
            const attack = makeLastAttack({ primaryDamage: 8, secondaryDamage: 3, actualDamage: 5 });
            getRuntimeValue.mockReturnValue(attack);

            const result = await findLastAttack(campaignName);
            expect(result.totalDamage).toBe(5);
            expect(result.primaryDamage).toBe(8);
            expect(result.secondaryDamage).toBe(3);
        });

        it('sums primary and secondary when actualDamage is absent', async () => {
            const attack = makeLastAttack({ primaryDamage: 8, secondaryDamage: 3 });
            getRuntimeValue.mockReturnValue(attack);

            const result = await findLastAttack(campaignName);
            expect(result.totalDamage).toBe(11);
        });

        it('falls back to rawDamage when primaryDamage is falsy', async () => {
            const attack = makeLastAttack({ primaryDamage: 0, rawDamage: 7 });
            getRuntimeValue.mockReturnValue(attack);
            const result = await findLastAttack(campaignName);
            expect(result.primaryDamage).toBe(7);
            expect(result.totalDamage).toBe(7);
        });

        it('returns damageTypes from attack event or empty array when absent', async () => {
            let attack = makeLastAttack({ damageTypes: ['Fire', 'Cold'] });
            getRuntimeValue.mockReturnValue(attack);
            let result = await findLastAttack(campaignName);
            expect(result.damageTypes).toEqual(['Fire', 'Cold']);

            attack = makeLastAttack({ damageTypes: undefined });
            getRuntimeValue.mockReturnValue(attack);
            result = await findLastAttack(campaignName);
            expect(result.damageTypes).toEqual([]);
        });

        it('returns attackerName, targetName, and attackEvent from the attack event', async () => {
            const attack = makeLastAttack({ attackerName: 'Orc', targetName: 'Wizard', d20: 17, hit: true });
            getRuntimeValue.mockReturnValue(attack);

            const result = await findLastAttack(campaignName);
            // attackEvent is enriched with affectedTargets and statusEffects
            expect(result.attackEvent.attackerName).toBe('Orc');
            expect(result.attackEvent.targetName).toBe('Wizard');
            expect(result.attackEvent.d20).toBe(17);
            expect(result.attackEvent.hit).toBe(true);
            expect(result.attackEvent.affectedTargets).toEqual(['Wizard']);
            expect(result.attackEvent.statusEffects).toBeNull();
            expect(result.attackerName).toBe('Orc');
            expect(result.targetName).toBe('Wizard');
        });

        it('passes through the trigger stamp (CLA-315 Slow Fall gate)', async () => {
            const attack = makeLastAttack({ attackerName: 'Collapsing Floor', targetName: 'Monk', trigger: 'falling', damageTypes: ['bludgeoning'] });
            getRuntimeValue.mockReturnValue(attack);

            const result = await findLastAttack(campaignName);
            expect(result.trigger).toBe('falling');
            expect(result.attackEvent.trigger).toBe('falling');

            const plain = makeLastAttack({ attackerName: 'Thug 1', targetName: 'Monk' });
            getRuntimeValue.mockReturnValue(plain);
            const plainResult = await findLastAttack(campaignName);
            expect(plainResult.trigger).toBeNull();
        });
    });

    // ─── findAttackRollAgainstTarget ─────────────────────────

    describe('findAttackRollAgainstTarget', () => {
        it('returns null when no lastAttack exists or targetName does not match', async () => {
            getRuntimeValue.mockReturnValue(null);
            let result = await findAttackRollAgainstTarget('Hero', campaignName);
            expect(result).toEqual({ attackEvent: null, attackerName: null });

            const attack = makeLastAttack({ targetName: 'Wizard' });
            getRuntimeValue.mockReturnValue(attack);
            result = await findAttackRollAgainstTarget('Hero', campaignName);
            expect(result.attackEvent).toBeNull();
            expect(result.attackerName).toBeNull();
        });

        it('returns attack event and attackerName when targetName matches', async () => {
            const attack = makeLastAttack({ targetName: 'Hero', attackerName: 'Goblin' });
            getRuntimeValue.mockReturnValue(attack);

            const result = await findAttackRollAgainstTarget('Hero', campaignName);
            // attackEvent is enriched with affectedTargets and statusEffects
            expect(result.attackEvent.targetName).toBe('Hero');
            expect(result.attackEvent.attackerName).toBe('Goblin');
            expect(result.attackEvent.affectedTargets).toEqual(['Hero']);
            expect(result.attackEvent.statusEffects).toBeNull();
            expect(result.attackerName).toBe('Goblin');
        });
    });

    // ─── rollbackDamage ────────────────────────────────────────

    describe('rollbackDamage', () => {
        it('returns 0 and skips healing when conditions are not met', async () => {
            // no lastAttack
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({ creatures: [] });
            let result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');
            expect(result).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();

            // attackerName mismatch
            getRuntimeValue.mockReturnValue(makeLastAttack({ attackerName: 'Orc' }));
            result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');
            expect(result).toBe(0);

            // targetName mismatch
            getRuntimeValue.mockReturnValue(makeLastAttack({ targetName: 'Wizard' }));
            result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');
            expect(result).toBe(0);

            // zero damage
            getRuntimeValue.mockReturnValue(makeLastAttack({ primaryDamage: 0, secondaryDamage: 0, actualDamage: 0 }));
            result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');
            expect(result).toBe(0);

            // negative damage
            getRuntimeValue.mockReturnValue(makeLastAttack({ actualDamage: -5 }));
            result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');
            expect(result).toBe(0);
        });

        it('heals target and returns totalDamage when all conditions match', async () => {
            const attack = makeLastAttack({ primaryDamage: 10, secondaryDamage: 2, attackerName: 'Goblin', targetName: 'Hero' });
            getRuntimeValue.mockReturnValue(attack);
            const cs = { creatures: [{ name: 'Hero' }] };
            getCombatContext.mockResolvedValue(cs);
            applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 12, oldHp: 13 });

            const result = await rollbackDamage('Goblin', 'Hero', campaignName, 'Mirror Image');

            expect(result).toBe(12);
            expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Hero', 12, campaignName);
        });

        it('returns 0 when applyHealingToTarget returns no newHp', async () => {
            const attack = makeLastAttack({ attackerName: 'Goblin', targetName: 'Hero' });
            getRuntimeValue.mockReturnValue(attack);
            const cs = { creatures: [{ name: 'Hero' }] };
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
            getRuntimeValue.mockReturnValue(attack);
            const cs = { creatures: [{ name: 'Cleric' }] };
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
            const attack = makeLastAttack({ attackerName: 'Goblin', targetName: 'Hero' });
            getRuntimeValue.mockReturnValue(attack);
            const cs = { creatures: [{ name: 'Hero' }] };
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
            getRuntimeValue.mockReturnValue(null);
            let result = await findRollsByCreature(campaignName);
            expect(result).toBeNull();

            getRuntimeValue.mockReturnValue(makeLastAttack());
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Hero' }] });
            result = await findRollsByCreature(campaignName);
            expect(result.Hero.attackEvent).toEqual(makeLastAttack());
        });

        it('returns empty map when creatures array is empty', async () => {
            getRuntimeValue.mockReturnValue(makeLastAttack());
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
                getRuntimeValue.mockReturnValue(attack);
                getCombatContext.mockResolvedValue({ creatures: [{ name: 'Hero' }] });

                const result = await findRollsByCreature(campaignName);

                expect(result.Hero[eventKey]).toBe(attack);
                expect(result.Hero.rollType).toBe(expectedType);
            }
        });

        it('returns the same lastAttack reference for every creature', async () => {
            const attack = makeLastAttack();
            getRuntimeValue.mockReturnValue(attack);
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Hero' }, { name: 'Goblin' }, { name: 'Wizard' }] });

            const result = await findRollsByCreature(campaignName);
            expect(result.Hero.attackEvent).toBe(attack);
            expect(result.Goblin.attackEvent).toBe(attack);
            expect(result.Wizard.attackEvent).toBe(attack);
        });
    });

    // ─── findMostRecentRollAcrossCreatures ─────────────────────

    describe('findMostRecentRollAcrossCreatures', () => {
        it('returns null when combat context is null or no lastAttack exists', async () => {
            getRuntimeValue.mockReturnValue(null);
            let result = await findMostRecentRollAcrossCreatures(campaignName);
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
                getRuntimeValue.mockReturnValue(attack);

                const result = await findMostRecentRollAcrossCreatures(campaignName);

                expect(result.eventType).toBe(eventType);
                expect(result.creatureName).toBe(creatureName);
                expect(result.eventData).toBe(attack);
                expect(result.isStale).toBe(false);
            }
    });

    // ─── rollbackSpellEffects ─────────────────────────────────

    describe('rollbackSpellEffects', () => {
        function makeSpellLastAttack(overrides = {}) {
            return {
                attackerName: 'Goblin',
                targetName: 'Hero',
                attackName: 'Fire Bolt',
                damageName: 'Fire Bolt',
                primaryDamage: 8,
                secondaryDamage: 0,
                actualDamage: 8,
                affectedTargets: ['Hero'],
                statusEffects: null,
                ...overrides,
            };
        }

        const cs = { creatures: [{ name: 'Hero', currentHp: 10, maxHp: 20 }] };

        it('returns early when no combat context is provided and fetch returns null', async () => {
            getCombatContext.mockResolvedValue(null);
            const result = await rollbackSpellEffects(makeSpellLastAttack(), campaignName, 'Counterspell');
            expect(result).toEqual({ targetsHealed: 0, conditionsRemoved: [], effectsRemoved: 0, damageHealed: 0, logDescription: '' });
            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('uses provided combat context instead of re-fetching', async () => {
            const attack = makeSpellLastAttack();
            applyHealingToTarget.mockReturnValue({ newHp: 18, actualHeal: 8, oldHp: 10 });

            const result = await rollbackSpellEffects(attack, campaignName, 'Counterspell', cs);

            expect(getCombatContext).not.toHaveBeenCalled();
            expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Hero', 8, campaignName);
            expect(result.damageHealed).toBe(8);
            expect(result.targetsHealed).toBe(1);
        });

        it('falls back to re-fetching combat context when not provided', async () => {
            getCombatContext.mockResolvedValue(cs);
            applyHealingToTarget.mockReturnValue({ newHp: 18, actualHeal: 8, oldHp: 10 });

            const result = await rollbackSpellEffects(makeSpellLastAttack(), campaignName, 'Counterspell');

            expect(getCombatContext).toHaveBeenCalledWith(campaignName);
            expect(result.damageHealed).toBe(8);
        });

        it('uses actualDamage over primaryDamage when available', async () => {
            const attack = makeSpellLastAttack({ primaryDamage: 15, secondaryDamage: 3, actualDamage: 9 });
            applyHealingToTarget.mockReturnValue({ newHp: 19, actualHeal: 9, oldHp: 10 });

            const result = await rollbackSpellEffects(attack, campaignName, 'Counterspell', cs);

            expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Hero', 9, campaignName);
            expect(result.damageHealed).toBe(9);
        });

        it('falls back to primaryDamage + secondaryDamage when actualDamage is absent', async () => {
            const attack = makeSpellLastAttack({ primaryDamage: 8, secondaryDamage: 5, actualDamage: undefined });
            applyHealingToTarget.mockReturnValue({ newHp: 23, actualHeal: 13, oldHp: 10 });

            const result = await rollbackSpellEffects(attack, campaignName, 'Counterspell', cs);

            expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Hero', 13, campaignName);
            expect(result.damageHealed).toBe(13);
        });

        it('removes conditions from lastAttack.statusEffects', async () => {
            const attack = makeSpellLastAttack({ statusEffects: ['burning', 'frightened'] });

            await rollbackSpellEffects(attack, campaignName, 'Counterspell', cs);

            expect(removeCondition).toHaveBeenCalledTimes(2);
            expect(removeCondition).toHaveBeenCalledWith({ combatSummary: cs, creatureName: 'Hero', condition: 'burning', getRuntimeValue, setRuntimeValue, campaignName });
            expect(removeCondition).toHaveBeenCalledWith({ combatSummary: cs, creatureName: 'Hero', condition: 'frightened', getRuntimeValue, setRuntimeValue, campaignName });
        });

        it('removes targetEffects for the attacker', async () => {
            const storedEffects = [
                { target: 'Hero', source: 'Goblin', effect: 'fire' },
                { target: 'Hero', source: 'Orc', effect: 'poison' },
            ];
            getRuntimeValue.mockReturnValue(storedEffects);

            const result = await rollbackSpellEffects(makeSpellLastAttack(), campaignName, 'Counterspell', cs);

            expect(result.effectsRemoved).toBe(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{ target: 'Hero', source: 'Orc', effect: 'poison' }], campaignName);
        });

        it('handles AoE with multiple targets', async () => {
            const attack = makeSpellLastAttack({
                affectedTargets: ['Hero', 'Wizard'],
                primaryDamage: 10,
                actualDamage: 10,
            });
            applyHealingToTarget.mockReturnValue({ newHp: 20, actualHeal: 10, oldHp: 10 });

            const result = await rollbackSpellEffects(attack, campaignName, 'Counterspell', cs);

            expect(applyHealingToTarget).toHaveBeenCalledTimes(2);
            expect(result.targetsHealed).toBe(2);
            expect(result.damageHealed).toBe(20);
        });

        it('builds logDescription with spell name and summary', async () => {
            const attack = makeSpellLastAttack({ attackName: 'Fireball', statusEffects: ['burning'] });
            applyHealingToTarget.mockReturnValue({ newHp: 20, actualHeal: 8, oldHp: 10 });

            const result = await rollbackSpellEffects(attack, campaignName, 'Counterspell', cs);

            expect(result.logDescription).toContain("Goblin's spell 'Fireball'");
            expect(result.logDescription).toContain('8 HP healed');
            expect(result.logDescription).toContain('1 condition(s) removed');
            expect(result.logDescription).toContain('Hero');
        });

        it('falls back to damageName when attackName is absent', async () => {
            const attack = makeSpellLastAttack({ attackName: undefined, damageName: 'Lightning Bolt' });

            await rollbackSpellEffects(attack, campaignName, 'Counterspell', cs);

            // Should not throw — spellName resolves to 'Lightning Bolt'
        });

        it('uses affectedTargets from lastAttack instead of targetName', async () => {
            const attack = makeSpellLastAttack({
                targetName: 'Hero',
                affectedTargets: ['Hero', 'Wizard'],
                primaryDamage: 6,
                actualDamage: 6,
            });
            applyHealingToTarget.mockReturnValue({ newHp: 16, actualHeal: 6, oldHp: 10 });

            const result = await rollbackSpellEffects(attack, campaignName, 'Counterspell', cs);

            expect(applyHealingToTarget).toHaveBeenCalledTimes(2);
            expect(result.targetsHealed).toBe(2);
        });
    });
});
});
