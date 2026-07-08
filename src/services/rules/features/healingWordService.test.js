// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerHealingWord } from './healingWordService.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { rollExpression } from '../../dice/diceRoller.js';

// ── Globals ────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

const CAMPAIGN = 'TestCampaign';

function makeSpell(name, level, range, healAtSlotLevel) {
    return {
        name,
        level,
        range: range || '60 feet',
        heal_at_slot_level: healAtSlotLevel || { '1': '2d4 + MOD', '2': '3d4 + MOD' },
    };
}

function makePlayerStats(modifier, spellCastingAbility) {
    const mod = modifier ?? 3;
    const ability = spellCastingAbility || 'Charisma';
    return {
        name: 'Cleric',
        hitPoints: 30,
        spellAbilities: { modifier: mod, spellCastingAbility: ability, saveDc: 13, toHit: 8 },
        abilities: [{ name: ability, bonus: mod }],
        proficiency: 2,
        level: 1,
    };
}

function makeCombatSummary(creatures) {
    return { round: 1, creatures };
}

// ── Tests ──────────────────────────────────────────────────────

describe('triggerHealingWord', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue(null);
        getTargetFromAttacker.mockReturnValue(null);
        rollExpression.mockReturnValue(null);
        getRuntimeValue.mockReturnValue(null);
    });

    describe('early returns (null)', () => {
        it('returns null for non-Healing Word spells, missing heal_at_slot_level, or unavailable combat context', async () => {
            let result = await triggerHealingWord(makeSpell('Fire Bolt', 0), {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
            expect(getCombatContext).not.toHaveBeenCalled();

            const spellNull = { name: 'Healing Word', level: 1, heal_at_slot_level: null };
            result = await triggerHealingWord(spellNull, {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
            expect(getCombatContext).not.toHaveBeenCalled();

            const spellEmpty = { name: 'Healing Word', level: 1, heal_at_slot_level: {} };
            result = await triggerHealingWord(spellEmpty, {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
            expect(getCombatContext).not.toHaveBeenCalled();

            const spellNoSlot = { name: 'Healing Word', level: 1, heal_at_slot_level: { '1': '2d4 + MOD' } };
            result = await triggerHealingWord(spellNoSlot, { slotLevel: 2 }, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
            expect(getCombatContext).not.toHaveBeenCalled();

            getCombatContext.mockResolvedValue(null);
            result = await triggerHealingWord(makeSpell('Healing Word', 1), {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
            expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
        });

        it('returns null when no target is found or rollExpression returns null', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce(null);

            let result = await triggerHealingWord(makeSpell('Healing Word', 1), {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();

            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce(null);

            result = await triggerHealingWord(makeSpell('Healing Word', 1), {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('returns null when spell has no name property', async () => {
            const spell = { level: 1, heal_at_slot_level: { '1': '2d4 + MOD' } };
            const result = await triggerHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
        });
    });

    describe('successful healing', () => {
        it.each([
            ['positive modifier', 3, 8, '2d4 + 3'],
            ['zero modifier', 0, 5, '2d4 + 0'],
            ['negative modifier', -3, 1, '2d4 + -3'],
        ])('applies healing with %s: healAmount=%s, formula=%s', async (_label, mod, healAmount, formula) => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: healAmount, rolls: [[2, mod > 0 ? 4 : 2]], modifier: mod });
            getRuntimeValue.mockReturnValue('10');

            const spell = makeSpell('Healing Word', 1);
            const playerStats = makePlayerStats(mod);
            const result = await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targetName).toBe('Ally');
            expect(result.healAmount).toBe(healAmount);
            expect(result.formula).toBe(formula);
        });

        it('scales healing at higher slot levels', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [[2, 3, 5]], modifier: 3 });
            getRuntimeValue.mockReturnValue('10');

            const spell = makeSpell('Healing Word', 2);
            const playerStats = makePlayerStats(3);
            const result = await triggerHealingWord(spell, { slotLevel: 2 }, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.healAmount).toBe(10);
            expect(result.formula).toBe('3d4 + 3');
        });

        it('uses spellCastingAbility from spell when provided', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 9, rolls: [[3, 6]], modifier: 4 });
            getRuntimeValue.mockReturnValue('10');

            const spell = { ...makeSpell('Healing Word', 1), spellCastingAbility: 'Wisdom' };
            const playerStats = makePlayerStats(4, 'Wisdom');
            const result = await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('2d4 + 4');
        });

        it('uses metaCtx targetName when provided instead of getTargetFromAttacker', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'OtherTarget' });
            rollExpression.mockReturnValueOnce({ total: 6, rolls: [[2, 1]], modifier: 3 });
            getRuntimeValue.mockReturnValue('10');

            const spell = makeSpell('Healing Word', 1);
            const playerStats = makePlayerStats(3);
            const result = await triggerHealingWord(spell, { targetName: 'Ally' }, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targetName).toBe('Ally');
            expect(getTargetFromAttacker).not.toHaveBeenCalled();
        });

        it('caps healing at max HP when target is already full', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 30 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 8, rolls: [[2, 6]], modifier: 3 });
            getRuntimeValue.mockReturnValue('30');

            const spell = makeSpell('Healing Word', 1);
            const playerStats = makePlayerStats(3);
            const result = await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.healAmount).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('caps healing when stored HP equals max HP', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 25, rolls: [[6, 6, 6, 6]], modifier: 3 });
            getRuntimeValue.mockReturnValue('30');

            const spell = makeSpell('Healing Word', 1);
            const playerStats = makePlayerStats(3);
            const result = await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.healAmount).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });
    });

    describe('side effects', () => {
        it('calls applyHealingToTarget with correct arguments when healing > 0', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 8, rolls: [[2, 6]], modifier: 3 });
            getRuntimeValue.mockReturnValue('10');

            const spell = makeSpell('Healing Word', 1);
            const playerStats = makePlayerStats(3);
            await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Ally', 8, CAMPAIGN);
        });

        it('does not call applyHealingToTarget when actualHeal is 0', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 30 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 8, rolls: [[2, 6]], modifier: 3 });
            getRuntimeValue.mockReturnValue('30');

            const spell = makeSpell('Healing Word', 1);
            const playerStats = makePlayerStats(3);
            await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('posts a log entry with correct data', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 8, rolls: [[2, 6]], modifier: 3 });
            getRuntimeValue.mockReturnValue('10');

            const spell = makeSpell('Healing Word', 1);
            const playerStats = makePlayerStats(3);
            await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
                type: 'hp_change',
                targetName: 'Ally',
                delta: 8,
                currentHp: 18,
                maxHp: 30,
                isHealing: true,
                sourceName: 'Cleric',
                note: 'Healing Word',
                formula: '2d4 + 3',
                timestamp: expect.any(Number),
            });
        });

        it('dispatches combat-summary-updated event', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 8, rolls: [[2, 6]], modifier: 3 });

            const spell = makeSpell('Healing Word', 1);
            const playerStats = makePlayerStats(3);
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

            await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
            dispatchSpy.mockRestore();
        });
    });

    describe('ability modifier resolution', () => {
        it('uses ability.bonus when spellCastingAbility matches an ability entry', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 12, rolls: [[4, 8]], modifier: 7 });

            const spell = { ...makeSpell('Healing Word', 1), spellCastingAbility: 'Wisdom' };
            const playerStats = {
                name: 'Cleric',
                hitPoints: 30,
                spellAbilities: { modifier: 3, spellCastingAbility: 'Charisma' },
                abilities: [{ name: 'Wisdom', bonus: 7 }],
                proficiency: 2,
                level: 1,
            };
            const result = await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('2d4 + 7');
        });

        it('uses 0 modifier when spellCastingAbility has no matching ability entry', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 2, rolls: [[2]], modifier: 0 });
            getRuntimeValue.mockReturnValue('10');

            const spell = makeSpell('Healing Word', 1);
            const playerStats = {
                name: 'Cleric',
                hitPoints: 30,
                spellAbilities: { modifier: 2, spellCastingAbility: 'Charisma' },
                abilities: [{ name: 'Strength', bonus: 5 }],
                proficiency: 2,
                level: 1,
            };
            const result = await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('2d4 + 0');
        });

        it('defaults to 0 modifier when no spell casting ability info exists', async () => {
            const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
            getCombatContext.mockResolvedValueOnce(cs);
            getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
            rollExpression.mockReturnValueOnce({ total: 2, rolls: [[2]], modifier: 0 });

            const spell = makeSpell('Healing Word', 1);
            const playerStats = {
                name: 'Cleric',
                hitPoints: 30,
                abilities: [{ name: 'Strength', bonus: 5 }],
                proficiency: 2,
                level: 1,
            };
            const result = await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('2d4 + 0');
        });
    });
});
