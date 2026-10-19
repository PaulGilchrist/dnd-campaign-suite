// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
}));

// Neutral computeConditionEffects result: every accumulator guard stays falsy so
// only the find-based control-spell specs can produce badges in these tests.
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        attackAdvantageReasons: [],
        targetAdvantageReasons: [],
        saveAdvantageReasons: [],
        saveDisadvantage: [],
    })),
}));

const CREATURE_NAME = 'Alice';
const CAMPAIGN_NAME = 'test-campaign';

// targetEffect may be a single te or an array (for coexistence renders);
// extra props pass straight through to the component.
function renderWithTargetEffect(targetEffect, props = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return [];
        return null;
    });
    const targetEffects = Array.isArray(targetEffect) ? targetEffect : targetEffect ? [targetEffect] : [];
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={targetEffects}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            isLocalhost={true}
            {...props}
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

        it('should fall back to the authored escape DC 20 when the maze te carries no dc', () => {
            const onRollConditionSave = vi.fn();
            renderWithTargetEffect(
                { target: CREATURE_NAME, effect: 'maze', source: 'Wizard' },
                { onRollConditionSave }
            );
            fireEvent.click(screen.getByText('Mazed'));
            expect(onRollConditionSave).toHaveBeenCalledTimes(1);
            expect(onRollConditionSave).toHaveBeenCalledWith(CREATURE_NAME, { key: 'incapacitated', label: 'Incapacitated', dc: 20, ability: 'int' });
        });
    });

    describe('Control spell tooltips', () => {
        it('should render all three clickable control badges together with caster name and DC in each tooltip', () => {
            renderWithTargetEffect([
                { target: CREATURE_NAME, effect: 'tashas_hideous_laughter', source: 'Wizard', dc: 12 },
                { target: CREATURE_NAME, effect: 'maze', source: 'Wizard', dc: 18 },
                { target: CREATURE_NAME, effect: 'confusion', source: 'Bard', dc: 16 },
            ]);
            expect(screen.getByText("Tasha's Hideous Laughter")).toBeInTheDocument();
            expect(screen.getByText('Mazed')).toBeInTheDocument();
            expect(screen.getByText('Confused')).toBeInTheDocument();
            expect(screen.getByTitle(/Tasha's Hideous Laughter from Wizard: .*DC 12/)).toBeInTheDocument();
            expect(screen.getByTitle(/Mazed by Wizard: .*DC 18/)).toBeInTheDocument();
            expect(screen.getByTitle(/Confused by Bard: .*DC 16/)).toBeInTheDocument();
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
        it('should render Imprisoned and pass the authored prisonType and duration through to the tooltip', () => {
            renderWithTargetEffect({ target: CREATURE_NAME, effect: 'imprisonment', source: 'Wizard', prisonType: 'Minimization', duration: '1 hour' });
            expect(screen.getByText('Imprisoned')).toBeInTheDocument();
            expect(screen.getByTitle('Imprisoned by Wizard: Minimization. 1 hour')).toBeInTheDocument();
        });
    });
});
