// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
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
};

function makeEffects(overrides = {}) {
    return { ...defaultEffects, ...overrides };
}

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn((_conditions, _saveModifiers, targetEffects) => {
        return makeEffects(targetEffects && targetEffects.length ? { targetAdvantageCount: 1 } : {});
    }),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

describe('ConditionEffectBadges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('empty state', () => {
        it.each([
            [null],
            [undefined],
            [[]],
        ])('should render nothing when conditions is %s and no effects', (conditions) => {
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges conditions={conditions} targetEffects={[]} creatureName="Alice" campaignName="test" />
            );
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            document.querySelectorAll('.condition-effect-badge').forEach(el => expect(el).not.toBeVisible());
        });

        it('should render nothing when no optional props are provided', () => {
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(<ConditionEffectBadges />);
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

        it('should not render Insp. Move badge when creatureName is missing', () => {
            getRuntimeValue.mockReturnValue(null);
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} campaignName="test" />);
            expect(screen.queryByText('Insp. Move')).not.toBeInTheDocument();
        });

        it('should not render Insp. Move badge when campaignName is missing', () => {
            getRuntimeValue.mockReturnValue(null);
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" />);
            expect(screen.queryByText('Insp. Move')).not.toBeInTheDocument();
        });
    });

    describe('speed effects', () => {
        it('should render Speed -N badge when speedReduction is set', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ speedReduction: 15 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Speed -15');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-speed-zero');
        });

        it('should render Speed -10 badge when speedReduction is 10', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ speedReduction: 10 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Speed -10')).toBeInTheDocument();
        });
    });

    describe('target disadvantage', () => {
        it('should render Disadv vs badge when targetDisadvantageCount > 0', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ targetDisadvantageCount: 2 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Disadv vs');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-target-disadv');
        });
    });

    describe('rider effects', () => {
        it('should render Save Disadv badge when riderSaveDisadvantage is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderSaveDisadvantage: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Save Disadv');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-disadvantage');
        });

        it('should render +N to hit badge when riderAttackBonus > 0', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 5 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('+5 to hit');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-target-adv');
        });

        it('should render +1 to hit badge when riderAttackBonus is 1', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 1 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('+1 to hit')).toBeInTheDocument();
        });

        it('should not render +N to hit badge when riderAttackBonus is 0', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 0 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.queryByText(/to hit/)).not.toBeInTheDocument();
        });

        it('should render No OA badge when riderCannotOpportunityAttack is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderCannotOpportunityAttack: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('No OA');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-cannot-act');
        });
    });

    describe('remarkable athlete No OA', () => {
        it('should render No OA (Crit) badge when remarkableAthleteNoOA is true', () => {
            getRuntimeValue.mockReturnValue(true);
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('No OA (Crit)')).toBeInTheDocument();
            expect(getRuntimeValue).toHaveBeenCalledWith('Alice', 'remarkableAthleteNoOA', 'test');
        });

        it('should not render No OA (Crit) badge when remarkableAthleteNoOA is null', () => {
            getRuntimeValue.mockReturnValue(null);
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.queryByText('No OA (Crit)')).not.toBeInTheDocument();
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
            const badge = screen.getByText('OA Disadv');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-disadvantage');
        });

        it('should not render OA Disadv badge when hasSpeedyOpportunityDisadvantage is false', () => {
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName="Alice"
                    campaignName="test"
                    hasSpeedyOpportunityDisadvantage={false}
                />
            );
            expect(screen.queryByText('OA Disadv')).not.toBeInTheDocument();
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
            const badge = screen.getByText('No Difficult Terrain on Dash');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-cannot-act');
        });

        it('should not render No Difficult Terrain on Dash when hasSpeedyDifficultTerrainIgnore is false', () => {
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName="Alice"
                    campaignName="test"
                    hasSpeedyDifficultTerrainIgnore={false}
                />
            );
            expect(screen.queryByText('No Difficult Terrain on Dash')).not.toBeInTheDocument();
        });
    });

    describe('badge structure', () => {
        it('should render each badge with condition-effect-badge class', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ speedReduction: 10, targetDisadvantageCount: 1 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badges = document.querySelectorAll('.condition-effect-badge');
            expect(badges.length).toBe(2);
            badges.forEach(badge => expect(badge).toHaveClass('condition-effect-badge'));
        });

        it('should set title attribute to badge description', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ speedReduction: 10 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText(/Speed -10/);
            expect(badge.closest('.condition-effect-badge')).toHaveAttribute('title', 'Speed is reduced by the amount shown.');
        });

        it('should render badges as div elements', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ speedReduction: 5 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText(/Speed -5/).closest('div');
            expect(badge.tagName).toBe('DIV');
        });
    });

    describe('multiple badges at once', () => {
        it('should render multiple badges for multiple effects', () => {
            computeConditionEffects.mockReturnValue(makeEffects({
                speedReduction: 15,
                targetDisadvantageCount: 2,
                riderSaveDisadvantage: true,
            }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText(/Speed -15/)).toBeInTheDocument();
            expect(screen.getByText('Disadv vs')).toBeInTheDocument();
            expect(screen.getByText('Save Disadv')).toBeInTheDocument();
        });

        it('should render all badges when effects create multiple badges', () => {
            computeConditionEffects.mockReturnValue(makeEffects({
                speedReduction: 10,
                targetDisadvantageCount: 2,
                riderSaveDisadvantage: true,
                riderAttackBonus: 5,
                riderCannotOpportunityAttack: true,
            }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText(/Speed -10/)).toBeInTheDocument();
            expect(screen.getByText('Disadv vs')).toBeInTheDocument();
            expect(screen.getByText('Save Disadv')).toBeInTheDocument();
            expect(screen.getByText('+5 to hit')).toBeInTheDocument();
            expect(screen.getByText('No OA')).toBeInTheDocument();
        });
    });

    describe('GM effect removal', () => {
        it('should render X button for removable effects when isLocalhost is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 3, riderCannotOpportunityAttack: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[{ target: 'Goblin', effect: 'damage_bonus', value: 3 }]} creatureName="Goblin" campaignName="test" isLocalhost={true} />);
            const badge = screen.getByText('+3 to hit').closest('.condition-effect-badge');
            expect(badge.querySelector('.effect-break-btn')).toBeInTheDocument();
        });

        it('should not render X button when isLocalhost is false', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 3 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[{ target: 'Goblin', effect: 'damage_bonus', value: 3 }]} creatureName="Goblin" campaignName="test" isLocalhost={false} />);
            const badge = screen.getByText('+3 to hit').closest('.condition-effect-badge');
            expect(badge.querySelector('.effect-break-btn')).toBeNull();
        });

        it('should not render X button for non-removable effects', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ targetDisadvantageCount: 1, riderSaveDisadvantage: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Goblin" campaignName="test" isLocalhost={true} />);
            const badges = document.querySelectorAll('.condition-effect-badge');
            badges.forEach(badge => {
                expect(badge.querySelector('.effect-break-btn')).toBeNull();
            });
        });

        it('should remove targetEffects entry when X is clicked', () => {
            const existingEffects = [
                { target: 'Goblin', effect: 'damage_bonus', value: 3, source: 'Test' },
                { target: 'Goblin', effect: 'damage_bonus', value: 5, source: 'Other' },
            ];
            runtimeState.getRuntimeValue.mockReturnValue(existingEffects);
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 3 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={existingEffects} creatureName="Goblin" campaignName="test" isLocalhost={true} />);
            const badge = screen.getByText('+3 to hit').closest('.condition-effect-badge');
            fireEvent.click(badge.querySelector('.effect-break-btn'));
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('test', 'targetEffects', [existingEffects[1]], 'test');
        });
    });
});
