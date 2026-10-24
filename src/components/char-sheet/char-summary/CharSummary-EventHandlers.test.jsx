// @maintained-by-ai
//
// CharSummary window event handlers + XP prop-sync effect.
//
// Coverage ownership (CharSummary family delegation):
//   OWNED HERE (unique behavioral coverage — no sibling covers these):
//   - 'initiative-rolled' event → clears wild magic surge effects (real DOM
//     removal + synced setter invoked with null; modal must NOT open)
//   - 'open-short-rest' event → opens the Short Rest modal (CLA-226; dispatched
//     by CharSpecialActions' "memorize_spell" automation row)
//   - initiative-rolled listener teardown on unmount
//   - XP subtitle reflects playerStats.xp prop changes via the sync effect
//
// NOT owned here (delegated — do not re-add):
//   - Surge badge rendering, "Tamed" text, duration tooltips → CharSummary-WildMagic.test.jsx
//   - Short rest modal close flow / short rest button click → CharSummary-Prerequisites.test.jsx
//   - XP modal preview calculations, Bait and Switch badge → CharSummary-XPModes.test.jsx
//   - Initiative roll display / click-to-roll → CharSummary-Ally-Initiative.test.jsx
//   - Speed calculation recipes → CharSummary-SpeedCalculations.test.jsx (and siblings)

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';

// Shared harness so the useSyncedState mock can seed per-test state and
// record every synced write — tests then assert on real DOM behavior,
// not just mock call bookkeeping.
const harness = vi.hoisted(() => ({ seed: {}, syncedCalls: [] }));

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarImage.jsx', () => ({ default: () => <div data-testid="avatar-image">Avatar</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: ({ onClick }) => <button data-testid="short-rest-btn" onClick={onClick}>Short Rest</button> }));
// Renders a marker only when CharSummary actually mounts it, so tests can
// observe showShortRest state transitions.
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(() => ({ current: false, update: vi.fn() })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn(() => undefined),
    getStore: vi.fn(() => new Map()),
}));

// State-backed useSyncedState: seeded per-test via harness.seed, writes
// recorded in harness.syncedCalls AND applied to real React state so the
// UI updates — tests verify behavior, not just setter calls.
vi.mock('../../../hooks/runtime/useSyncedState.js', async () => {
    const React = await import('react');
    return {
        useSyncedState: (name, key, defaultValue) => {
            const initial = key in harness.seed ? harness.seed[key] : defaultValue;
            const [value, setValue] = React.useState(initial);
            const keyRef = React.useRef(key);
            const setter = React.useCallback((newValue) => {
                harness.syncedCalls.push({ key: keyRef.current, value: newValue });
                setValue(newValue);
            }, []);
            return [value, setter];
        },
    };
});

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollInitiative: vi.fn(),
    })),
}));

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    default: {
        getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 10) } })),
    },
    getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 10) } })),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

const CAMPAIGN = 'test-campaign';

// Per-test fixture factory: override only what a test cares about.
function makePlayerStats(overrides = {}) {
    return {
        name: 'Thorin',
        xp: 2300,
        xpMode: 'milestone',
        race: { name: 'Dwarf', type: 'Hill Dwarf', subrace: { name: 'Hill Dwarf', speed: 25 } },
        class: { name: 'Cleric', subclass: { name: 'War', type: 'Choice' }, major: { name: 'Cleric' } },
        level: 5,
        alignment: 'Lawful Good',
        proficiency: 3,
        initiative: 2,
        initiativeAdvantage: false,
        abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Strength', bonus: 2 }],
        armorClass: 18,
        armorClassFormula: '16 + 2 (shield)',
        hitPoints: 45,
        inventory: { equipped: ['Scale Mail', 'Shield'] },
        equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }, { name: 'Shield', type: 'Shield' }],
        background: 'Soldier',
        immunities: [],
        resistances: [],
        vulnerabilities: [],
        senses: [],
        proficiencies: [],
        languages: [],
        automation: { passives: [], actions: [] },
        passives: [],
        exhaustionLevel: 0,
        ...overrides,
    };
}

const renderSummary = (overrides = {}) =>
    render(<CharSummary playerStats={makePlayerStats(overrides)} campaignName={CAMPAIGN} exhaustionLevel={0} />);

beforeEach(() => {
    harness.seed = {};
    harness.syncedCalls.length = 0;
});

// ---------------------------------------------------------------------------
// 'initiative-rolled' event → clears wild magic surge effects
// ---------------------------------------------------------------------------
describe('CharSummary - Initiative Rolled Event', () => {
    it('clears the surge badge and syncs null without opening the short rest modal', () => {
        harness.seed.wildMagicSurgeEffects = [{ timestamp: 1000, roll: 5, effect: 'Fireball' }];
        renderSummary();

        expect(screen.getByText(/Surge Effects:/)).toBeInTheDocument();
        expect(screen.queryByTestId('short-rest-modal')).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new Event('initiative-rolled'));
        });

        // Real DOM effect: the badge is gone, not just the setter nudged.
        expect(screen.queryByText(/Surge Effects:/)).not.toBeInTheDocument();
        // Server-first contract: the clear is written through the synced setter.
        expect(harness.syncedCalls).toEqual([{ key: 'wildMagicSurgeEffects', value: null }]);
        // The two window events stay independently wired.
        expect(screen.queryByTestId('short-rest-modal')).not.toBeInTheDocument();
    });

    it('detaches the initiative-rolled listener on unmount', () => {
        const { unmount } = renderSummary();
        unmount();

        act(() => {
            window.dispatchEvent(new Event('initiative-rolled'));
        });

        // A leaked listener would record a synced write after unmount.
        expect(harness.syncedCalls).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 'open-short-rest' event → opens the Short Rest modal (CLA-226)
// ---------------------------------------------------------------------------
describe('CharSummary - Open Short Rest Event', () => {
    it('opens the short rest modal when open-short-rest fires', () => {
        renderSummary();

        expect(screen.queryByTestId('short-rest-modal')).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent('open-short-rest'));
        });

        expect(screen.getByTestId('short-rest-modal')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// XP prop-sync effect
// ---------------------------------------------------------------------------
describe('CharSummary - XP Prop Sync', () => {
    it('updates the XP subtitle when playerStats.xp changes', () => {
        const { rerender } = renderSummary({ xpMode: 'experience', xp: 1000 });

        expect(screen.getByText(/1,000 XP/)).toBeInTheDocument();

        rerender(<CharSummary playerStats={makePlayerStats({ xpMode: 'experience', xp: 1500 })} campaignName={CAMPAIGN} exhaustionLevel={0} />);

        expect(screen.getByText(/1,500 XP/)).toBeInTheDocument();
    });
});
