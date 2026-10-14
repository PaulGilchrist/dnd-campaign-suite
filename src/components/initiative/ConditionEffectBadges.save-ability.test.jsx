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

function renderWithEffects(effectsOverrides = {}, props = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return props.buffs || [];
        return null;
    });
    computeConditionEffects.mockReturnValue(makeEffects(effectsOverrides));
    return render(
        <ConditionEffectBadges
            conditions={props.conditions || []}
            targetEffects={props.targetEffects || []}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            allCreatures={props.allCreatures}
            isLocalhost={props.isLocalhost ?? true}
        />
    );
}

describe('ConditionEffectBadges - Save & Ability Check Badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Adv badge', () => {
        it('should render Adv badge with tooltip when attackAdvantageCount > 0', () => {
            renderWithEffects(
                { attackAdvantageCount: 1, attackAdvantageReasons: ['Invisible'] },
                { conditions: [{ key: 'invisible' }] }
            );
            expect(screen.getByText('Adv')).toBeInTheDocument();
            expect(screen.getByTitle(/Advantage on attack rolls.*Invisible/)).toBeInTheDocument();
        });
    });

    describe('Adv badge from Vow of Enmity', () => {
        it('should render Adv badge when allCreatures has Vow of Enmity targeting this creature', () => {
            getRuntimeValue.mockImplementation((name, key, campaign) => {
                if (name === CREATURE_NAME && key === 'activeBuffs') return [];
                if (key === 'vowOfEnmityTarget' && campaign) {
                    return CREATURE_NAME;
                }
                return null;
            });
            computeConditionEffects.mockReturnValue(makeEffects({}));
            render(
                <ConditionEffectBadges
                    conditions={[]}
                    targetEffects={[]}
                    creatureName={CREATURE_NAME}
                    campaignName={CAMPAIGN_NAME}
                    allCreatures={[{ name: 'Paladin' }]}
                    isLocalhost={true}
                />
            );
            expect(screen.getByText('Adv')).toBeInTheDocument();
        });
    });

    describe('Adv vs badge', () => {
        it('should render Adv vs badge with tooltip when targetAdvantageCount > 0', () => {
            renderWithEffects(
                { targetAdvantageCount: 1, targetAdvantageReasons: ['Reckless Attack'] },
                { conditions: [{ key: 'blinded' }] }
            );
            expect(screen.getByText('Adv vs')).toBeInTheDocument();
            expect(screen.getByTitle(/Attackers have advantage.*Reckless Attack/)).toBeInTheDocument();
        });
    });

    describe('Adv Save badge', () => {
        it('should render Adv Save badge with tooltip when saveAdvantageCount > 0', () => {
            renderWithEffects(
                { saveAdvantageCount: 1, saveAdvantageReasons: ['Foresight'] },
                { conditions: [{ key: 'blinded' }] }
            );
            expect(screen.getByText('Adv Save')).toBeInTheDocument();
            expect(screen.getByTitle(/Advantage on saving throws.*Foresight/)).toBeInTheDocument();
        });
    });

    describe('Adv DEX Save badge', () => {
        it('should render Adv DEX Save badge with tooltip when dexSaveAdvantageCount > 0', () => {
            renderWithEffects(
                { dexSaveAdvantageCount: 1 },
                { buffs: [{ name: 'Dodge', effect: 'dodge' }] }
            );
            expect(screen.getByText('Adv DEX Save')).toBeInTheDocument();
            expect(screen.getByTitle(/Advantage on Dexterity saving throws/)).toBeInTheDocument();
        });
    });

    describe('Save Disadv badge', () => {
        it('should render Save Disadv badge with specific save type when saveDisadvantage contains a type', () => {
            renderWithEffects({ saveDisadvantageCount: 1, saveDisadvantage: ['dex'] });
            expect(screen.getByText(/Save Disadv \(dex\)/)).toBeInTheDocument();
        });

        it('should render Save Disadv badge with multiple save types', () => {
            renderWithEffects({ saveDisadvantageCount: 2, saveDisadvantage: ['dex', 'con'] });
            expect(screen.getByText(/Save Disadv \(dex, con\)/)).toBeInTheDocument();
        });
    });

    describe('Check Disadv badge', () => {
        it('should render Check Disadv badge with ability names when abilityCheckDisadvantageAbilities is set', () => {
            renderWithEffects({ abilityCheckDisadvantageAbilities: ['STR', 'DEX'] });
            expect(screen.getByText(/Check Disadv \(str, dex\)/)).toBeInTheDocument();
        });

        it('should render Check Disadv badge with a single ability', () => {
            renderWithEffects({ abilityCheckDisadvantageAbilities: ['STR'] });
            expect(screen.getByText(/Check Disadv \(str\)/)).toBeInTheDocument();
        });
    });

    describe('Adv Check badge', () => {
        it('should render Adv Check badge with ability names when abilityCheckAdvantageAbilities is set', () => {
            renderWithEffects({ abilityCheckAdvantageAbilities: ['STR'] });
            expect(screen.getByText(/Adv Check \(str\)/)).toBeInTheDocument();
        });

        it('should render Adv Check badge when abilityCheckAdvantage is true without specific abilities', () => {
            renderWithEffects({ abilityCheckAdvantage: true, abilityCheckAdvantageReasons: ['Foresight'] });
            expect(screen.getByText('Adv Check')).toBeInTheDocument();
            expect(screen.getByTitle(/Advantage on all ability checks.*Foresight/)).toBeInTheDocument();
        });
    });
});
