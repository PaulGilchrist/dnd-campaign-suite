// @maintained-by-ai
// no-oa / speedy lane for ConditionEffectBadges: exact badge faces (label,
// semantic class, icon, tooltip) for 'No OA' and 'No OA (Crit)' plus the
// three prop-driven Speedy badges, and the × click that clears each runtime
// flag back to false. Owned elsewhere, not repeated here: label-only No OA
// render + empty state + Insp. Move / CLA-353 negatives live in
// ConditionEffectBadges.test.jsx; dedupe/order in common.test.jsx; generic
// target_effect removal dispatch in target-effect-removal.test.jsx.
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

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(),
}));

const CREATURE_NAME = 'Alice';
const CAMPAIGN_NAME = 'test-campaign';

// House-shape of computeConditionEffects output with every guard falsy;
// makeEffects flips exactly the flags a test exercises.
const defaultEffects = {
    speedReduction: 0,
    attackAdvantageCount: 0,
    attackAdvantageReasons: [],
    targetAdvantageCount: 0,
    targetAdvantageReasons: [],
    targetDisadvantageCount: 0,
    targetAttackDisadvantageCount: 0,
    saveAdvantageCount: 0,
    saveAdvantageReasons: [],
    dexSaveAdvantageCount: 0,
    saveDisadvantageCount: 0,
    saveDisadvantage: [],
    abilityCheckDisadvantageAbilities: null,
    abilityCheckAdvantageAbilities: null,
    abilityCheckAdvantage: false,
    abilityCheckAdvantageReasons: [],
    riderSaveDisadvantage: false,
    riderAttackBonus: 0,
    riderCannotOpportunityAttack: false,
    noAdvantageAgainst: false,
    hasteActive: false,
    barkskinActive: false,
    banePenalty: false,
};

function makeEffects(overrides = {}) {
    return { ...defaultEffects, ...overrides };
}

// props → component props; runtime → runtime-store keys for CREATURE_NAME.
function renderWithProps(props = {}, runtime = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return [];
        if (name === CREATURE_NAME && key in runtime) return runtime[key];
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
        // Determinism: clearAllMocks does not reset mockReturnValue, so pin
        // the clean baseline here instead of relying on test order.
        computeConditionEffects.mockReturnValue(makeEffects({}));
    });

    it('renders the No OA badge face when riderCannotOpportunityAttack is true', () => {
        computeConditionEffects.mockReturnValue(makeEffects({ riderCannotOpportunityAttack: true }));
        renderWithProps();
        const badge = screen.getByText('No OA');
        expect(badge.closest('[class*="effect-debuff"]')).toBeInTheDocument();
        expect(badge.querySelector('[class*="fa-ban"]')).toBeInTheDocument();
        // Unremovable-source badge: builder leaves tooltip undefined, so the
        // EFFECT_DESCRIPTIONS fallback copy is the observable contract.
        expect(screen.getByTitle('Cannot make opportunity attacks.')).toBeInTheDocument();
    });

    it('renders the No OA (Crit) badge face from the remarkableAthleteNoOA runtime flag', () => {
        renderWithProps({}, { remarkableAthleteNoOA: true });
        const badge = screen.getByText('No OA (Crit)');
        expect(badge.closest('[class*="effect-buff"]')).toBeInTheDocument();
        expect(badge.querySelector('[class*="fa-ban"]')).toBeInTheDocument();
        expect(screen.getByTitle('Remarkable Athlete: the creature does not provoke opportunity attacks on critical hits.')).toBeInTheDocument();
    });

    describe('Speedy badges (props-based)', () => {
        const speedyBadges = [
            { prop: 'hasSpeedyOpportunityDisadvantage', label: 'OA Disadv', cls: 'effect-buff', icon: 'fa-arrow-down', tooltip: 'Opportunity attacks against this creature have disadvantage.' },
            { prop: 'hasSpeedyDifficultTerrainIgnore', label: 'No Difficult Terrain on Dash', cls: 'effect-buff', icon: 'fa-person-walking', tooltip: 'Can ignore difficult terrain when taking the Dash action.' },
            { prop: 'coronaDisadvantage', label: 'Disadv Fire/Radiant', cls: 'effect-debuff', icon: 'fa-sun', tooltip: 'Has disadvantage on saving throws against Fire and Radiant damage.' },
        ];

        it.each(speedyBadges)(
            'renders the full $label badge face when $prop is true',
            ({ prop, label, cls, icon, tooltip }) => {
                renderWithProps({ [prop]: true });
                const badge = screen.getByText(label);
                expect(badge.closest(`[class*="${cls}"]`)).toBeInTheDocument();
                expect(badge.querySelector(`[class*="${icon}"]`)).toBeInTheDocument();
                expect(screen.getByTitle(tooltip)).toBeInTheDocument();
            }
        );
    });

    describe('Speedy badge removal handlers', () => {
        const removalTests = [
            { key: 'hasSpeedyOpportunityDisadvantage', props: { hasSpeedyOpportunityDisadvantage: true } },
            { key: 'hasSpeedyDifficultTerrainIgnore', props: { hasSpeedyDifficultTerrainIgnore: true } },
            { key: 'coronaDisadvantage', props: { coronaDisadvantage: true } },
            { key: 'remarkableAthleteNoOA', runtime: true },
        ];

        it.each(removalTests)(
            'clears $key to false when its badge remove button is clicked',
            ({ key, props = {}, runtime = false }) => {
                renderWithProps(props, runtime ? { [key]: true } : {});
                // Exactly one badge is lit, so exactly one remove button.
                const removeBtn = screen.getByTitle('Remove effect');
                fireEvent.click(removeBtn);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    CREATURE_NAME,
                    key,
                    false,
                    CAMPAIGN_NAME
                );
            }
        );
    });
});
