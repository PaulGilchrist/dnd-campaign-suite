// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';

// The component imports only these two functions from the runtime store.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => makeEffects({})),
}));

// applyActiveBuffs pushes onto these arrays for advantage-style buffs;
// every other guard field is supplied per-test via overrides.
const defaultEffects = {
    attackAdvantageReasons: [],
    saveAdvantageReasons: [],
};

function makeEffects(overrides = {}) {
    return { ...defaultEffects, ...overrides };
}

describe('ConditionEffectBadges - Effect Removal Handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function renderWithEffects({ targetEffects = [], computeOverrides = {}, buffs = [], stealthAttackCost = 0 } = {}) {
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'targetEffects') return targetEffects;
            if (name === 'Alice' && key === 'activeBuffs') return buffs;
            if (name === 'Alice' && key === 'stealthAttackCost') return stealthAttackCost;
            return null;
        });
        computeConditionEffects.mockReturnValue(makeEffects(computeOverrides));
        render(
            <ConditionEffectBadges
                conditions={[]}
                targetEffects={targetEffects}
                creatureName="Alice"
                campaignName="test-campaign"
                isLocalhost={true}
            />
        );
    }

    function clickRemoveForBadgeWithLabel(label) {
        const badge = screen.getByText(label, { selector: '.creature-badge' });
        const removeBtn = badge.parentElement.querySelector('.creature-badge-remove');
        expect(removeBtn).toBeInTheDocument();
        fireEvent.click(removeBtn);
    }

    describe('removeAction: remove_pfeag (triple-write)', () => {
        it('writes exactly three stores: filtered targetEffects, filtered activeBuffs, cleared warded types', () => {
            renderWithEffects({
                targetEffects: [
                    { target: 'Alice', effect: 'protection_from_evil_and_good', source: 'Cleric' },
                    { target: 'Bob', effect: 'sanctuary', source: 'Cleric' },
                ],
                buffs: [
                    { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
                    // Same-name buff with a different effect must survive the name+effect filter.
                    { name: 'Protection from Evil and Good', effect: 'shield_of_faith' },
                    { name: 'Bless', effect: 'bless_bonus' },
                ],
            });
            clickRemoveForBadgeWithLabel('Protection from Evil and Good');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(3);
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                'campaign',
                'targetEffects',
                [{ target: 'Bob', effect: 'sanctuary', source: 'Cleric' }],
                'test-campaign'
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                'Alice',
                'activeBuffs',
                [
                    { name: 'Protection from Evil and Good', effect: 'shield_of_faith' },
                    { name: 'Bless', effect: 'bless_bonus' },
                ],
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

    describe('removeAction: remove_buff (Warding Bond)', () => {
        it('drops all five hard-coded buff effect types and preserves the rest, payload byte-exact', () => {
            renderWithEffects({
                buffs: [
                    { name: 'Zealous Presence', effect: 'advantage_attacks_and_saves' },
                    { name: 'Vow of Enmity', effect: 'vow_of_enmity' },
                    { name: 'Dodge', effect: 'dodge' },
                    { name: 'Haste', effect: 'haste' },
                    { name: 'Warding Bond', effect: 'warding_bond' },
                    { name: 'Other Buff', effect: 'other' },
                ],
            });
            clickRemoveForBadgeWithLabel('Warding Bond');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Alice',
                'activeBuffs',
                [{ name: 'Other Buff', effect: 'other' }],
                'test-campaign'
            );
        });
    });

    describe('removeAction: remove_derived', () => {
        it('filters the badge effectTypes for this creature only, preserving other targets', () => {
            renderWithEffects({
                targetEffects: [
                    { target: 'Alice', effect: 'blur', source: 'Mage' },
                    { target: 'Alice', effect: 'foresight', source: 'Mage' },
                    { target: 'Bob', effect: 'sanctuary', source: 'Cleric' },
                ],
                computeOverrides: { noAdvantageAgainst: true },
            });
            clickRemoveForBadgeWithLabel('No Adv vs');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ target: 'Bob', effect: 'sanctuary', source: 'Cleric' }],
                'test-campaign'
            );
        });
    });

    describe.each([
        { effect: 'haste', badgeLabel: 'Hasted', computeOverride: { hasteActive: true } },
        { effect: 'barkskin', badgeLabel: 'Barkskin', computeOverride: { barkskinActive: true } },
    ])('removeAction: remove_$effect', ({ effect, badgeLabel, computeOverride }) => {
        it('clears the target effect and the buff while preserving unrelated entries in both stores', () => {
            renderWithEffects({
                targetEffects: [
                    { target: 'Alice', effect, source: 'Cleric' },
                    { target: 'Bob', effect: 'sanctuary', source: 'Cleric' },
                ],
                computeOverrides: computeOverride,
                buffs: [
                    { name: effect.charAt(0).toUpperCase() + effect.slice(1), effect },
                    { name: 'Bless', effect: 'bless_bonus' },
                ],
            });
            clickRemoveForBadgeWithLabel(badgeLabel);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                'campaign',
                'targetEffects',
                [{ target: 'Bob', effect: 'sanctuary', source: 'Cleric' }],
                'test-campaign'
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                'Alice',
                'activeBuffs',
                [{ name: 'Bless', effect: 'bless_bonus' }],
                'test-campaign'
            );
        });
    });

    describe('removeAction: taunting_step', () => {
        it('removes only the taunting_step target effect, preserving other effects on the same creature', () => {
            renderWithEffects({
                targetEffects: [
                    { target: 'Alice', effect: 'taunting_step', source: 'Rogue' },
                    { target: 'Alice', effect: 'haste', source: 'Wizard' },
                ],
            });
            clickRemoveForBadgeWithLabel('Taunted');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ target: 'Alice', effect: 'haste', source: 'Wizard' }],
                'test-campaign'
            );
        });
    });

    describe('removeAction: stealth_attack', () => {
        it('resets stealthAttackCost to 0 with no other store writes', () => {
            renderWithEffects({ stealthAttackCost: 5 });
            clickRemoveForBadgeWithLabel('Stealth Attack');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Alice',
                'stealthAttackCost',
                0,
                'test-campaign'
            );
        });
    });
});
