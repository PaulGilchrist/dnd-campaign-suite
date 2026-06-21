// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { triggerMassHealingWord } from './massHealingWordService.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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
            // Spell with heal_at_slot_level but slot level higher than any defined
            const spell = { name: 'Mass Healing Word', level: 3, heal_at_slot_level: { '3': '2d4 + MOD' } };
            const result = await triggerMassHealingWord(spell, { slotLevel: 9 }, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
        });

        it('returns null when rollExpression fails', async () => {
            getCombatContext.mockResolvedValue(makeCombatSummary([]));
            rollExpression.mockReturnValue(null);

            const spell = makeSpell('Mass Healing Word', 3);
            const result = await triggerMassHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
        });

        it('returns null when combat context is unavailable', async () => {
            getCombatContext.mockResolvedValue(null);

            const spell = makeSpell('Mass Healing Word', 3);
            const result = await triggerMassHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
            expect(result).toBeNull();
        });
    });

    describe('target selection', () => {
        it('excludes the caster from targets', async () => {
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
            expect(result.targets.length).toBe(2);
            expect(result.targets[0].targetName).toBe('Ally1');
            expect(result.targets[1].targetName).toBe('Ally2');
        });

        it('returns noTargets when all creatures are the caster', async () => {
            const cs = makeCombatSummary([
                { name: 'Cleric', maxHp: 30, currentHp: 10 },
            ]);
            getCombatContext.mockResolvedValue(cs);
            rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });

            const spell = makeSpell('Mass Healing Word', 3);
            const playerStats = makePlayerStats(3);
            const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

            expect(result).not.toBeNull();
            expect(result.noTargets).toBe(true);
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
            // Runtime HP equals max HP, so actualHeal = min(8, 30-30) = 0
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

            // Only level 3 defined, requesting level 9 — falls back to level 3
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

            // Requesting level 5, but only level 3 and 5 defined — should use level 5
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
            // Player has Charisma mod 3, but spell overrides to Wisdom mod 4
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
            // Empty string treated as full HP (defaults to maxHp=30), so actualHeal = min(8, 30-30) = 0
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
            // null treated as full HP (defaults to maxHp=30), so actualHeal = min(8, 30-30) = 0
            expect(result.targets[0].healAmount).toBe(0);
        });
    });
});
