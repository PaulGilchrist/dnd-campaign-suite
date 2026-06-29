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
        it('should render Can\'t Act badge when cannotAct is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ cannotAct: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText("Can't Act");
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-cannot-act');
        });

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
        it('should render Speed 0 badge when speedZero is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ speedZero: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Speed 0');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-speed-zero');
        });

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

    describe('push effect', () => {
        it('should render Push 10 ft badge when pushEffect is true with default distance', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ pushEffect: true, pushDistance: 10 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Push 10 ft');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-push');
        });

        it('should render Push with custom distance when pushDistance is set', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ pushEffect: true, pushDistance: 15 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Push 15 ft')).toBeInTheDocument();
        });

        it('should render Push 10 ft when pushDistance is falsy', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ pushEffect: true, pushDistance: null }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Push 10 ft')).toBeInTheDocument();
        });
    });

    describe('prone effect', () => {
        it('should render Prone badge when proneEffect is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ proneEffect: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Prone');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-prone');
        });
    });

    describe('auto crit effect', () => {
        it('should render Auto-Crit badge when autoCritWithin5ft is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ autoCritWithin5ft: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Auto-Crit');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-auto-crit');
        });
    });

    describe('concentration broken', () => {
        it('should render No Conc. badge when concentrationBroken is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ concentrationBroken: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('No Conc.');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-no-conc');
        });
    });

    describe('auto fail saves', () => {
        it('should render Auto-Fail badge with uppercase save types', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ autoFailSaves: ['str', 'dex'] }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Auto-Fail STR/DEX');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-auto-fail');
        });

        it('should render Auto-Fail badge with single save type', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ autoFailSaves: ['con'] }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Auto-Fail CON')).toBeInTheDocument();
        });

        it('should not render Auto-Fail badge when autoFailSaves is empty', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ autoFailSaves: [] }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.queryByText(/Auto-Fail/)).not.toBeInTheDocument();
        });
    });

    describe('resistance effects', () => {
        it('should render Resist All badge when resistantToAll is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ resistantToAll: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Resist All');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-resist');
        });
    });

    describe('disadvantage effects', () => {
        it('should render Disadv badge when attackDisadvantageCount > 0', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ attackDisadvantageCount: 2 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Disadv');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-disadvantage');
        });

        it('should render Disadv badge when abilityCheckDisadvantage is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ abilityCheckDisadvantage: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Disadv')).toBeInTheDocument();
        });

        it('should render STR Disadv badge when strCheckDisadvantage is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ strCheckDisadvantage: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('STR Disadv');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-disadvantage');
        });

        it('should render both Disadv and STR Disadv badges when both are true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ attackDisadvantageCount: 1, strCheckDisadvantage: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Disadv')).toBeInTheDocument();
            expect(screen.getByText('STR Disadv')).toBeInTheDocument();
        });
    });

    describe('ray of enfeeblement', () => {
        it('should render -1d8 dmg badge when rayOfEnfeebleDamageReduction is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ rayOfEnfeebleDamageReduction: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('-1d8 dmg');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-damage-reduction');
        });
    });

    describe('target advantage/disadvantage', () => {
        it('should render Adv vs badge when targetAdvantageCount > 0', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ targetAdvantageCount: 3 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Adv vs');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-target-adv');
        });

        it('should render Disadv vs badge when targetDisadvantageCount > 0', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ targetDisadvantageCount: 2 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText('Disadv vs');
            expect(badge).toBeInTheDocument();
            expect(badge.closest('.condition-effect-badge')).toHaveClass('effect-target-disadv');
        });

        it('should render both Adv vs and Disadv vs badges when both are set', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ targetAdvantageCount: 1, targetDisadvantageCount: 1 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Adv vs')).toBeInTheDocument();
            expect(screen.getByText('Disadv vs')).toBeInTheDocument();
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
            computeConditionEffects.mockReturnValue(makeEffects({ cannotAct: true, speedZero: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badges = document.querySelectorAll('.condition-effect-badge');
            expect(badges.length).toBe(2);
            badges.forEach(badge => expect(badge).toHaveClass('condition-effect-badge'));
        });

        it('should set title attribute equal to badge label', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ cannotAct: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText("Can't Act");
            expect(badge.closest('.condition-effect-badge')).toHaveAttribute('title', "Can't Act");
        });

        it('should render badges as div elements', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ cannotAct: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            const badge = screen.getByText("Can't Act").closest('div');
            expect(badge.tagName).toBe('DIV');
        });
    });

    describe('multiple badges at once', () => {
        it('should render multiple badges for multiple effects', () => {
            computeConditionEffects.mockReturnValue(makeEffects({
                cannotAct: true,
                speedZero: true,
                proneEffect: true,
                concentrationBroken: true,
            }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText("Can't Act")).toBeInTheDocument();
            expect(screen.getByText('Speed 0')).toBeInTheDocument();
            expect(screen.getByText('Prone')).toBeInTheDocument();
            expect(screen.getByText('No Conc.')).toBeInTheDocument();
        });

        it('should render all badges when conditions create multiple effects', () => {
            computeConditionEffects.mockReturnValue(makeEffects({
                cannotAct: true,
                speedZero: true,
                autoFailSaves: ['str', 'dex'],
                autoCritWithin5ft: true,
                targetAdvantageCount: 2,
                attackDisadvantageCount: 3,
                concentrationBroken: true,
            }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText("Can't Act")).toBeInTheDocument();
            expect(screen.getByText('Speed 0')).toBeInTheDocument();
            expect(screen.getByText('Auto-Fail STR/DEX')).toBeInTheDocument();
            expect(screen.getByText('Auto-Crit')).toBeInTheDocument();
            expect(screen.getByText('Adv vs')).toBeInTheDocument();
            expect(screen.getByText('Disadv')).toBeInTheDocument();
            expect(screen.getByText('No Conc.')).toBeInTheDocument();
        });
    });

    describe('GM effect removal', () => {
        it('should render X button for removable effects when isLocalhost is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ pushEffect: true, pushDistance: 10, proneEffect: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[{ target: 'Goblin', effect: 'push', value: 10 }]} creatureName="Goblin" campaignName="test" isLocalhost={true} />);
            const pushBadge = screen.getByText('Push 10 ft').closest('.condition-effect-badge');
            expect(pushBadge.querySelector('.effect-break-btn')).toBeInTheDocument();
        });

        it('should not render X button when isLocalhost is false', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ pushEffect: true, pushDistance: 10 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[{ target: 'Goblin', effect: 'push', value: 10 }]} creatureName="Goblin" campaignName="test" isLocalhost={false} />);
            const pushBadge = screen.getByText('Push 10 ft').closest('.condition-effect-badge');
            expect(pushBadge.querySelector('.effect-break-btn')).toBeNull();
        });

        it('should not render X button for non-removable effects', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ cannotAct: true, speedZero: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Goblin" campaignName="test" isLocalhost={true} />);
            const badges = document.querySelectorAll('.condition-effect-badge');
            badges.forEach(badge => {
                expect(badge.querySelector('.effect-break-btn')).toBeNull();
            });
        });

        it('should remove targetEffects entry when X is clicked', () => {
            const existingEffects = [
                { target: 'Goblin', effect: 'push', value: 10, source: 'Test' },
                { target: 'Goblin', effect: 'push', value: 15, source: 'Other' },
            ];
            runtimeState.getRuntimeValue.mockReturnValue(existingEffects);
            computeConditionEffects.mockReturnValue(makeEffects({ pushEffect: true, pushDistance: 10 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={existingEffects} creatureName="Goblin" campaignName="test" isLocalhost={true} />);
            const pushBadge = screen.getByText('Push 10 ft').closest('.condition-effect-badge');
            fireEvent.click(pushBadge.querySelector('.effect-break-btn'));
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('test', 'targetEffects', [existingEffects[1]], 'test');
        });
    });
});
