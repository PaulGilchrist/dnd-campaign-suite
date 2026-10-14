import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
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
    hasteActive: false,
    barkskinActive: false,
    banePenalty: false,
    blessBonus: false,
    beaconOfHope: false,
    abilityCheckDisadvantageAbilities: null,
    abilityCheckAdvantageAbilities: null,
    abilityCheckAdvantage: false,
    abilityCheckAdvantageReasons: [],
    saveDisadvantage: [],
};

function makeEffects(overrides = {}) {
    return { ...defaultEffects, ...overrides };
}

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => makeEffects({})),
}));

describe('ConditionEffectBadges - target_effect removal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function renderWithEffects(conditions, targetEffects, creatureName = 'Alice', campaignName = 'test-campaign', computeOverrides = {}, props = {}) {
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'targetEffects') return targetEffects;
            if (name === creatureName && key === 'activeBuffs') return props.buffs || [];
            return null;
        });
        computeConditionEffects.mockReturnValue(makeEffects(computeOverrides));
        render(
            <ConditionEffectBadges
                conditions={conditions}
                targetEffects={targetEffects}
                creatureName={creatureName}
                campaignName={campaignName}
                isLocalhost={true}
                {...props}
            />
        );
    }

    function clickFirstRemove() {
        const removeBtns = screen.getAllByTitle('Remove effect');
        expect(removeBtns.length).toBeGreaterThan(0);
        fireEvent.click(removeBtns[0]);
    }

    describe('removeAction: target_effect - single effect removal', () => {
        const removableTargetEffects = [
            'sanctuary',
            'regenerate',
            'aura_of_life',
            'aura_of_purity',
            'circle_of_power',
            'heroism',
            'holy_aura',
            'protection_from_poison',
            'banishment',
            'maze',
            'imprisonment',
            'confusion',
            'forcecage',
            'slasher_enhanced_critical',
        ];

        it.each(removableTargetEffects)(
            'should remove %s target effect when badge has target_effect removeAction',
            (effectType) => {
                const existingEffects = [
                    { target: 'Alice', effect: effectType, source: 'Cleric' },
                    { target: 'Bob', effect: 'sanctuary', source: 'Wizard' },
                ];
                const computeOverrides = effectType === 'slasher_enhanced_critical' ? { targetAttackDisadvantageCount: 1 } : {};
                renderWithEffects(effectType === 'slasher_enhanced_critical' ? [{ key: 'blinded' }] : [], existingEffects, 'Alice', 'test-campaign', computeOverrides);
                clickFirstRemove();
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'campaign',
                    'targetEffects',
                    [existingEffects[1]],
                    'test-campaign'
                );
            }
        );
    });
});
