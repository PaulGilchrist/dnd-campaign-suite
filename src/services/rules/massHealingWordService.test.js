import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('./damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('./applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => 10),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { triggerMassHealingWord } from './massHealingWordService.js';
import { getCombatContext } from './damageUtils.js';
import { rollExpression } from '../dice/diceRoller.js';

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

    it('returns null for non-Mass Healing Word spells', async () => {
        getCombatContext.mockResolvedValue(null);
        const result = await triggerMassHealingWord(makeSpell('Fire Bolt', 0), {}, makePlayerStats(), CAMPAIGN, 'testMap');
        expect(result).toBeNull();
    });

    it('returns null when no heal_at_slot_level data', async () => {
        getCombatContext.mockResolvedValue(null);
        const spell = { name: 'Mass Healing Word', level: 3, heal_at_slot_level: null };
        const result = await triggerMassHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
        expect(result).toBeNull();
    });

    it('returns null when combat context is unavailable', async () => {
        getCombatContext.mockResolvedValue(null);
        const spell = makeSpell('Mass Healing Word', 3);
        const result = await triggerMassHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
        expect(result).toBeNull();
    });

    it('heals up to 6 creatures', async () => {
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
        rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });

        const spell = makeSpell('Mass Healing Word', 3);
        const playerStats = makePlayerStats(3);
        const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

        expect(result).not.toBeNull();
        expect(result.targets.length).toBe(6);
        expect(result.totalHealed).toBeGreaterThan(0);
        expect(result.formula).toBe('2d4 + 3');
    });

    it('excludes the caster from targets', async () => {
        const cs = makeCombatSummary([
            { name: 'Cleric', maxHp: 30, currentHp: 10 },
            { name: 'Ally1', maxHp: 30, currentHp: 10 },
            { name: 'Ally2', maxHp: 30, currentHp: 10 },
        ]);
        getCombatContext.mockResolvedValue(cs);
        rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });

        const spell = makeSpell('Mass Healing Word', 3);
        const playerStats = makePlayerStats(3);
        const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

        expect(result).not.toBeNull();
        expect(result.targets.length).toBe(2);
        expect(result.targets[0].targetName).toBe('Ally1');
        expect(result.targets[1].targetName).toBe('Ally2');
    });

    it('scales healing at higher slot levels', async () => {
        const cs = makeCombatSummary([
            { name: 'Ally1', maxHp: 30, currentHp: 10 },
        ]);
        getCombatContext.mockResolvedValue(cs);
        rollExpression.mockReturnValue({ total: 14, rolls: [[3, 4, 4, 3]], modifier: 3 });

        const spell = makeSpell('Mass Healing Word', 4);
        const playerStats = makePlayerStats(3);
        const result = await triggerMassHealingWord(spell, { slotLevel: 4 }, playerStats, CAMPAIGN, 'testMap');

        expect(result).not.toBeNull();
        expect(result.targets.length).toBe(1);
        expect(result.formula).toBe('3d4 + 3');
    });

    it('caps healing at target max HP', async () => {
        const cs = makeCombatSummary([
            { name: 'Ally1', maxHp: 12, currentHp: 10 },
        ]);
        getCombatContext.mockResolvedValue(cs);
        rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });

        const spell = makeSpell('Mass Healing Word', 3);
        const playerStats = makePlayerStats(3);
        const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

        expect(result).not.toBeNull();
        expect(result.targets[0].healAmount).toBe(2);
    });

    it('returns noTargets when no eligible creatures', async () => {
        const cs = makeCombatSummary([]);
        getCombatContext.mockResolvedValue(cs);
        rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });

        const spell = makeSpell('Mass Healing Word', 3);
        const playerStats = makePlayerStats(3);
        const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

        expect(result).not.toBeNull();
        expect(result.noTargets).toBe(true);
    });

    it('uses spellCastingAbility from spell when provided', async () => {
        const cs = makeCombatSummary([
            { name: 'Ally1', maxHp: 30, currentHp: 10 },
        ]);
        getCombatContext.mockResolvedValue(cs);
        rollExpression.mockReturnValue({ total: 9, rolls: [[2, 3, 4]], modifier: 4 });

        const spell = { ...makeSpell('Mass Healing Word', 3), spellCastingAbility: 'Wisdom' };
        const playerStats = makePlayerStats(4, 'Wisdom');
        const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

        expect(result).not.toBeNull();
        expect(result.formula).toBe('2d4 + 4');
    });

    it('heals creatures that are not at full HP only', async () => {
        const cs = makeCombatSummary([
            { name: 'Ally1', maxHp: 30, currentHp: 30 },
            { name: 'Ally2', maxHp: 30, currentHp: 10 },
        ]);
        getCombatContext.mockResolvedValue(cs);
        rollExpression.mockReturnValue({ total: 8, rolls: [[2, 3, 3]], modifier: 3 });

        const spell = makeSpell('Mass Healing Word', 3);
        const playerStats = makePlayerStats(3);

        // getRuntimeValue returns 10 for all targets (mocked), so both allies
        // will be healed since runtime HP (10) < maxHp (30) for both
        const result = await triggerMassHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

        expect(result).not.toBeNull();
        expect(result.targets.length).toBe(2);
        expect(result.targets[0].healAmount).toBe(8);
        expect(result.targets[1].healAmount).toBe(8);
    });
});
