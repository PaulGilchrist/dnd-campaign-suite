// @improved-by-ai
//
// Coverage ownership: the condition-immunity sources of the "Immunities:" row
// (charSummaryCalc.js computeResistances, lines 180-186) — NOT the aura source.
//   - playerStats.immunities (base) and playerStats.automationConditionImmunities
//   - automationConditionalImmunities gated on an active 'Rage' buff
//     (collectRageConditionalImmunities — previously untested anywhere)
//   - conditionImmunity from buffs whose name is in CONDITION_IMMUNITY_BUFF_NAMES,
//     including the allow-list guard (previously untested anywhere)
//   - cross-source deduplication with lowercase normalization
//
// NOT owned here (delegated to siblings — do not re-add):
//   - auraComboEffects immunities merge/dedup → CharSummary-AuraAndInitiative.test.jsx
//   - Feign Death resistance + condition immunity → CharSummary-BuffResistances.test.jsx
//   - Heroes' Feast / Rage / Aura BADGES and tooltips → CharSummary-BuffResistances.test.jsx
//
// Quality improvements over previous revision (6 tests → 9 tests / 12 runs):
//   - Queries scoped to the "Immunities:" row via statRow helper (was page-wide
//     regex: /Poison/ matched any element anywhere, including badges and tooltips).
//   - Positive tests assert the full rendered row text, so ordering, capitalization,
//     and separator formatting are pinned — text-presence checks passed even if a
//     type rendered twice or in the wrong place.
//   - Old "buff is inactive" negative passed even if the buff code were deleted
//     (empty getActiveBuffs is the fixture default). Replaced with negatives that
//     fail when the guards break: non-allow-listed buff names, missing Rage buff,
//     and requiresActive mismatch.
//   - Added Rage-gate coverage (positive + two gate negatives) and the
//     CONDITION_IMMUNITY_BUFF_NAMES allow-list guard.
//   - Imports shared mockPlayerStats/mockCampaignName (removed 38-line local
//     duplicate fixture); per-test overrides via spread.
//   - Removed unused mocks (rulesFactory is only called for Monks; attackCalc is
//     exercised harmlessly by the real module) and the unnecessary
//     window.location.hostname mutation.
//   - One beforeEach re-pins inert getActiveBuffs (mockReturnValue survives
//     clearAllMocks; re-pinning makes ordering explicit).

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarImage.jsx', () => ({ default: () => <div data-testid="avatar-image">Avatar</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: () => <div data-testid="short-rest-btn">Short Rest</div> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(({ maxGetter }) => ({ current: maxGetter(), update: vi.fn() })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn(() => null),
    getStore: vi.fn(() => new Map()),
}));

vi.mock('../../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: vi.fn((_name, _key, defaultValue) => [defaultValue, vi.fn()]),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn(), rollInitiative: vi.fn() })),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

function renderSummary(props = {}) {
    return render(
        <CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            {...props}
        />
    );
}

function statRow(label) {
    return screen.getByText(label).closest('div');
}

beforeEach(() => {
    vi.clearAllMocks();
    getActiveBuffs.mockReturnValue([]);
});

// ---------------------------------------------------------------------------
// Direct sources: playerStats.immunities, automationConditionImmunities,
// and Rage-gated automationConditionalImmunities.
// ---------------------------------------------------------------------------
describe('CharSummary - Immunities row direct sources', () => {
    it('renders the Immunities row from playerStats.immunities, capitalized and comma-separated', () => {
        renderSummary({ playerStats: { ...mockPlayerStats, immunities: ['poison', 'charm'] } });

        expect(statRow('Immunities:')).toHaveTextContent('Immunities: Poison, Charm');
    });

    it('merges automationConditionImmunities into the row without duplicating a shared type', () => {
        renderSummary({
            playerStats: {
                ...mockPlayerStats,
                immunities: ['poison'],
                automationConditionImmunities: ['poison', 'charmed'],
            },
        });

        const row = statRow('Immunities:');
        // Dedup: a broken merge would render "Poison" twice.
        expect(within(row).getAllByText(/Poison/)).toHaveLength(1);
        expect(row).toHaveTextContent('Immunities: Poison, Charmed');
    });

    it('surfaces automationConditionalImmunities only while Rage is active', () => {
        getActiveBuffs.mockReturnValue([{ name: 'Rage' }]);
        renderSummary({
            playerStats: {
                ...mockPlayerStats,
                automationConditionalImmunities: [{ requiresActive: 'Rage', immunities: ['charmed'] }],
            },
        });

        expect(statRow('Immunities:')).toHaveTextContent('Immunities: Charmed');
    });

    it.each([
        {
            desc: 'no Rage buff is active',
            buffs: [],
            conditionals: [{ requiresActive: 'Rage', immunities: ['charmed'] }],
        },
        {
            desc: 'Rage is active but the feature requires Heroism',
            buffs: [{ name: 'Rage' }],
            conditionals: [{ requiresActive: 'Heroism', immunities: ['charmed'] }],
        },
    ])('gates conditional immunities OFF when $desc', ({ buffs, conditionals }) => {
        getActiveBuffs.mockReturnValue(buffs);
        renderSummary({
            playerStats: { ...mockPlayerStats, automationConditionalImmunities: conditionals },
        });

        expect(screen.queryByText(/Charmed/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Buff-derived sources: only buffs named in CONDITION_IMMUNITY_BUFF_NAMES
// contribute their conditionImmunity to the row.
// ---------------------------------------------------------------------------
describe('CharSummary - Immunities row from buffs', () => {
    it.each(["Heroes' Feast", 'Calm Emotions', 'Heroism'])('surfaces $name condition immunities in the row', (buffName) => {
        getActiveBuffs.mockReturnValue([{ name: buffName, conditionImmunity: ['frightened'] }]);
        renderSummary();

        expect(statRow('Immunities:')).toHaveTextContent('Immunities: Frightened');
    });

    it('ignores conditionImmunity on buffs outside the condition-immunity allow-list', () => {
        getActiveBuffs.mockReturnValue([{ name: 'Bless', conditionImmunity: ['charmed'] }]);
        renderSummary();

        expect(screen.queryByText('Immunities:')).not.toBeInTheDocument();
    });

    it('unions condition immunities from multiple buffs, listing each type exactly once', () => {
        getActiveBuffs.mockReturnValue([
            { name: 'Bless', conditionImmunity: ['charmed'] },
            { name: "Heroes' Feast", conditionImmunity: ['Poisoned'] },
            { name: 'Calm Emotions', conditionImmunity: ['frightened'] },
        ]);
        renderSummary();

        // Allow-list filter drops "Bless"; buff-name-list order (Calm Emotions
        // before Heroes' Feast in CONDITION_IMMUNITY_BUFF_NAMES) fixes the row
        // order, and the mixed-case "Poisoned" is normalized identically.
        expect(statRow('Immunities:')).toHaveTextContent('Immunities: Frightened, Poisoned');
    });

    it('deduplicates a condition shared between base immunities and a buff', () => {
        getActiveBuffs.mockReturnValue([{ name: 'Calm Emotions', conditionImmunity: ['Frightened'] }]);
        renderSummary({ playerStats: { ...mockPlayerStats, immunities: ['frightened'] } });

        const row = statRow('Immunities:');
        // Case-insensitive dedup: base "frightened" + buff "Frightened" → one entry.
        expect(within(row).getAllByText(/Frightened/)).toHaveLength(1);
        expect(row).toHaveTextContent('Immunities: Frightened');
    });

    it('omits the Immunities row when no source provides an immunity', () => {
        renderSummary({ playerStats: { ...mockPlayerStats, immunities: [] } });

        expect(screen.queryByText('Immunities:')).not.toBeInTheDocument();
    });
});
