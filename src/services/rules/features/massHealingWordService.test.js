import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
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
    rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
    resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
    hasHealingMaximization: vi.fn(() => false),
    hasHealingMaximizationForTarget: vi.fn(() => false),
    markFortifiedHealthUsed: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { triggerMassHealingWord } from './massHealingWordService.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { hasHealingMaximization } from '../../combat/automation/automationService.js';

// ── Globals ────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

const CAMPAIGN = 'TestCampaign';

function makeSpell(name, level, healAtSlotLevel) {
    return {
        name,
        level,
        heal_at_slot_level: healAtSlotLevel || {
            '3': '2d4 + MOD',
            '4': '3d4 + MOD',
            '5': '4d4 + MOD',
            '6': '5d4 + MOD',
            '7': '6d4 + MOD',
            '8': '7d4 + MOD',
            '9': '8d4 + MOD',
        },
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
        level: 5,
    };
}

function makeCombatSummary(creatures) {
    return { round: 1, creatures };
}

// ── Tests ──────────────────────────────────────────────────────

describe('triggerMassHealingWord', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('early returns', () => {
        it('returns null for non-Mass Healing Word spells', async () => {
            const spell = makeSpell('Fire Bolt', 0);
            const result = await triggerMassHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
        });

        it('returns null when spell has no heal_at_slot_level data', async () => {
            const spell = { name: 'Mass Healing Word', level: 3, heal_at_slot_level: null };
            const result = await triggerMassHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
        });

        it('returns null when resolveHealExpression returns null for the slot level', async () => {
            const spell = { name: 'Mass Healing Word', level: 3, heal_at_slot_level: { '3': '2d4 + MOD' } };
            const result = await triggerMassHealingWord(spell, { slotLevel: 9 }, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
        });

        it('returns result with no targets when rollExpression fails', async () => {
            getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin', maxHp: 7, currentHp: 3 }]));
            rollExpression.mockReturnValue(null);

            const spell = makeSpell('Mass Healing Word', 3);
            const result = await triggerMassHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).not.toBeNull();
            expect(result.targets).toHaveLength(0);
            expect(result.totalHealed).toBe(0);
        });

        it('returns null when combat context is unavailable', async () => {
            getCombatContext.mockResolvedValue(null);

            const spell = makeSpell('Mass Healing Word', 3);
            const result = await triggerMassHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
        });
    });

    describe('target selection', () => {
        it('includes the caster in targets', async () => {
            const cs = makeCombatSummary([
                { name: 'Cleric', maxHp: 30, currentHp: 10 },
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
                { name: 'Ally2', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targets.length).toBe(3);
            expect(result.targets.map(t => t.targetName)).toContain('Cleric');
            expect(result.targets.map(t => t.targetName)).toContain('Ally1');
            expect(result.targets.map(t => t.targetName)).toContain('Ally2');
        });

        it('returns noTargets when creature list is empty', async () => {
            const cs = makeCombatSummary([]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.noTargets).toBe(true);
        });

        it('limits targets to 6 creatures', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
                { name: 'Ally2', maxHp: 25, currentHp: 5 },
                { name: 'Ally3', maxHp: 20, currentHp: 2 },
                { name: 'Ally4', maxHp: 35, currentHp: 15 },
                { name: 'Ally5', maxHp: 28, currentHp: 8 },
                { name: 'Ally6', maxHp: 32, currentHp: 12 },
                { name: 'Ally7', maxHp: 30, currentHp: 10 },
                { name: 'Ally8', maxHp: 40, currentHp: 20 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targets.length).toBe(6);
        });

        it('includes all creatures regardless of distance', async () => {
            const cs = makeCombatSummary([
                { name: 'Close Goblin', maxHp: 7, currentHp: 3 },
                { name: 'Far Orc', maxHp: 15, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(3);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targets.length).toBe(2);
            expect(result.targets.map(t => t.targetName)).toContain('Close Goblin');
            expect(result.targets.map(t => t.targetName)).toContain('Far Orc');
        });

        it('takes first N creatures from the array', async () => {
            const cs = makeCombatSummary([
                { name: 'Cleric', maxHp: 50, currentHp: 20 },
                { name: 'Goblin', maxHp: 7, currentHp: 3 },
                { name: 'Orc', maxHp: 15, currentHp: 10 },
                { name: 'Troll', maxHp: 25, currentHp: 15 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result.targets.length).toBe(4);
            expect(result.targets.map(t => t.targetName)).toEqual(['Cleric', 'Goblin', 'Orc', 'Troll']);
        });
    });

    describe('healing calculations', () => {
        it('heals up to 6 creatures with correct formula', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
                { name: 'Ally2', maxHp: 25, currentHp: 5 },
                { name: 'Ally3', maxHp: 20, currentHp: 2 },
                { name: 'Ally4', maxHp: 35, currentHp: 15 },
                { name: 'Ally5', maxHp: 28, currentHp: 8 },
                { name: 'Ally6', maxHp: 32, currentHp: 12 },
                { name: 'Ally7', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 11, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targets.length).toBe(6);
            expect(result.formula).toBe('2d4 + 3');
            expect(result.totalHealed).toBe(65);
        });

        it('caps healing at target max HP', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 12, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targets[0].healAmount).toBe(2);
        });

        it('applies zero healing when creature is already at full HP from runtime storage', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 30 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(30);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targets[0].healAmount).toBe(0);
        });

        it('defaults to playerStats.hitPoints when creature has no maxHp', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', currentHp: 5 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(5);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targets[0].healAmount).toBe(8);
        });

        it('rolls per-target instead of single roll for all targets', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
                { name: 'Ally2', maxHp: 25, currentHp: 5 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression
                .mockReturnValueOnce({ total: 8, rolls: [[2, 3, 3]], modifier: 3 })
                .mockReturnValueOnce({ total: 10, rolls: [[3, 4, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(rollExpression).toHaveBeenCalledTimes(2);
            expect(result.targets[0].healAmount).toBe(8);
            expect(result.targets[1].healAmount).toBe(10);
            expect(result.totalHealed).toBe(18);
        });

        it('includes bonus healing when available', async () => {
            const { resolveHealingBonusesWithDetails } = await import('../../combat/automation/automationService.js');
            resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Test Bonus', amount: 2 }] });

            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targets[0].healAmount).toBe(10);
            expect(result.targets[0].rawTotal).toBe(10);
        });

        it('marks Fortified Health used when healing applied and bonus is from Fortified Health', async () => {
            const { resolveHealingBonusesWithDetails, markFortifiedHealthUsed } = await import('../../combat/automation/automationService.js');
            resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Fortified Health', amount: 2 }] });

            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(markFortifiedHealthUsed).toHaveBeenCalledWith(playerStats, CAMPAIGN);
        });

        it('does not mark Fortified Health when no healing applied', async () => {
            const { resolveHealingBonusesWithDetails, markFortifiedHealthUsed } = await import('../../combat/automation/automationService.js');
            resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Fortified Health', amount: 2 }] });

            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 10, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
        });
    });

    describe('maximization', () => {
        it('uses rollExpressionMaximized when healing maximization is active', async () => {
            const { rollExpressionMaximized } = await import('../../dice/diceRoller.js');
            rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [[2, 2, 2, 2]], modifier: 3 });

            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            hasHealingMaximization.mockReturnValue(true);
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(rollExpressionMaximized).toHaveBeenCalledWith('2d4 + 3');
            expect(result).not.toBeNull();
        });

        it('uses regular rollExpression when no maximization', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 5, rolls: [[1, 2, 2]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(rollExpression).toHaveBeenCalledWith('2d4 + 3');
        });
    });

    describe('slot level scaling', () => {
        it('uses spell level when no slotLevel is provided', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('2d4 + 3');
        });

        it('uses slotLevel from metaCtx when provided', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 14, rolls: [[3, 4, 4, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, { slotLevel: 4 }, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('3d4 + 3');
        });

        it('falls back to highest available slot level when slotLevel exceeds defined levels', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = { name: 'Mass Healing Word', level: 3, heal_at_slot_level: { '3': '2d4 + MOD' } };
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, { slotLevel: 9 }, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('2d4 + 3');
        });

        it('uses highest slot level below or equal to requested', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 11, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = {
                name: 'Mass Healing Word', level: 3,
                heal_at_slot_level: { '3': '2d4 + MOD', '5': '4d4 + MOD' },
            };
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, { slotLevel: 6 }, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('4d4 + 3');
        });
    });

    describe('spell casting ability', () => {
        it('uses spellCastingAbility from spell when provided', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 9, rolls: [[2, 3, 4]], modifier: 4 });
            getRuntimeValue.mockReturnValue(10);

            const spell = { ...makeSpell('Mass Healing Word', 3), spellCastingAbility: 'Wisdom' };
            const playerStats = makePlayerStats(4, 'Wisdom');
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('2d4 + 4');
        });

        it('falls back to spellAbilities.modifier when no spellCastingAbility on spell', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3, 'Charisma');
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('2d4 + 3');
        });

        it('returns 0 modifier when playerStats has no abilities or spellAbilities', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 2, rolls: [[2]], modifier: 0 });
            getRuntimeValue.mockReturnValue(10);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = { name: 'Cleric', hitPoints: 30 };
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('2d4 + 0');
        });

        it('uses spellCastingAbility from spell even when playerStats has different ability', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 9, rolls: [[2, 3, 4]], modifier: 4 });
            getRuntimeValue.mockReturnValue(10);

            const spell = { ...makeSpell('Mass Healing Word', 3), spellCastingAbility: 'Wisdom' };
            const playerStats = makePlayerStats(3, 'Charisma');
            playerStats.abilities.push({ name: 'Wisdom', bonus: 4 });
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.formula).toBe('2d4 + 4');
        });
    });

    describe('runtime storage fallback', () => {
        it('treats empty string runtime value as full HP', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue('');

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targets[0].healAmount).toBe(0);
        });

        it('uses maxHp when runtime value is null', async () => {
            const cs = makeCombatSummary([
                { name: 'Ally1', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });
            getRuntimeValue.mockReturnValue(null);

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.targets[0].healAmount).toBe(0);
        });
    });

    describe('logging and events', () => {
        it('posts log entries for each target that receives healing', async () => {
            const { resolveHealingBonusesWithDetails } = await import('../../combat/automation/automationService.js');
            resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockImplementation((name) => {
                if (name === 'Goblin') return 5;
                return null;
            });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                ],
            });

            await triggerMassHealingWord(
                makeSpell('Mass Healing Word', 3),
                {},
                makePlayerStats(3),
                CAMPAIGN,
                'testMap',
            );

            const goblinCall = addEntry.mock.calls.find(
                (call) => call[1]?.targetName === 'Goblin',
            );
            expect(goblinCall).toBeDefined();
            expect(goblinCall[1]).toEqual(expect.objectContaining({
                type: 'hp_change',
                targetName: 'Goblin',
                delta: 2,
                isHealing: true,
                sourceName: 'Cleric',
                note: 'Mass Healing Word',
            }));
        });

        it('dispatches combat-summary-updated event', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockImplementation((name) => {
                if (name === 'Goblin') return 5;
                return null;
            });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 5 },
                ],
            });

            const eventHandler = vi.fn();
            window.addEventListener('combat-summary-updated', eventHandler);

            await triggerMassHealingWord(
                makeSpell('Mass Healing Word', 3),
                {},
                makePlayerStats(3),
                CAMPAIGN,
                'testMap',
            );

            expect(eventHandler).toHaveBeenCalled();

            window.removeEventListener('combat-summary-updated', eventHandler);
        });
    });

    describe('result structure', () => {
        it('returns correct result structure with targets, formula, and totalHealed', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockImplementation((name) => {
                if (name === 'Goblin') return 5;
                if (name === 'Orc') return 10;
                return null;
            });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                    { name: 'Orc', gridX: 7, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 5 },
                    { name: 'Orc', maxHp: 15, currentHp: 10 },
                ],
            });

            const result = await triggerMassHealingWord(
                makeSpell('Mass Healing Word', 3),
                {},
                makePlayerStats(3),
                CAMPAIGN,
                'testMap',
            );

            expect(result).toEqual(expect.objectContaining({
                targets: expect.arrayContaining([
                    expect.objectContaining({ targetName: 'Goblin', healAmount: 2 }),
                    expect.objectContaining({ targetName: 'Orc', healAmount: 5 }),
                ]),
                formula: '2d4 + 3',
                totalHealed: 7,
            }));
        });

        it('calculates totalHealed as sum of all individual heal amounts', async () => {
            rollExpression.mockReturnValue({ total: 25, rolls: [13, 12] });
            getRuntimeValue.mockReturnValue(1);
            getCombatContext.mockResolvedValue({
                players: [],
                creatures: [
                    { name: 'Goblin', maxHp: 7, currentHp: 1 },
                    { name: 'Orc', maxHp: 15, currentHp: 1 },
                    { name: 'Troll', maxHp: 25, currentHp: 1 },
                    { name: 'Ogre', maxHp: 30, currentHp: 1 },
                    { name: 'Yeti', maxHp: 40, currentHp: 1 },
                    { name: 'Giant', maxHp: 60, currentHp: 1 },
                ],
            });

            const result = await triggerMassHealingWord(
                makeSpell('Mass Healing Word', 3),
                {},
                makePlayerStats(3),
                CAMPAIGN,
                'testMap',
            );

            expect(result.targets).toHaveLength(6);
            expect(result.totalHealed).toBeGreaterThan(0);
            expect(result.totalHealed).toBe(
                result.targets.reduce((sum, t) => sum + t.healAmount, 0),
            );
        });
    });
});
