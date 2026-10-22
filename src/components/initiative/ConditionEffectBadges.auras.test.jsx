// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
}));

// Isolate the aura-spec lane: badge presence here is driven purely by the
// targetEffects array, not by derived condition aggregation (owned by
// ConditionEffectBadges.test.jsx).
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({})),
}));

const CREATURE_NAME = 'Alice';
const CAMPAIGN_NAME = 'test-campaign';

// This lane's distinct aura/protection targetEffect keys. Expected label,
// icon and cls bytes are read from the registry via getEffectDefinition —
// never re-typed here.
const AURA_EFFECT_KEYS = [
    'globe_barrier',
    'antimagic_field',
    'regenerate',
    'aura_of_life',
    'aura_of_purity',
    'circle_of_power',
    'heroism',
    'holy_aura',
    'protection_from_evil_and_good',
    'protection_from_poison',
];

const auraEffectsFor = (target) =>
    AURA_EFFECT_KEYS.map(effect => ({ target, effect, source: 'Cleric' }));

const badgesElement = (overrides = {}) => (
    <ConditionEffectBadges
        conditions={[]}
        targetEffects={[]}
        creatureName={CREATURE_NAME}
        campaignName={CAMPAIGN_NAME}
        isLocalhost={true}
        {...overrides}
    />
);

function renderBadges({ buffs = [], ...overrides } = {}) {
    getRuntimeValue.mockImplementation((name, key) =>
        name === CREATURE_NAME && key === 'activeBuffs' ? buffs : null
    );
    computeConditionEffects.mockReturnValue({});
    return render(badgesElement(overrides));
}

describe('ConditionEffectBadges - Aura & Protection Badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders every aura targetEffect as a badge with exact registry bytes, all removable on localhost', () => {
        renderBadges({ targetEffects: auraEffectsFor(CREATURE_NAME) });

        expect(screen.getAllByTestId('creature-badge')).toHaveLength(AURA_EFFECT_KEYS.length);
        expect(screen.getAllByTitle('Remove effect')).toHaveLength(AURA_EFFECT_KEYS.length);

        for (const effect of AURA_EFFECT_KEYS) {
            const def = getEffectDefinition(effect);
            const badge = screen.getByText(def.label);
            expect(badge.className).toBe(`creature-badge ${def.cls}`);
            expect(badge.querySelector('i').className).toBe(`fa-solid ${def.icon}`);
        }
    });

    it('renders nothing when every aura targetEffect belongs to a different creature', () => {
        renderBadges({ targetEffects: auraEffectsFor('Bob') });
        expect(screen.queryByTestId('creature-badge')).not.toBeInTheDocument();
    });

    it('exposes remove affordances only on localhost (network clients get none)', () => {
        const { rerender } = renderBadges({ targetEffects: auraEffectsFor(CREATURE_NAME) });
        expect(screen.getAllByTitle('Remove effect')).toHaveLength(AURA_EFFECT_KEYS.length);

        rerender(badgesElement({ targetEffects: auraEffectsFor(CREATURE_NAME), isLocalhost: false }));
        expect(screen.getAllByTestId('creature-badge')).toHaveLength(AURA_EFFECT_KEYS.length);
        expect(screen.queryByTitle('Remove effect')).not.toBeInTheDocument();
    });

    it('resolves array-form targets for the protection badges only when they include this creature', () => {
        const { rerender } = renderBadges({
            targetEffects: [
                { target: ['Bob'], effect: 'protection_from_evil_and_good', source: 'Cleric' },
                { target: ['Bob'], effect: 'protection_from_poison', source: 'Cleric' },
            ],
        });
        expect(screen.queryByTestId('creature-badge')).not.toBeInTheDocument();

        rerender(badgesElement({
            targetEffects: [
                { target: [CREATURE_NAME], effect: 'protection_from_evil_and_good', source: 'Cleric' },
                { target: [CREATURE_NAME], effect: 'protection_from_poison', source: 'Cleric' },
            ],
        }));
        expect(screen.getAllByTestId('creature-badge')).toHaveLength(2);
        expect(screen.getByText(getEffectDefinition('protection_from_evil_and_good').label)).toBeInTheDocument();
        expect(screen.getByText(getEffectDefinition('protection_from_poison').label)).toBeInTheDocument();
    });

    // #820 click-pin RESTORED (was withheld here pending the eager-capture
    // source fix): buildProtectionFromPoisonBadge now captures ctx.te.dc
    // eagerly into const poisonDc before returning its onClick closure, so
    // clicking the badge rerolls the CON save vs Poisoned with the dc the
    // te carried at build time instead of dereferencing the ctx.te that the
    // spec loop (jsx:617) reassigns per iteration.
    it('rolls the CON save vs Poisoned with the te dc when the Protection from Poison badge is clicked', () => {
        const onRollConditionSave = vi.fn();
        renderBadges({
            targetEffects: [{ target: [CREATURE_NAME], effect: 'protection_from_poison', source: 'Cleric', dc: 13 }],
            onRollConditionSave,
        });

        fireEvent.click(screen.getByText(getEffectDefinition('protection_from_poison').label));

        expect(onRollConditionSave).toHaveBeenCalledTimes(1);
        expect(onRollConditionSave).toHaveBeenCalledWith(CREATURE_NAME, { key: 'poisoned', label: 'Poisoned', dc: 13, ability: 'con' });
    });

    // Mutant kill vs re-lazification: forcecage's spec sits AFTER
    // protection_from_poison in BADGE_SPECS, so a lazified onClick closure
    // would read the stale forcecage te (dc 19) off ctx.te at click time
    // instead of this badge's eagerly captured dc.
    it('keeps each badge click payload pinned to its own te when a later spec reassigns ctx.te', () => {
        const onRollConditionSave = vi.fn();
        renderBadges({
            targetEffects: [
                { target: [CREATURE_NAME], effect: 'protection_from_poison', source: 'Cleric', dc: 13 },
                { target: [CREATURE_NAME], effect: 'forcecage', source: 'Wizard', dc: 19 },
            ],
            onRollConditionSave,
        });

        fireEvent.click(screen.getByText(getEffectDefinition('protection_from_poison').label));
        expect(onRollConditionSave).toHaveBeenCalledTimes(1);
        expect(onRollConditionSave).toHaveBeenCalledWith(CREATURE_NAME, { key: 'poisoned', label: 'Poisoned', dc: 13, ability: 'con' });

        fireEvent.click(screen.getByText('Forcecaged'));
        expect(onRollConditionSave).toHaveBeenCalledTimes(2);
        expect(onRollConditionSave).toHaveBeenCalledWith(CREATURE_NAME, { key: 'forcecaged', label: 'Forcecaged', dc: 19, ability: 'cha' });
    });

    it('renders Warding Bond from activeBuffs with exact registry bytes and a remove affordance', () => {
        const def = getEffectDefinition('warding_bond');
        renderBadges({ buffs: [{ name: def.label, effect: 'warding_bond', sourceCharacter: 'Cleric' }] });

        const badge = screen.getByText(def.label);
        expect(badge.className).toBe(`creature-badge ${def.cls}`);
        expect(badge.querySelector('i').className).toBe(`fa-solid ${def.icon}`);
        // Exactly one badge, exactly one remove — nothing else leaked in.
        expect(screen.getAllByTestId('creature-badge')).toHaveLength(1);
        expect(screen.getAllByTitle('Remove effect')).toHaveLength(1);
    });
});
