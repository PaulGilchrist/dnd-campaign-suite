// @improved-by-ai
// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
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

describe('ConditionEffectBadges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('empty state', () => {
        it('should render nothing when conditions is empty and no effects apply', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === CREATURE_NAME && key === 'activeBuffs') return [];
                return null;
            });
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                />
            );
            // With no badges, there should be no clickable elements or badge text
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });
    });

    describe('badges from conditions and target effects', () => {
        it.each([
            ['Speed -15', { speedReduction: 15 }, 'Speed -15'],
            ['Speed 0', { speedReduction: 1000 }, 'Speed 0'],
            ['Disadv vs', { targetDisadvantageCount: 2 }, 'Disadv vs'],
            ['No Adv vs', { noAdvantageAgainst: true }, 'No Adv vs'],
            ['Save Disadv', { riderSaveDisadvantage: true }, 'Save Disadv'],
            ['+5 to hit', { riderAttackBonus: 5 }, '+5 to hit'],
            ['No OA', { riderCannotOpportunityAttack: true }, 'No OA'],
        ])('should render %s badge when condition is active', (_, effects, expectedLabel) => {
            computeConditionEffects.mockReturnValue(makeEffects(effects));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                />
            );
            expect(screen.getByText(expectedLabel)).toBeInTheDocument();
        });

        it('should prefer No Adv vs over Disadv vs when both are set', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ noAdvantageAgainst: true, targetDisadvantageCount: 3 }));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                />
            );
            expect(screen.getByText('No Adv vs')).toBeInTheDocument();
            expect(screen.queryByText('Disadv vs')).not.toBeInTheDocument();
        });
    });

    describe('badges from props', () => {
        it('should render Insp. Move badge when inspiringMovementNoOA is set', () => {
            getRuntimeValue.mockReturnValue(true);
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                />
            );
            expect(screen.getByText('Insp. Move')).toBeInTheDocument();
        });

        // CLA-353: the tactical_shift_no_oa passive is permanent for lv5+ Fighters —
        // it must never render an always-on badge. Protection shows only via the
        // no_opportunity_attacks te written at Second Wind activation.
        it('does not render any no-OA move badge without inspiringMovementNoOA or the te (CLA-353)', () => {
            getRuntimeValue.mockReturnValue(null);
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                />
            );
            expect(screen.queryByText('Insp. Move')).not.toBeInTheDocument();
            expect(screen.queryByText('No OA')).not.toBeInTheDocument();
        });

        it('renders No OA badge with Tactical Shift source from the te (CLA-353)', () => {
            getRuntimeValue.mockReturnValue(null);
            computeConditionEffects.mockReturnValue(makeEffects({ riderCannotOpportunityAttack: true }));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[{ target: CREATURE_NAME, source: 'Tactical Shift', effect: 'no_opportunity_attacks', duration: 'until_start_of_next_turn' }]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                />
            );
            const badge = screen.getByText('No OA');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('[title]')).toHaveAttribute('title', expect.stringContaining('Tactical Shift'));
        });
    });
});
