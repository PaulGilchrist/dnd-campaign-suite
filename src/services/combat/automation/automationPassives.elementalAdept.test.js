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

describe('hasIgnoreResistance – passive_rule ignore_resistance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getChosenRuntimeValue.mockReturnValue(undefined);
    });

    it('returns false when no passives exist', () => {
        const ps = makePlayerStats();
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('returns false when passives array is empty', () => {
        const ps = makePlayerStats({ automation: { passives: [] } });
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('returns true when hardcoded damageTypes include the damage type', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'passive_rule',
                    effect: 'ignore_resistance',
                    damageTypes: ['Fire', 'Cold'],
                }],
            },
        });
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Cold')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Lightning')).toBe(false);
    });

    it('returns true when damageTypes array is empty (all types)', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'passive_rule',
                    effect: 'ignore_resistance',
                    damageTypes: [],
                }],
            },
        });
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Thunder')).toBe(true);
    });

    it('is case-insensitive for damage type matching', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'passive_rule',
                    effect: 'ignore_resistance',
                    damageTypes: ['Fire', 'COLD'],
                }],
            },
        });
        expect(hasIgnoreResistance(ps, 'fire')).toBe(true);
        expect(hasIgnoreResistance(ps, 'cold')).toBe(true);
        expect(hasIgnoreResistance(ps, 'FIRE')).toBe(true);
    });

    it('skips non-matching passive types', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{ type: 'passive_buff', effect: 'test' }],
            },
        });
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('skips passive_rule without ignore_resistance effect', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'passive_rule',
                    effect: 'bonus_healing',
                    damageTypes: ['Fire'],
                }],
            },
        });
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('returns true when multiple passives include a matching ignore_resistance', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_buff', effect: 'blindsight' },
                    {
                        type: 'passive_rule',
                        effect: 'ignore_resistance',
                        damageTypes: ['Lightning'],
                    },
                ],
            },
        });
        expect(hasIgnoreResistance(ps, 'Lightning')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('handles null/undefined automation gracefully', () => {
        const ps = makePlayerStats({ automation: null });
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });
});

describe('hasIgnoreResistance – damage_type_choice elemental_adept', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getChosenRuntimeValue.mockReturnValue(undefined);
    });

    it('returns false when elemental_adept passive exists but no type chosen', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_adept',
                    name: 'Energy Mastery',
                    damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
                }],
            },
        });
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('returns true when runtime chosen type matches', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_adept',
                    name: 'Energy Mastery',
                    damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
                }],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Lightning')).toBe(false);
    });

    it('is case-insensitive for chosen type matching', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_adept',
                    name: 'Energy Mastery',
                    damageTypes: ['Fire'],
                }],
            },
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
                    {
                        type: 'damage_type_choice',
                        effect: 'elemental_adept',
                        name: 'Elemental Adept (Fire)',
                        damageTypes: ['Fire'],
                    },
                    {
                        type: 'damage_type_choice',
                        effect: 'elemental_adept',
                        name: 'Elemental Adept (Cold)',
                        damageTypes: ['Cold'],
                    },
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
});

describe('hasIgnoreResistance – combined passive_rule and damage_type_choice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getChosenRuntimeValue.mockReturnValue(undefined);
    });

    it('returns true for passive_rule damage type even when elemental_adept chosen type differs', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [
                    {
                        type: 'passive_rule',
                        effect: 'ignore_resistance',
                        damageTypes: ['Fire'],
                    },
                    {
                        type: 'damage_type_choice',
                        effect: 'elemental_adept',
                        name: 'Energy Mastery',
                        damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
                    },
                ],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Cold');

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Cold')).toBe(true);
    });

    it('returns true when only elemental_adept chosen type matches', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [
                    {
                        type: 'passive_rule',
                        effect: 'ignore_resistance',
                        damageTypes: ['Fire'],
                    },
                    {
                        type: 'damage_type_choice',
                        effect: 'elemental_adept',
                        name: 'Energy Mastery',
                        damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
                    },
                ],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Lightning');

        expect(hasIgnoreResistance(ps, 'Lightning')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Cold')).toBe(false);
    });
});

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
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_adept',
                    name: 'Energy Mastery',
                    damageTypes: ['Fire'],
                    minDamage: true,
                }],
            },
        });

        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns true when runtime chosen type matches and minDamage is set', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_adept',
                    name: 'Energy Mastery',
                    damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
                    minDamage: true,
                }],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Cold');

        expect(hasMinDamage(ps, 'Cold')).toBe(true);
        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns false when minDamage is not set (undefined)', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_adept',
                    name: 'Energy Mastery',
                    damageTypes: ['Fire'],
                }],
            },
        });

        getChosenRuntimeValue.mockReturnValue('Fire');

        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns false when minDamage is explicitly false', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_adept',
                    name: 'Energy Mastery',
                    damageTypes: ['Fire'],
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
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_adept',
                    name: 'Energy Mastery',
                    damageTypes: ['Fire'],
                    minDamage: true,
                }],
            },
        });

        getChosenRuntimeValue.mockReturnValue('fire');

        expect(hasMinDamage(ps, 'FIRE')).toBe(true);
    });

    it('checks all elemental_adept passives with minDamage when multiple exist', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [
                    {
                        type: 'damage_type_choice',
                        effect: 'elemental_adept',
                        name: 'Elemental Adept (Fire)',
                        damageTypes: ['Fire'],
                        minDamage: true,
                    },
                    {
                        type: 'damage_type_choice',
                        effect: 'elemental_adept',
                        name: 'Elemental Adept (Cold)',
                        damageTypes: ['Cold'],
                        minDamage: true,
                    },
                ],
            },
        });

        getChosenRuntimeValue
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce('Cold');

        expect(hasMinDamage(ps, 'Cold')).toBe(true);
        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });
});
