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

const AURA_BADGES = [
    { effect: 'globe_barrier', label: 'Globe of Invulnerability', source: 'Wizard' },
    { effect: 'antimagic_field', label: 'Antimagic Field', source: 'Wizard' },
    { effect: 'regenerate', label: 'Regenerate', source: 'Cleric' },
    { effect: 'aura_of_life', label: 'Aura of Life', source: 'Cleric' },
    { effect: 'aura_of_purity', label: 'Aura of Purity', source: 'Paladin' },
    { effect: 'circle_of_power', label: 'Circle of Power', source: 'Cleric' },
    { effect: 'heroism', label: 'Heroism', source: 'Paladin' },
    { effect: 'holy_aura', label: 'Holy Aura', source: 'Cleric' },
    { effect: 'protection_from_evil_and_good', label: 'Protection from Evil and Good', source: 'Cleric' },
    { effect: 'protection_from_poison', label: 'Protection from Poison', source: 'Cleric' },
];

function renderWithTargetEffect(effectName, source) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return [];
        return null;
    });
    computeConditionEffects.mockReturnValue(makeEffects({}));
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={[{ target: CREATURE_NAME, effect: effectName, source }]}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            isLocalhost={true}
        />
    );
}

function renderWithTargetEffectWrongTarget(effectName, source) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return [];
        return null;
    });
    computeConditionEffects.mockReturnValue(makeEffects({}));
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={[{ target: 'Bob', effect: effectName, source }]}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            isLocalhost={true}
        />
    );
}

function renderWithBuffs(buffs) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return buffs;
        return null;
    });
    computeConditionEffects.mockReturnValue(makeEffects({}));
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

describe('ConditionEffectBadges - Aura & Protection Badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Aura badges render when their targetEffect is present', () => {
        it.each(AURA_BADGES)(
            'should render %s badge when %s targetEffect is present for this creature',
            ({ effect, label }) => {
                renderWithTargetEffect(effect, 'Cleric');
                expect(screen.getByText(label)).toBeInTheDocument();
            }
        );
    });

    describe('Aura badges excluded for wrong target', () => {
        it.each(AURA_BADGES)(
            'should not render %s badge when %s targetEffect is for a different creature',
            ({ effect, label }) => {
                renderWithTargetEffectWrongTarget(effect, 'Cleric');
                expect(screen.queryByText(label)).not.toBeInTheDocument();
            }
        );
    });

    describe('Warding Bond badge (from activeBuffs)', () => {
        it('should render when warding_bond buff is active', () => {
            renderWithBuffs([{ name: 'Warding Bond', effect: 'warding_bond', sourceCharacter: 'Cleric' }]);
            expect(screen.getByText('Warding Bond')).toBeInTheDocument();
        });

        it('should not render when warding_bond buff is not active', () => {
            renderWithBuffs([]);
            expect(screen.queryByText('Warding Bond')).not.toBeInTheDocument();
        });

        it('should be removable when isLocalhost is true', () => {
            renderWithBuffs([{ name: 'Warding Bond', effect: 'warding_bond', sourceCharacter: 'Cleric' }]);
            expect(screen.getAllByTitle('Remove effect').length).toBeGreaterThan(0);
        });

        it('should not be removable when isLocalhost is false', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === CREATURE_NAME && key === 'activeBuffs') return [{ name: 'Warding Bond', effect: 'warding_bond', sourceCharacter: 'Cleric' }];
                return null;
            });
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                    isLocalhost={false}
                />
            );
            expect(screen.getByText('Warding Bond')).toBeInTheDocument();
            expect(screen.queryByTitle('Remove effect')).not.toBeInTheDocument();
        });
    });
});
