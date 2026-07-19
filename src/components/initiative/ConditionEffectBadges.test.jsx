// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
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
    attackDisadvantageReasons: [],
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
    attackAdvantageCount: 0,
    attackAdvantageReasons: [],
    saveAdvantageCount: 0,
    saveAdvantageReasons: [],
    saveAdvantageAbilities: null,
    saveDisadvantageCount: 0,
    dexSaveAdvantageCount: 0,
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
            expect(screen.queryByTestId('condition-effect-badge')).not.toBeInTheDocument();
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
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText(expectedLabel)).toBeInTheDocument();
        });

        it.each([
            ['+3 to hit', { riderAttackBonus: 3 }],
            ['+7 to hit', { riderAttackBonus: 7 }],
        ])('should render rider attack bonus badge with value %s when riderAttackBonus is set', (_, effects) => {
            computeConditionEffects.mockReturnValue(makeEffects(effects));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText(effects.riderAttackBonus > 0 ? `+${effects.riderAttackBonus} to hit` : '')).toBeInTheDocument();
        });

        it('should prefer No Adv vs over Disadv vs when both are set', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ noAdvantageAgainst: true, targetDisadvantageCount: 3 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('No Adv vs')).toBeInTheDocument();
            expect(screen.queryByText('Disadv vs')).not.toBeInTheDocument();
        });
    });

    describe('badges from props', () => {
        it.each([
            ['Insp. Move', { getRuntimeValue: true, hasTacticalShift: false }],
            ['Insp. Move', { getRuntimeValue: null, hasTacticalShift: true }],
        ])('should render %s badge when inspiringMovementNoOA is %s or hasTacticalShift is true', (_, { getRuntimeValue: rv, hasTacticalShift: ts }) => {
            getRuntimeValue.mockReturnValue(rv);
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" hasTacticalShift={ts} />);
            expect(screen.getByText('Insp. Move')).toBeInTheDocument();
        });

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

        it.each([
            [true, true],
            [null, false],
        ])('should render No OA (Crit) when remarkableAthleteNoOA runtime value is %s', (value, shouldRender) => {
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

    describe('badges from buffs', () => {
        it('renders Disadv vs and Adv DEX Save badges when Dodge buff is active', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'Alice' && key === 'activeBuffs') return [{ name: 'Dodge', effect: 'dodge' }];
                return null;
            });
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Disadv vs')).toBeInTheDocument();
            expect(screen.getByText('Adv DEX Save')).toBeInTheDocument();
        });

        it('renders Adv badge when vow_of_enmity buff is active', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'Alice' && key === 'activeBuffs') return [{ name: 'Vow of Enmity', effect: 'vow_of_enmity' }];
                return null;
            });
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[]} creatureName="Alice" campaignName="test" />);
            expect(screen.getByText('Adv')).toBeInTheDocument();
        });
    });

    describe('GM effect removal', () => {
        it('should render removable badges with break buttons when isLocalhost is true', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 3, riderCannotOpportunityAttack: true }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[{ target: 'Goblin', effect: 'damage_bonus', value: 3 }]} creatureName="Goblin" campaignName="test" isLocalhost={true} />);
            expect(screen.getByText('+3 to hit')).toBeInTheDocument();
            expect(screen.getByText('No OA')).toBeInTheDocument();
            expect(screen.getAllByTitle('Remove effect').length).toBe(2);
        });

        it('should not render break buttons when isLocalhost is false', () => {
            computeConditionEffects.mockReturnValue(makeEffects({ riderAttackBonus: 3 }));
            render(<ConditionEffectBadges conditions={[]} targetEffects={[{ target: 'Goblin', effect: 'damage_bonus', value: 3 }]} creatureName="Goblin" campaignName="test" isLocalhost={false} />);
            expect(screen.getByText('+3 to hit')).toBeInTheDocument();
            expect(screen.queryByTitle('Remove effect')).not.toBeInTheDocument();
        });

        it('should remove the first matching targetEffect entry when break button is clicked', () => {
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
