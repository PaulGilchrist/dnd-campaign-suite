// @improved-by-ai
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
    getChosenRuntimeValue: vi.fn(),
}));

import { hasIgnoreResistance, hasMinDamage } from './automationPassives.js';
import { getChosenRuntimeValue } from '../../../services/automation/common/choiceStorage.js';

const BASE_PS = {
    name: 'TestChar',
    campaignName: 'test-campaign',
    automation: { passives: [] },
};

function makePlayerStats(extra = {}) {
    return { ...BASE_PS, ...extra };
}

const ENERGY_MASTERY_PASSIVE = {
    type: 'damage_type_choice',
    effect: 'elemental_adept',
    name: 'Energy Mastery',
    damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
};

const ENERGY_MASTERY_MIN_DAMAGE_PASSIVE = {
    ...ENERGY_MASTERY_PASSIVE,
    minDamage: true,
};

// ── hasIgnoreResistance – damage_type_choice elemental_adept ──────

describe('hasIgnoreResistance – damage_type_choice elemental_adept', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getChosenRuntimeValue.mockReturnValue(undefined);
    });

    it('returns false when elemental_adept passive exists but no type chosen', () => {
        const ps = makePlayerStats({
            automation: { passives: [ENERGY_MASTERY_PASSIVE] },
        });

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('returns true when runtime chosen type matches', () => {
        const ps = makePlayerStats({
            automation: { passives: [ENERGY_MASTERY_PASSIVE] },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Lightning')).toBe(false);
    });

    it('is case-insensitive for chosen type matching', () => {
        const ps = makePlayerStats({
            automation: { passives: [{ ...ENERGY_MASTERY_PASSIVE, damageTypes: ['Fire'] }] },
        });

        getChosenRuntimeValue.mockReturnValue('fire');

        expect(hasIgnoreResistance(ps, 'FIRE')).toBe(true);
    });

    it('returns false for non-elemental_adept damage_type_choice', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_affinity',
                    name: 'Elemental Affinity',
                    damageTypes: ['Fire'],
                }],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('checks all elemental_adept passives when multiple exist', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [
                    { ...ENERGY_MASTERY_PASSIVE, name: 'Elemental Adept (Fire)', damageTypes: ['Fire'] },
                    { ...ENERGY_MASTERY_PASSIVE, name: 'Elemental Adept (Cold)', damageTypes: ['Cold'] },
                ],
            },
        });

        getChosenRuntimeValue
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce('Cold');

        expect(hasIgnoreResistance(ps, 'Cold')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('returns false when automation is null', () => {
        const ps = makePlayerStats({ automation: null });
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('returns false when passives array is missing', () => {
        const ps = makePlayerStats({ automation: {} });
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('returns false when damageTypes array is empty on the passive', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{ ...ENERGY_MASTERY_PASSIVE, damageTypes: [] }],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);
    });

    it('verifies getChosenRuntimeValue is called with correct arguments', () => {
        const ps = makePlayerStats({
            automation: { passives: [ENERGY_MASTERY_PASSIVE] },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');
        hasIgnoreResistance(ps, 'Fire');

        expect(getChosenRuntimeValue).toHaveBeenCalledWith(
            ps,
            ENERGY_MASTERY_PASSIVE.name,
            'chosenType',
        );
    });

    it('returns false when passive has no name field', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_adept',
                    damageTypes: ['Fire'],
                }],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);

        expect(getChosenRuntimeValue).toHaveBeenCalledWith(
            ps,
            undefined,
            'chosenType',
        );
    });
});

// ── hasMinDamage – elemental_adept with minDamage ──────────────────

describe('hasMinDamage – elemental_adept with minDamage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getChosenRuntimeValue.mockReturnValue(undefined);
    });

    it('returns false when no passives exist', () => {
        const ps = makePlayerStats();
        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns false when passive is missing automation', () => {
        const ps = makePlayerStats({ automation: null });
        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns false when elemental_adept passive exists but no type chosen', () => {
        const ps = makePlayerStats({
            automation: { passives: [ENERGY_MASTERY_MIN_DAMAGE_PASSIVE] },
        });

        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns true when runtime chosen type matches and minDamage is set', () => {
        const ps = makePlayerStats({
            automation: { passives: [ENERGY_MASTERY_MIN_DAMAGE_PASSIVE] },
        });

        getChosenRuntimeValue.mockReturnValue('Cold');

        expect(hasMinDamage(ps, 'Cold')).toBe(true);
        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns false when minDamage is not set', () => {
        const ps = makePlayerStats({
            automation: { passives: [ENERGY_MASTERY_PASSIVE] },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');

        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns false when minDamage is explicitly false', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    ...ENERGY_MASTERY_PASSIVE,
                    minDamage: false,
                }],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');

        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns false for non-elemental_adept damage_type_choice even with minDamage', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_affinity',
                    name: 'Elemental Affinity',
                    damageTypes: ['Fire'],
                    minDamage: true,
                }],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');

        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('is case-insensitive for chosen type matching', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{ ...ENERGY_MASTERY_MIN_DAMAGE_PASSIVE, damageTypes: ['Fire'] }],
            },
        });

        getChosenRuntimeValue.mockReturnValue('fire');

        expect(hasMinDamage(ps, 'FIRE')).toBe(true);
    });

    it('checks all elemental_adept passives with minDamage when multiple exist', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [
                    { ...ENERGY_MASTERY_MIN_DAMAGE_PASSIVE, name: 'Elemental Adept (Fire)', damageTypes: ['Fire'] },
                    { ...ENERGY_MASTERY_MIN_DAMAGE_PASSIVE, name: 'Elemental Adept (Cold)', damageTypes: ['Cold'] },
                ],
            },
        });

        getChosenRuntimeValue
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce('Cold');

        expect(hasMinDamage(ps, 'Cold')).toBe(true);
        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('ignores passive_rule with ignore_resistance and minDamage', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'passive_rule',
                    effect: 'ignore_resistance',
                    damageTypes: ['Fire'],
                    minDamage: true,
                }],
            },
        });

        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('verifies getChosenRuntimeValue is called with correct arguments', () => {
        const ps = makePlayerStats({
            automation: { passives: [ENERGY_MASTERY_MIN_DAMAGE_PASSIVE] },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');
        hasMinDamage(ps, 'Fire');

        expect(getChosenRuntimeValue).toHaveBeenCalledWith(
            ps,
            ENERGY_MASTERY_MIN_DAMAGE_PASSIVE.name,
            'chosenType',
        );
    });
});

// ── hasIgnoreResistance – combined passive_rule and damage_type_choice ──

describe('hasIgnoreResistance – combined passive_rule and damage_type_choice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getChosenRuntimeValue.mockReturnValue(undefined);
    });

    const IGNORE_RESISTANCE_PASSIVE = {
        type: 'passive_rule',
        effect: 'ignore_resistance',
        damageTypes: ['Fire'],
    };

    it('returns true for passive_rule damage type even when elemental_adept chosen type differs', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [IGNORE_RESISTANCE_PASSIVE, ENERGY_MASTERY_PASSIVE],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Cold');

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Cold')).toBe(true);
    });

    it('returns true when only elemental_adept chosen type matches', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [IGNORE_RESISTANCE_PASSIVE, ENERGY_MASTERY_PASSIVE],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Lightning');

        expect(hasIgnoreResistance(ps, 'Lightning')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Cold')).toBe(false);
    });

    it('returns true when both passive_rule and elemental_adept match the same type', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [IGNORE_RESISTANCE_PASSIVE, ENERGY_MASTERY_PASSIVE],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);
    });

    it('returns false when neither passive_rule nor elemental_adept match', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [IGNORE_RESISTANCE_PASSIVE, ENERGY_MASTERY_PASSIVE],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Acid');

        expect(hasIgnoreResistance(ps, 'Acid')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Thunder')).toBe(false);
    });

    it('evaluates passives in order and returns on first match per passive', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [
                    ENERGY_MASTERY_PASSIVE,
                    IGNORE_RESISTANCE_PASSIVE,
                ],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');

        // elemental_adept checks chosenType 'Fire' against 'Fire' -> true
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);
        // elemental_adept checks chosenType 'Fire' against 'Cold' -> false,
        // then passive_rule checks damageTypes ['Fire'] against 'Cold' -> false
        expect(hasIgnoreResistance(ps, 'Cold')).toBe(false);
    });
});
