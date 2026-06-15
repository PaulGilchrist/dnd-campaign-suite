import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => 10),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { triggerHealingWord } from './healingWordService.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
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
    });

    it('returns null for non-Healing Word spells', async () => {
        const result = await triggerHealingWord(makeSpell('Fire Bolt', 0), {}, makePlayerStats(), CAMPAIGN, 'testMap');
        expect(result).toBeNull();
    });

    it('returns null when no heal_at_slot_level data', async () => {
        const spell = { name: 'Healing Word', level: 1, heal_at_slot_level: null };
        const result = await triggerHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
        expect(result).toBeNull();
    });

    it('returns null when combat context is unavailable', async () => {
        getCombatContext.mockResolvedValueOnce(null);
        const spell = makeSpell('Healing Word', 1);
        const result = await triggerHealingWord(spell, {}, makePlayerStats(), CAMPAIGN, 'testMap');
        expect(result).toBeNull();
    });

    it('applies healing with spellcasting modifier', async () => {
        const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
        getCombatContext.mockResolvedValueOnce(cs);
        getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
        rollExpression.mockReturnValueOnce({ total: 8, rolls: [[2, 4]], modifier: 3 });

        const spell = makeSpell('Healing Word', 1);
        const playerStats = makePlayerStats(3);
        const result = await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

        expect(result).not.toBeNull();
        expect(result.targetName).toBe('Ally');
        expect(result.healAmount).toBe(8);
        expect(result.formula).toBe('2d4 + 3');
    });

    it('applies healing with zero modifier', async () => {
        const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
        getCombatContext.mockResolvedValueOnce(cs);
        getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
        rollExpression.mockReturnValueOnce({ total: 5, rolls: [[2, 3]], modifier: 0 });

        const spell = makeSpell('Healing Word', 1);
        const playerStats = makePlayerStats(0);
        const result = await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

        expect(result).not.toBeNull();
        expect(result.healAmount).toBe(5);
        expect(result.formula).toBe('2d4 + 0');
    });

    it('scales healing at higher slot levels', async () => {
        const cs = makeCombatSummary([{ name: 'Ally', maxHp: 30, currentHp: 10 }]);
        getCombatContext.mockResolvedValueOnce(cs);
        getTargetFromAttacker.mockReturnValueOnce({ name: 'Ally' });
        rollExpression.mockReturnValueOnce({ total: 10, rolls: [[2, 3, 5]], modifier: 3 });

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

        const spell = { ...makeSpell('Healing Word', 1), spellCastingAbility: 'Wisdom' };
        const playerStats = makePlayerStats(4, 'Wisdom');
        const result = await triggerHealingWord(spell, {}, playerStats, CAMPAIGN, 'testMap');

        expect(result).not.toBeNull();
        expect(result.formula).toBe('2d4 + 4');
    });
});
