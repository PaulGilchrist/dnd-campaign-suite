import { hasIgnoreResistance, hasMinDamage } from './automationPassives.js';
import { buildAttackInfo } from './automationInfoBuilder.js';
import { seedTrackedResources } from '../../hooks/runtime/useRuntimeState.js';

describe('Elemental Adept – hasIgnoreResistance', () => {
    const makePlayerStats = (extra = {}) => ({
        name: 'TestChar1',
        campaignName: 'test-campaign',
        automation: { passives: [] },
        ...extra,
    });

    beforeEach(() => {
        seedTrackedResources('TestChar1', {});
    });

    it('returns false when no passives exist', () => {
        const ps = makePlayerStats();
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('returns true when hardcoded damageTypes match', () => {
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

    it('returns true when Elemental Adept runtime chosen type matches', () => {
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

        seedTrackedResources(ps.name, { '_Energy_Mastery_chosenType': 'Fire' });

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Lightning')).toBe(false);
    });
});

describe('Elemental Adept – hasMinDamage', () => {
    const makePlayerStats = (extra = {}) => ({
        name: 'TestChar2',
        campaignName: 'test-campaign',
        automation: { passives: [] },
        ...extra,
    });

    beforeEach(() => {
        seedTrackedResources('TestChar2', {});
    });

    it('returns false when no passives exist', () => {
        const ps = makePlayerStats();
        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns false when Elemental Adept passive exists but no type chosen', () => {
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

    it('returns true when Elemental Adept runtime chosen type matches', () => {
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

        seedTrackedResources(ps.name, { '_Energy_Mastery_chosenType': 'Cold' });

        expect(hasMinDamage(ps, 'Cold')).toBe(true);
        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });

    it('returns false for non-Elemental Adept damage_type_choice', () => {
        const ps = makePlayerStats({
            automation: {
                passives: [{
                    type: 'damage_type_choice',
                    effect: 'elemental_affinity',
                    name: 'Elemental Affinity',
                    damageTypes: ['Fire'],
                    minDamage: false,
                }],
            },
        });

        expect(hasMinDamage(ps, 'Fire')).toBe(false);
    });
});

describe('buildAttackInfo – damage_type_choice with minDamage', () => {
    const BASE_FEATURE = { name: 'Energy Mastery' };

    it('returns minDamage property when present in automation', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'damage_type_choice',
                damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
                effect: 'elemental_adept',
                minDamage: true,
            },
        };
        const result = buildAttackInfo(feature);
        expect(result.type).toBe('damage_type_choice');
        expect(result.minDamage).toBe(true);
        expect(result.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
    });

    it('returns minDamage false when not present', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'damage_type_choice',
                damageTypes: ['Fire'],
                effect: 'some_other_effect',
            },
        };
        const result = buildAttackInfo(feature);
        expect(result.minDamage).toBe(false);
    });
});
