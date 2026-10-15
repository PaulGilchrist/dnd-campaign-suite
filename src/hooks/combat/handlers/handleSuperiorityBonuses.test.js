// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applySuperiorityDamageBonuses } from './handleSuperiorityBonuses.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

// Fake runtime store: getRuntimeValue reads, setRuntimeValue writes — so the
// MN-003 "read the source stamp BEFORE it is cleared" ordering fails if swapped.
let store;

const apply = (overrides = {}) => applySuperiorityDamageBonuses({
    characterName: 'Fighter',
    campaignName: 'test-campaign',
    formula: '1d8+5',
    total: 9,
    rolls: [4, 5],
    context: { damageType: 'slashing' },
    ...overrides,
});

describe('applySuperiorityDamageBonuses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        store = {};
        getRuntimeValue.mockImplementation((_name, key) => store[key] ?? null);
        setRuntimeValue.mockImplementation((_name, key, value) => { store[key] = value; });
    });

    it('folds every armed bonus into formula, total, and rolls in registry order, clearing each consumed key', () => {
        store.feintingAttackDieValue = 4;
        store.commanderStrikeBonus = 6;
        store.commanderStrikeSource = "Commander's Strike";
        store.lungingAttackDieValue = 3;
        store.attackRiderDieValue = 5;

        const result = apply();

        expect(result.formula).toBe("1d8+5 + 4 [slashing] + 6 [Commander's Strike] + 3 [slashing] + 5 [slashing]");
        expect(result.total).toBe(27);
        expect(result.rolls).toEqual([4, 5, 4, 6, 3, 5]);
        for (const key of ['feintingAttackDieValue', 'commanderStrikeBonus', 'commanderStrikeActive', 'commanderStrikeSource', 'lungingAttackDieValue', 'attackRiderDieValue']) {
            expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', key, null, 'test-campaign');
        }
    });

    it("labels the commander's die from the source stamp read before clear, falling back to the maneuver name", () => {
        store.commanderStrikeBonus = 7;
        store.commanderStrikeSource = "Commander's Strike (Bandit)";

        expect(apply().formula).toBe("1d8+5 + 7 [Commander's Strike (Bandit)]");

        // No stamp present → fallback label, not the weapon damage type.
        store = { commanderStrikeBonus: 7 };
        expect(apply().formula).toBe("1d8+5 + 7 [Commander's Strike]");
    });

    it('coerces numeric strings and ignores zero or non-numeric bonuses without clearing them', () => {
        store.attackRiderDieValue = '6';

        const result = apply();
        expect(result.formula).toBe('1d8+5 + 6 [slashing]');
        expect(result.total).toBe(15);

        vi.clearAllMocks();
        store = { feintingAttackDieValue: 0, lungingAttackDieValue: 'abc' };

        const untouched = apply();
        expect(untouched.formula).toBe('1d8+5');
        expect(untouched.total).toBe(9);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('passes the roll through byte-identical when nothing is armed', () => {
        const result = apply();

        expect(result).toEqual({ formula: '1d8+5', total: 9, rolls: [4, 5] });
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('labels folded dice [same_as_weapon] when context is missing', () => {
        store.lungingAttackDieValue = 2;

        expect(apply({ context: undefined }).formula).toBe('1d8+5 + 2 [same_as_weapon]');
    });
});
