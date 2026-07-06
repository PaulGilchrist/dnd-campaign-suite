// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
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
    abilityCheckDisadvantage: false,
    strCheckDisadvantage: false,
    rayOfEnfeebleDamageReduction: false,
    targetAdvantageCount: 0,
    targetDisadvantageCount: 0,
    riderSaveDisadvantage: false,
    riderAttackBonus: 0,
    riderCannotOpportunityAttack: false,
    riderNoReactions: false,
    noAdvantageAgainst: false,
};

function makeEffects(overrides = {}) {
    return { ...defaultEffects, ...overrides };
}

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn((_conditions, _saveModifiers, targetEffects) => {
        return makeEffects(targetEffects && targetEffects.length ? { targetAdvantageCount: 1 } : {});
    }),
}));

import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

describe('ConditionEffectBadges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('empty state', () => {
        it('should render nothing when conditions is null', () => {
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges conditions={null} creatureName="Alice" campaignName="test" />
            );
            expect(document.querySelectorAll('.condition-effect-badge').length).toBe(0);
        });
    });

    describe('cannot act effects', () => {
        it('should render Insp. Move badge when inspiringMovementNoOA runtime value is true', () => {
            getRuntimeValue.mockReturnValue(true);
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Insp. Move')).toBeInTheDocument();
            expect(getRuntimeValue).toHaveBeenCalledWith('Alice', 'inspiringMovementNoOA', 'test');
        });

        it('should render Insp. Move badge when hasTacticalShift is true', () => {
            getRuntimeValue.mockReturnValue(null);
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName="Alice"
                    campaignName="test"
                    hasTacticalShift={true}
                />
            );
            expect(screen.getByText('Insp. Move')).toBeInTheDocument();
        });
    });

    describe('speed effects', () => {
        it('should render Speed -N badge when speedReduction is set', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ speedReduction: 15 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Speed -15')).toBeInTheDocument();
        });
    });

    describe('target disadvantage', () => {
        it('should render Disadv vs badge when targetDisadvantageCount > 0', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ targetDisadvantageCount: 2 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Disadv vs')).toBeInTheDocument();
        });

        it('should render No Adv vs badge when noAdvantageAgainst is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ noAdvantageAgainst: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('No Adv vs')).toBeInTheDocument();
        });

        it('should prefer No Adv vs over Disadv vs when both are set', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ noAdvantageAgainst: true, targetDisadvantageCount: 3 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.queryByText('Disadv vs')).not.toBeInTheDocument();
        });
    });

    describe('rider effects', () => {
        it('should render Save Disadv badge when riderSaveDisadvantage is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderSaveDisadvantage: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Save Disadv')).toBeInTheDocument();
        });

        it('should render +N to hit badge when riderAttackBonus > 0', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 5 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('+5 to hit')).toBeInTheDocument();
        });

        it('should render No OA badge when riderCannotOpportunityAttack is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderCannotOpportunityAttack: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('No OA')).toBeInTheDocument();
        });
    });

    describe('remarkable athlete No OA', () => {
        it.each([
            [true, true],
            [null, false],
        ])('should render No OA (Crit) when remarkableAthleteNoOA is %s', (value, shouldRender) => {
            getRuntimeValue.mockReturnValue(value);
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.queryByText('No OA (Crit)');
            if (shouldRender) {
                expect(badge).toBeInTheDocument();
            } else {
                expect(badge).not.toBeInTheDocument();
            }
        });
    });

    describe('speedy effects', () => {
        it('should render OA Disadv badge when hasSpeedyOpportunityDisadvantage is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName="Alice"
                    campaignName="test"
                    hasSpeedyOpportunityDisadvantage={true}
                />
            );
            expect(screen.getByText('OA Disadv')).toBeInTheDocument();
        });

        it('should render No Difficult Terrain on Dash badge when hasSpeedyDifficultTerrainIgnore is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName="Alice"
                    campaignName="test"
                    hasSpeedyDifficultTerrainIgnore={true}
                />
            );
            expect(screen.getByText('No Difficult Terrain on Dash')).toBeInTheDocument();
        });
    });

    describe('GM effect removal', () => {
        it('should render removable badges with break buttons when isLocalhost is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 3, riderCannotOpportunityAttack: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[{ target: 'Goblin', effect: 'damage_bonus', value: 3 }]} creatureName="Goblin" campaignName="test" isLocalhost={true} />);
            expect(screen.getByText('+3 to hit')).toBeInTheDocument();
            expect(screen.getAllByTitle('Remove effect').length).toBe(2);
        });

        it('should not render break button when isLocalhost is false', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 3 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[{ target: 'Goblin', effect: 'damage_bonus', value: 3 }]} creatureName="Goblin" campaignName="test" isLocalhost={false} />);
            expect(screen.getByText('+3 to hit')).toBeInTheDocument();
            expect(screen.queryByTitle('Remove effect')).not.toBeInTheDocument();
        });

        it('should remove targetEffects entry when break button is clicked', () => {
            const existingEffects = [
                { target: 'Goblin', effect: 'damage_bonus', value: 3, source: 'Test' },
                { target: 'Goblin', effect: 'damage_bonus', value: 5, source: 'Other' },
            ];
            runtimeState.getRuntimeValue.mockReturnValue(existingEffects);
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 3 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={existingEffects} creatureName="Goblin" campaignName="test" isLocalhost={true} />);
            fireEvent.click(screen.getByTitle('Remove effect'));
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        });
    });
});
