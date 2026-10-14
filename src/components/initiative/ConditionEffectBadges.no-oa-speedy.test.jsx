import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

const defaultEffects = {
    cannotAct: false,
    speedZero: false,
    speedReduction: 0,
    pushEffect: false,
    pushDistance: null,
    proneEffect: false,
    autoCritWithin5ft: false,
    concentrationBroken: false,
    autoFailSaves: [],
    resistantToAll: false,
    attackDisadvantageCount: 0,
    attackDisadvantageReasons: [],
    abilityCheckDisadvantage: false,
    strCheckDisadvantage: false,
    rayOfEnfeebleDamageReduction: false,
    resistanceDamageReduction: false,
    targetAdvantageCount: 0,
    targetDisadvantageCount: 0,
    targetAttackDisadvantageCount: 0,
    riderSaveDisadvantage: false,
    riderAttackBonus: 0,
    riderCannotOpportunityAttack: false,
    riderNoReactions: false,
    noAdvantageAgainst: false,
    attackAdvantageCount: 0,
    attackAdvantageReasons: [],
    saveAdvantageCount: 0,
    saveAdvantageReasons: [],
    saveAdvantageAbilities: null,
    saveDisadvantageCount: 0,
    dexSaveAdvantageCount: 0,
    abilityCheckDisadvantageAbilities: null,
    abilityCheckAdvantageAbilities: null,
    abilityCheckAdvantage: false,
    abilityCheckAdvantageReasons: [],
    saveDisadvantage: [],
    blessBonus: false,
    beaconOfHope: false,
    hasteActive: false,
    barkskinActive: false,
    banePenalty: false,
};

function makeEffects(overrides = {}) {
    return { ...defaultEffects, ...overrides };
}

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => makeEffects({})),
}));

const CREATURE_NAME = 'Alice';
const CAMPAIGN_NAME = 'test-campaign';

function renderWithProps(props = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return [];
        return null;
    });
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={[]}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            isLocalhost={true}
            {...props}
        />
    );
}

describe('ConditionEffectBadges - No OA & Speedy Badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('No OA badges (riderCannotOpportunityAttack + remarkableAthleteNoOA)', () => {
        it('should render No OA badge with correct styling and icon when riderCannotOpportunityAttack is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderCannotOpportunityAttack: true }));
            renderWithProps();
            const badge = screen.getByText('No OA');
            expect(badge.closest('[class*="effect-debuff"]')).toBeInTheDocument();
            expect(badge.querySelector('[class*="fa-ban"]')).toBeInTheDocument();
        });

        it('should render No OA badge with correct tooltip when riderCannotOpportunityAttack is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderCannotOpportunityAttack: true }));
            renderWithProps();
            expect(screen.getByTitle('Cannot make opportunity attacks.')).toBeInTheDocument();
        });

        it('should render No OA (Crit) badge with correct styling and icon when remarkableAthleteNoOA is true', () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === CREATURE_NAME && key === 'activeBuffs') return [];
                if (name === CREATURE_NAME && key === 'remarkableAthleteNoOA') return true;
                return null;
            });
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                    isLocalhost={true}
                />
            );
            const badge = screen.getByText('No OA (Crit)');
            expect(badge.closest('[class*="effect-buff"]')).toBeInTheDocument();
            expect(badge.querySelector('[class*="fa-ban"]')).toBeInTheDocument();
        });

        it('should render No OA (Crit) badge with correct tooltip when remarkableAthleteNoOA is true', () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === CREATURE_NAME && key === 'activeBuffs') return [];
                if (name === CREATURE_NAME && key === 'remarkableAthleteNoOA') return true;
                return null;
            });
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                    isLocalhost={true}
                />
            );
            expect(screen.getByTitle(/Remarkable Athlete/)).toBeInTheDocument();
        });
    });

    describe('Speedy badges (props-based)', () => {
        const speedyBadges = [
            { label: 'OA Disadv', prop: 'hasSpeedyOpportunityDisadvantage', cls: 'effect-buff', icon: 'fa-arrow-down', tooltip: 'Opportunity attacks against this creature have disadvantage.' },
            { label: 'No Difficult Terrain on Dash', prop: 'hasSpeedyDifficultTerrainIgnore', cls: 'effect-buff', icon: 'fa-person-walking', tooltip: 'Can ignore difficult terrain when taking the Dash action.' },
            { label: 'Disadv Fire/Radiant', prop: 'coronaDisadvantage', cls: 'effect-debuff', icon: 'fa-sun', tooltip: 'Has disadvantage on saving throws against Fire and Radiant damage.' },
        ];

        it.each(speedyBadges)(
            'should render $label badge with correct styling and icon when $prop is true',
            ({ label, prop, cls, icon, tooltip: _tooltip }) => {
                const overrides = { [prop]: true };
                renderWithProps(overrides);
                const badge = screen.getByText(label);
                expect(badge.closest(`[class*="${cls}"]`)).toBeInTheDocument();
                expect(badge.querySelector(`[class*="${icon}"]`)).toBeInTheDocument();
            }
        );

        it.each(speedyBadges)(
            'should render $label badge with correct tooltip',
            ({ label: _label, prop, tooltip }) => {
                renderWithProps({ [prop]: true });
                expect(screen.getByTitle(tooltip)).toBeInTheDocument();
            }
        );
    });

    describe('Speedy badge removal handlers', () => {
        const removalTests = [
            { prop: 'hasSpeedyOpportunityDisadvantage', label: 'OA Disadv' },
            { prop: 'hasSpeedyDifficultTerrainIgnore', label: 'No Difficult Terrain on Dash' },
            { prop: 'coronaDisadvantage', label: 'Disadv Fire/Radiant' },
        ];

        it.each(removalTests)(
            'should set $prop to false when $label badge remove button is clicked',
            ({ prop, label: _label }) => {
                renderWithProps({ [prop]: true });
                const removeBtns = screen.getAllByTitle('Remove effect');
                expect(removeBtns.length).toBeGreaterThan(0);
                fireEvent.click(removeBtns[0]);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    CREATURE_NAME,
                    prop,
                    false,
                    CAMPAIGN_NAME
                );
            }
        );
    });
});
