// @improved-by-ai
//
// Coverage ownership: the `auraComboEffects` prop — the ONLY owner of this prop across the
// CharSummary-* family (verified by grep over all siblings).
//   - Aura of Warding resistance attribution markers (+ dedup with base resistances)
//   - Aura immunities merge (+ dedup) into the Immunities row
//   - Aura of Alacrity speed bonus marker (previously untested anywhere)
//
// NOT owned here (delegated to siblings — do not re-add):
//   - Initiative click-to-roll / advantage / exhaustion penalty → CharSummary-Ally-Initiative.test.jsx
//   - initiative-rolled event clearing surge effects → CharSummary-EventHandlers.test.jsx
//   - Aura/buff BADGES (Aura of Life, Heroes' Feast, Rage resistances) → CharSummary-BuffResistances.test.jsx
//   - Speed CSS classes / speed calculation recipes → CharSummary-SpeedCalculations.test.jsx
//
// Improvements over previous revision:
//   - "merge with deduplication" tests now actually assert deduplication (duplicate entries
//     would previously still have passed — both types rendered regardless).
//   - Resistance tests scope queries to the Resistances/Immunities row (was page-wide text match).
//   - Attribution marker assertions verify the structural `.aura-source` marker element and its
//     count, not just any element whose title matches somewhere on the page.
//   - Renamed the immunity test: the component renders NO source marker for immunities, so the
//     old name ("displays aura source marker for immunity") promised behavior that does not exist.
//     Fixture no longer passes `immunitySources` (a phantom key the calc ignores).
//   - "null or undefined" smoke test now covers both values via it.each, and asserts the absence
//     of resistance/immunity rows and aura markers instead of only checking the name renders.
//   - Added Aura of Alacrity speed-bonus marker coverage (owning gap).

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

function renderSummary(props) {
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

describe('CharSummary - auraComboEffects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('attributes aura resistances to their source with an .aura-source marker', () => {
        renderSummary({
            playerStats: { ...mockPlayerStats, resistances: [] },
            auraComboEffects: { resistances: ['radiant'], resistanceSource: 'Aura of Protection' },
        });

        const row = statRow('Resistances:');
        expect(within(row).getByText('Radiant')).toBeInTheDocument();
        const markers = within(row).getAllByTitle(/Aura of Protection/);
        expect(markers).toHaveLength(1);
        expect(markers[0]).toHaveClass('aura-source');
    });

    it('omits the attribution marker when the aura grants no resistanceSource', () => {
        renderSummary({
            playerStats: { ...mockPlayerStats, resistances: [] },
            auraComboEffects: { resistances: ['radiant'] },
        });

        const row = statRow('Resistances:');
        expect(within(row).getByText('Radiant')).toBeInTheDocument();
        expect(row.querySelectorAll('.aura-source')).toHaveLength(0);
    });

    it('merges aura resistances into the base list, listing a shared type exactly once', () => {
        renderSummary({
            playerStats: { ...mockPlayerStats, resistances: ['fire'] },
            auraComboEffects: { resistances: ['fire', 'cold'], resistanceSource: 'Aura of Protection' },
        });

        const row = statRow('Resistances:');
        // Deduplication: a broken merge would render "Fire" twice — only one entry may appear.
        expect(within(row).getAllByText(/Fire/)).toHaveLength(1);
        expect(within(row).getAllByText(/Cold/)).toHaveLength(1);
        // Every aura-provided type carries the source attribution.
        expect(within(row).getAllByTitle(/Aura of Protection/)).toHaveLength(2);
    });

    it('merges aura immunities into the base list, listing a shared type exactly once', () => {
        renderSummary({
            playerStats: { ...mockPlayerStats, immunities: ['poison'] },
            auraComboEffects: { immunities: ['poison', 'cold'] },
        });

        const row = statRow('Immunities:');
        expect(within(row).getAllByText(/Poison/)).toHaveLength(1);
        expect(within(row).getAllByText(/Cold/)).toHaveLength(1);
    });

    it('shows the aura speed bonus attributed to its source', () => {
        renderSummary({
            auraComboEffects: { speedBonus: 10, speedSource: 'Aelar' },
        });

        const marker = screen.getByTitle("From Aelar's Aura of Alacrity");
        expect(marker).toHaveClass('aura-source');
        expect(marker).toHaveTextContent('(+10)');
    });

    it.each([null, undefined])('renders plain stats with no rows or markers when auraComboEffects is %s', (auraComboEffects) => {
        renderSummary({
            playerStats: { ...mockPlayerStats, resistances: [], immunities: [] },
            auraComboEffects,
        });

        expect(screen.getByText(mockPlayerStats.name)).toBeInTheDocument();
        expect(screen.queryByText('Resistances:')).not.toBeInTheDocument();
        expect(screen.queryByText('Immunities:')).not.toBeInTheDocument();
        expect(document.querySelectorAll('.aura-source')).toHaveLength(0);
    });
});
