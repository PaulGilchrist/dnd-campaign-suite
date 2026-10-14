// @improved-by-ai
//
// Coverage ownership: the two SUMMARY_BADGE_SPECS badges driven by runtime combat state
// that no other CharSummary-* sibling asserts:
//   - Starry Form constellation badge (starryFormBadge reads activeBuffs runtime value;
//     this is the ONLY file asserting the `Starry Form - <constellation>` label)
//   - Nature's Sanctuary info badge (computeSanctuaryInfo creatures loop; the ONLY file
//     asserting the plain 'Sanctuary' summary-badge label)
//
// NOT owned here (delegated to siblings — do not re-add):
//   - AC badges / acPenalty paths → CharSummary-BadgesAndAC.test.jsx
//   - Haste / Shield / Barkskin AC buff badges → CharSummary-BuffEffects.test.jsx
//   - Starry Form *resistance row* (getActiveBuffs → Resistances line,
//     a different code path) and Aura of Life / Heroes' Feast badges → CharSummary-BuffResistances.test.jsx
//   - Cover badges incl. "+2 Cover: Nature's Sanctuary" (computed from `characters` prop,
//     which this file never passes) → CharSummary-Cover.test.jsx
//   - Wrath of the Sea badge → CharSummary-AdditionalCoverage.test.jsx
//
// Quality improvements over previous revision:
//   - Uses shared mockPlayerStats/mockCampaignName from CharSummary.test-mocks.test.jsx
//     (removed a 28-line duplicate fixture).
//   - Deterministic beforeEach: clearAllMocks() keeps mock implementations, so the
//     previous revision leaked each test's mockImplementation/getCombatSummary return
//     value into later tests. beforeEach now re-pins inert defaults; tests opt in
//     via the mockRuntime() helper fixture.
//   - Added '@testing-library/jest-dom' import (family convention).
//   - Removed window.location.hostname mutation (jsdom URL is already localhost).
//   - Starry Form badge assertions now verify the semantic badge class and that the
//     tooltip carries the constellation and its constellation-specific benefit
//     (previous tests matched the label text only — any element with that text passed).
//   - Added "other buff carries a constellation" negative (guards the name-match rule).
//   - Sanctuary tests scope the query to the exact 'Sanctuary' badge label (previous
//     /Sanctuary/ regex would also match cover-badge text) and verify tooltip
//     attribution (protector druid + resistance), including the 'None' default.
//   - Added negative paths for computeSanctuaryInfo loop guards: inactive sanctuary,
//     player not in creatures list, non-player caster (previous file had zero).

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
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
    useRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
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

// Rules/attack stubs are required transitively by charSummaryCalc during render.
vi.mock('../../../services/rules/rulesFactory.js', () => ({
    default: {
        getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
    },
    getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfLifeHandler.js', () => ({
    isAuraOfLifeActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(() => false),
    handle: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks preserves implementations — re-pin inert defaults so
    // per-test overrides never leak across cases.
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
});

/** Route getRuntimeValue lookups through a `${name}.${key}` → value fixture. */
function mockRuntime(lookups = {}) {
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => lookups[`${name}.${key}`] ?? null);
}

function renderSummary() {
    render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
}

// ---------------------------------------------------------------------------
// Starry Form constellation badge (activeBuffs runtime value → SUMMARY_BADGE_SPECS)
// ---------------------------------------------------------------------------
describe('CharSummary — Starry Form constellation badge', () => {
    it.each([
        ['Archer', 'Luminous Arrow'],
        ['Chalice', 'Healing spells'],
        ['Dragon', 'Concentration checks'],
    ])('renders buff badge for the %s constellation with its benefit in the tooltip', (constellation, expectedBenefit) => {
        mockRuntime({ 'Thorin.activeBuffs': [{ name: 'Starry Form', constellation }] });

        renderSummary();

        const badge = screen.getByText(`Starry Form - ${constellation}`);
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('creature-badge', 'effect-buff');
        expect(badge).toHaveAttribute('title', expect.stringContaining(constellation));
        expect(badge).toHaveAttribute('title', expect.stringContaining(expectedBenefit));
    });

    it.each([
        ['buff has no constellation', [{ name: 'Starry Form' }]],
        ['a different buff carries the constellation', [{ name: 'Haste', constellation: 'Archer' }]],
        ['no active buffs', []],
    ])('does not render the badge when %s', (_description, activeBuffs) => {
        mockRuntime({ 'Thorin.activeBuffs': activeBuffs });

        renderSummary();

        expect(screen.queryAllByText(/Starry Form/)).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Nature's Sanctuary info badge (computeSanctuaryInfo creatures loop)
// ---------------------------------------------------------------------------
describe('CharSummary — Nature\'s Sanctuary info badge', () => {
    function mockDruidSanctuary({ active = true, creatures = ['Thorin'], resistance = 'Cold' } = {}) {
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [
                { name: 'Druid1', type: 'player' },
                { name: 'Thorin', type: 'player' },
            ],
        });
        mockRuntime({
            'Druid1.naturesSanctuaryActive': active,
            'Druid1.naturesSanctuaryCreatures': creatures,
            'Druid1.naturesSanctuaryResistance': resistance,
        });
    }

    it.each`
        resistance      | expectedTooltipFragment
        ${'Cold'}       | ${'Cold resistance'}
        ${null}         | ${'None resistance'}
    `('attributes protection to the druid and $expectedTooltipFragment in the tooltip', ({ resistance, expectedTooltipFragment }) => {
        mockDruidSanctuary({ resistance });

        renderSummary();

        const badge = screen.getByText('Sanctuary');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('creature-badge', 'effect-buff');
        expect(badge).toHaveAttribute('title', expect.stringContaining('Protected by Druid1'));
        expect(badge).toHaveAttribute('title', expect.stringContaining(expectedTooltipFragment));
    });

    it.each([
        ['sanctuary is inactive', () => mockDruidSanctuary({ active: false })],
        ['player is not in the sanctuary creatures list', () => mockDruidSanctuary({ creatures: ['SomeoneElse'] })],
        ['the sanctuary caster is not a player', () => {
            vi.mocked(getCombatSummary).mockReturnValue({ creatures: [{ name: 'Druid1', type: 'monster' }] });
            mockRuntime({
                'Druid1.naturesSanctuaryActive': true,
                'Druid1.naturesSanctuaryCreatures': ['Thorin'],
            });
        }],
    ])('does not render the Sanctuary badge when %s', (_description, setup) => {
        setup();

        renderSummary();

        expect(screen.queryByText('Sanctuary')).not.toBeInTheDocument();
    });
});
