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

describe('ConditionEffectBadges - Effect Removal Handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function renderWithEffects(conditions, targetEffects, creatureName = 'Alice', campaignName = 'test-campaign', overrides = {}, props = {}) {
        runtimeState.getRuntimeValue.mockImplementation((name, key, _campaign) => {
            if (name === 'campaign' && key === 'targetEffects') return targetEffects;
            if (name === creatureName && key === 'activeBuffs') return props.buffs || [];
            if (name === creatureName && key === 'inspiringMovementNoOA') return props.inspiringMovementNoOA;
            if (name === creatureName && key === 'remarkableAthleteNoOA') return props.remarkableAthleteNoOA;
            if (name === creatureName && key === 'stealthAttackCost') return props.stealthAttackCost ?? 0;
            if (name === creatureName && key === 'vowOfEnmityTarget') return props.vowOfEnmityTarget;
            return null;
        });
        computeConditionEffects.mockReturnValue(makeEffects(overrides));
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

    describe('removeAction: remove_pfeag', () => {
        it('should remove pfeag target effect, filter pfeag buffs, and clear protectionFromEvilAndGoodWardedTypes', () => {
            const existingEffects = [
                { target: 'Alice', effect: 'protection_from_evil_and_good', source: 'Cleric' },
            ];
            const existingBuffs = [
                { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
            ];
            renderWithEffects(
                [{ key: 'charmed' }],
                existingEffects,
                'Alice',
                'test-campaign',
                {},
                { buffs: existingBuffs }
            );
            clickFirstRemove();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(3);
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                'campaign',
                'targetEffects',
                [],
                'test-campaign'
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                'Alice',
                'activeBuffs',
                [],
                'test-campaign'
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                3,
                'Alice',
                'protectionFromEvilAndGoodWardedTypes',
                [],
                'test-campaign'
            );
        });
    });

    describe('removeAction: remove_buff', () => {
        it('should filter out specific buff effects when Warding Bond badge is removed', () => {
            const existingBuffs = [
                { name: 'Zealous Presence', effect: 'advantage_attacks_and_saves' },
                { name: 'Vow of Enmity', effect: 'vow_of_enmity' },
                { name: 'Dodge', effect: 'dodge' },
                { name: 'Haste', effect: 'haste' },
                { name: 'Warding Bond', effect: 'warding_bond' },
                { name: 'Other Buff', effect: 'other' },
            ];
            renderWithEffects(
                [],
                [],
                'Alice',
                'test-campaign',
                {},
                { buffs: existingBuffs }
            );
            const badges = screen.getAllByTestId('creature-badge');
            const wardingBadge = badges.find(b => b.textContent?.includes('Warding Bond'));
            expect(wardingBadge).toBeDefined();
            const parentDiv = wardingBadge?.parentElement;
            const removeBtn = parentDiv?.querySelector('.creature-badge-remove');
            expect(removeBtn).toBeDefined();
            fireEvent.click(removeBtn);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Alice',
                'activeBuffs',
                expect.arrayContaining([expect.objectContaining({ effect: 'other' })]),
                'test-campaign'
            );
            const filteredBuffs = runtimeState.setRuntimeValue.mock.calls[0][2];
            expect(filteredBuffs).toHaveLength(1);
            expect(filteredBuffs[0].effect).toBe('other');
        });
    });

    describe('removeAction: remove_derived', () => {
        it('should remove target effects by types when badge has remove_derived removeAction', () => {
            const existingEffects = [
                { target: 'Alice', effect: 'blur', source: 'Mage' },
                { target: 'Alice', effect: 'foresight', source: 'Mage' },
                { target: 'Bob', effect: 'sanctuary', source: 'Cleric' },
            ];
            renderWithEffects(
                [{ key: 'invisible' }],
                existingEffects,
                'Alice',
                'test-campaign',
                { noAdvantageAgainst: true }
            );
            clickFirstRemove();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([existingEffects[2]]),
                'test-campaign'
            );
            const filtered = runtimeState.setRuntimeValue.mock.calls[0][2];
            expect(filtered).toHaveLength(1);
            expect(filtered[0].effect).toBe('sanctuary');
        });
    });

    describe('removeAction: remove_haste', () => {
        it('should remove haste target effects and buffs when badge has remove_haste removeAction', () => {
            const existingEffects = [
                { target: 'Alice', effect: 'haste', source: 'Wizard' },
            ];
            const existingBuffs = [
                { name: 'Haste', effect: 'haste' },
            ];
            renderWithEffects(
                [],
                existingEffects,
                'Alice',
                'test-campaign',
                { hasteActive: true },
                { buffs: existingBuffs }
            );
            clickFirstRemove();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                'campaign',
                'targetEffects',
                [],
                'test-campaign'
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                'Alice',
                'activeBuffs',
                [],
                'test-campaign'
            );
        });
    });

    describe('removeAction: remove_barkskin', () => {
        it('should remove barkskin target effects and buffs when badge has remove_barkskin removeAction', () => {
            const existingEffects = [
                { target: 'Alice', effect: 'barkskin', source: 'Druid' },
            ];
            const existingBuffs = [
                { name: 'Barkskin', effect: 'barkskin' },
            ];
            renderWithEffects(
                [],
                existingEffects,
                'Alice',
                'test-campaign',
                { barkskinActive: true },
                { buffs: existingBuffs }
            );
            clickFirstRemove();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                'campaign',
                'targetEffects',
                [],
                'test-campaign'
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                'Alice',
                'activeBuffs',
                [],
                'test-campaign'
            );
        });
    });

    describe('removeAction: taunting_step', () => {
        it('should remove taunting_step target effect when badge has taunting_step removeAction', () => {
            const existingEffects = [
                { target: 'Alice', effect: 'taunting_step', source: 'Rogue' },
            ];
            renderWithEffects([], existingEffects, 'Alice', 'test-campaign', {});
            clickFirstRemove();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [],
                'test-campaign'
            );
        });

        it('should preserve other target effects on the same creature', () => {
            const existingEffects = [
                { target: 'Alice', effect: 'taunting_step', source: 'Rogue' },
                { target: 'Alice', effect: 'haste', source: 'Wizard' },
            ];
            renderWithEffects([], existingEffects, 'Alice', 'test-campaign', {});
            clickFirstRemove();
            const filtered = runtimeState.setRuntimeValue.mock.calls[0][2];
            expect(filtered).toHaveLength(1);
            expect(filtered[0].effect).toBe('haste');
        });
    });

    describe('removeAction: stealth_attack', () => {
        it('should set stealthAttackCost to 0 when badge has stealth_attack removeAction', () => {
            renderWithEffects(
                [],
                [],
                'Alice',
                'test-campaign',
                {},
                { stealthAttackCost: 5 }
            );
            clickFirstRemove();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Alice',
                'stealthAttackCost',
                0,
                'test-campaign'
            );
        });
    });
});
