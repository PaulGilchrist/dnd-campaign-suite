import { render, screen, fireEvent } from '@testing-library/react';
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

function renderWithTargetEffect(targetEffect, effectsOverrides = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return [];
        return null;
    });
    computeConditionEffects.mockReturnValue(makeEffects(effectsOverrides));
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={targetEffect ? [targetEffect] : []}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            isLocalhost={true}
        />
    );
}

function renderWithBuffs(buffs, effectsOverrides = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return buffs;
        return null;
    });
    computeConditionEffects.mockReturnValue(makeEffects(effectsOverrides));
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={[]}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            isLocalhost={true}
        />
    );
}

describe('ConditionEffectBadges - Spell Effect Badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Taunted badge', () => {
        it('should render Taunted badge when taunting_step targetEffect is present for this creature', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'taunting_step', source: 'Rogue' });
            expect(screen.getByText('Taunted')).toBeInTheDocument();
        });
    });

    describe('Compelled Duel badge', () => {
        it('should render Compelled Duel badge when compelled_duel targetEffect is present for this creature', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'compelled_duel', source: 'Paladin' });
            expect(screen.getByText('Compelled Duel')).toBeInTheDocument();
        });
    });

    describe('Sanctuary badge', () => {
        it('should render Sanctuary badge when sanctuary targetEffect is present for this creature', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'sanctuary', source: 'Cleric' });
            expect(screen.getByText('Sanctuary')).toBeInTheDocument();
        });
    });

    describe('Bane badge', () => {
        it('should render Bane badge when banePenalty effect is active', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'bane_penalty', source: 'Cleric', displayLabel: 'Bane' }, { banePenalty: true });
            expect(screen.getByText('Bane')).toBeInTheDocument();
        });

        it('should render custom displayLabel for Bane badge', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'bane_penalty', source: 'Cleric', displayLabel: 'My Bane' }, { banePenalty: true });
            expect(screen.getByText('My Bane')).toBeInTheDocument();
        });

        it('should render Bane as buff when caster is self', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'bane_penalty', source: CREATURE_NAME, displayLabel: 'Bane' }, { banePenalty: true });
            const badge = screen.getByText('Bane');
            expect(badge.closest('[class*="effect-buff"]')).toBeInTheDocument();
        });

        it('should render Bane as debuff when caster is not self', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'bane_penalty', source: 'Cleric', displayLabel: 'Bane' }, { banePenalty: true });
            const badge = screen.getByText('Bane');
            expect(badge.closest('[class*="effect-debuff"]')).toBeInTheDocument();
        });
    });

    describe('Ray of Enfeeblement badge', () => {
        it('should render Enfeeblement badge when rayOfEnfeebleDamageReduction is active', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'ray_of_enfeeble_debuff', source: 'Wizard' }, { rayOfEnfeebleDamageReduction: true });
            expect(screen.getByText('Enfeeblement')).toBeInTheDocument();
        });

        it('should trigger CON repeat save with te dc when the badge is clicked', () => {
            const onRollConditionSave = vi.fn();
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === CREATURE_NAME && key === 'activeBuffs') return [];
                return null;
            });
            computeConditionEffects.mockReturnValue(makeEffects({ rayOfEnfeebleDamageReduction: true }));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[{ target: CREATURE_NAME, effect: 'ray_of_enfeeble_debuff', source: 'Wizard', dc: 17 }]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                    isLocalhost={true}
                    onRollConditionSave={onRollConditionSave}
                />
            );
            fireEvent.click(screen.getByText('Enfeeblement'));
            expect(onRollConditionSave).toHaveBeenCalledWith(CREATURE_NAME, { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: 17, ability: 'con' });
        });
    });

    describe('Resistance badge', () => {
        it('should render Resistance badge when resistanceDamageReduction is active', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'resistance_damage_reduction', source: 'Druid', chosenType: 'Fire' }, { resistanceDamageReduction: true });
            expect(screen.getByText('Resistance')).toBeInTheDocument();
        });
    });

    describe('Bless badge', () => {
        it('should render Bless badge when blessBonus is active', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'bless_bonus', source: 'Cleric' }, { blessBonus: true });
            expect(screen.getByText('Bless')).toBeInTheDocument();
        });
    });

    describe('Beacon of Hope badge', () => {
        it('should render Beacon of Hope badge when beaconOfHope is active', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'beacon_of_hope', source: 'Cleric' }, { beaconOfHope: true });
            expect(screen.getByText('Beacon of Hope')).toBeInTheDocument();
        });
    });

    describe('Hasted badge', () => {
        it('should render Hasted badge when haste buff is active', () => {
            renderWithBuffs([{ name: 'Haste', effect: 'haste' }], { hasteActive: true });
            expect(screen.getByText('Hasted')).toBeInTheDocument();
        });
    });

    describe('Barkskin badge', () => {
        it('should render Barkskin badge when barkskin buff is active', () => {
            renderWithBuffs([{ name: 'Barkskin', effect: 'barkskin' }], { barkskinActive: true });
            expect(screen.getByText('Barkskin')).toBeInTheDocument();
        });
    });

    describe('Silenced badge', () => {
        it('should render Silenced badge when silenced targetEffect is present for this creature', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'silenced', source: 'Wizard' });
            expect(screen.getByText('Silenced')).toBeInTheDocument();
        });
    });
});
