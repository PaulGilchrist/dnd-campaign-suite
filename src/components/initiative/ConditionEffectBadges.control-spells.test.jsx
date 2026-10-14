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

function renderWithTargetEffect(targetEffect, overrides = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return [];
        return null;
    });
    computeConditionEffects.mockReturnValue(makeEffects(overrides));
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={targetEffect ? [targetEffect] : []}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            isLocalhost={true}
            {...overrides}
        />
    );
}

describe('ConditionEffectBadges - Control Spell Badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Control spell badges render and exclude for wrong target', () => {
        const controlSpellBadges = [
            { effect: 'tashas_hideous_laughter', label: "Tasha's Hideous Laughter" },
            { effect: 'banishment', label: 'Banished' },
            { effect: 'maze', label: 'Mazed' },
            { effect: 'imprisonment', label: 'Imprisoned' },
            { effect: 'confusion', label: 'Confused' },
        ];

        it.each(controlSpellBadges)(
            'should render %s badge when %s targetEffect is present for this creature',
            ({ effect, label }) => {
                renderWithTargetEffect({ target: CREATURE_NAME, effect, source: 'Wizard' });
                expect(screen.getByText(label)).toBeInTheDocument();
            }
        );

        it.each(controlSpellBadges)(
            'should not render %s badge when %s targetEffect is for a different creature',
            ({ effect, label }) => {
                renderWithTargetEffect({ target: 'Bob', effect, source: 'Wizard' });
                expect(screen.queryByText(label)).not.toBeInTheDocument();
            }
        );
    });

    describe('Control spell save callbacks', () => {
        const controlSpellSaves = [
            {
                name: "Tasha's Hideous Laughter",
                effect: 'tashas_hideous_laughter',
                clickText: "Tasha's Hideous Laughter",
                expectedSave: { key: 'prone', label: 'Prone', dc: 15, ability: 'wis' },
            },
            {
                name: 'Maze',
                effect: 'maze',
                clickText: 'Mazed',
                expectedSave: { key: 'incapacitated', label: 'Incapacitated', dc: 20, ability: 'int' },
            },
            {
                name: 'Confusion',
                effect: 'confusion',
                clickText: 'Confused',
                expectedSave: { key: 'confused', label: 'Confused', dc: 15, ability: 'wis' },
            },
        ];

        it.each(controlSpellSaves)(
            'should roll the %s escape check when the badge is clicked with onRollConditionSave callback',
            ({ effect, clickText, expectedSave }) => {
                const onRollConditionSave = vi.fn();
                renderWithTargetEffect(
                    { target: CREATURE_NAME, effect, source: 'Wizard', dc: expectedSave.dc },
                    { onRollConditionSave }
                );
                fireEvent.click(screen.getByText(clickText));
                expect(onRollConditionSave).toHaveBeenCalledWith(CREATURE_NAME, expectedSave);
            }
        );
    });

    describe('Control spell tooltip caster + DC', () => {
        it("should include caster name and DC in Tasha's Hideous Laughter tooltip", () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'tashas_hideous_laughter', source: 'Wizard', dc: 12 });
            expect(screen.getByTitle(/Tasha's Hideous Laughter from Wizard/)).toBeInTheDocument();
            expect(screen.getByTitle(/DC 12/)).toBeInTheDocument();
        });

        it('should include caster name and DC in Maze tooltip', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'maze', source: 'Wizard', dc: 18 });
            expect(screen.getByTitle(/Mazed by Wizard/)).toBeInTheDocument();
            expect(screen.getByTitle(/DC 18/)).toBeInTheDocument();
        });

        it('should include caster name and DC in Confusion tooltip', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'confusion', source: 'Bard', dc: 16 });
            expect(screen.getByTitle(/Confused by Bard/)).toBeInTheDocument();
            expect(screen.getByTitle(/DC 16/)).toBeInTheDocument();
        });
    });

    describe('Banishment badge', () => {
        it('should indicate permanent banishment in tooltip', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'banishment', source: 'Cleric', permanent: true });
            expect(screen.getByTitle(/Permanent banishment/)).toBeInTheDocument();
        });

        it('should indicate concentration-based banishment when not permanent', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'banishment', source: 'Cleric', permanent: false });
            expect(screen.getByTitle(/Concentration/)).toBeInTheDocument();
            expect(screen.queryByTitle(/Permanent banishment/)).not.toBeInTheDocument();
        });

        it('should render with tooltip containing caster name', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'banishment', source: 'Paladin' });
            expect(screen.getByTitle(/Banished by Paladin/)).toBeInTheDocument();
        });
    });

    describe('Imprisonment badge', () => {
        it('should include prisonType in tooltip', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'imprisonment', source: 'Wizard', prisonType: 'Slumber' });
            expect(screen.getByTitle(/Slumber/)).toBeInTheDocument();
        });

        it('should include duration in tooltip when present', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'imprisonment', source: 'Wizard', prisonType: 'Buried', duration: 'Until dispelled' });
            expect(screen.getByTitle(/Until dispelled/)).toBeInTheDocument();
        });
    });
});
