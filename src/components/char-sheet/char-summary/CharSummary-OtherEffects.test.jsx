// @improved-by-ai
//
// Coverage ownership (CharSummary family delegation): the "Vulnerabilities:"
// row of StatListsBlock (CharSummary.jsx:273) — the ONLY non-empty
// vulnerabilities fixture anywhere in the family (every sibling and the
// shared mockPlayerStats pin vulnerabilities: []).
//
// NOT owned here (delegated to siblings — do not re-add):
//   - Senses / Proficiencies / Languages rows → CharSummary-Display.test.jsx
//   - Resistances & Immunities rows (capitals, dedup, buffs, auras)
//     → CharSummary-ConditionImmunities / -BuffResistances / -ResistanceTypes
//       / -AuraAndInitiative.test.jsx
//   - Background popup content → CharSummary-UI-Interactions.test.jsx
//
// Quality improvements over previous revision (2 tests → 3 tests / 6 runs):
//   - Positives assert the FULL row text (label + join order + separator),
//     not a page-wide /fire/ regex that passed if "fire" appeared in any
//     element anywhere (badges, tooltips, other rows).
//   - Pinned the verbatim-render contract: unlike the Resistances/Immunities
//     rows, vulnerabilities are NOT capitalized. A test mixes case-sensitive
//     values next to populated sibling rows so a copy-paste of the sibling
//     capitalization into this row now fails here.
//   - Negative covers all three guard branches on line 273 ([] / null /
//     undefined) via it.each — previously only [] was tested.
//   - Reduced over-mocking: dropped Popup, rulesFactory, and attackCalc
//     mocks (this path never touches them; the identical-fixture sibling
//     CharSummary-ConditionImmunities renders without them).

import { render, screen } from '@testing-library/react';
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

// The row is <span><b>Vulnerabilities: </b>{values}</span> — the bold label
// is the only element whose own text is "Vulnerabilities:", and its nearest
// span ancestor is the row itself.
function vulnerabilityRow() {
    return screen.getByText('Vulnerabilities:').closest('span');
}

beforeEach(() => {
    vi.clearAllMocks();
    // Re-pin inert buffs: this lane reads vulnerabilities straight from
    // playerStats, so an empty buff list keeps the render deterministic.
    getActiveBuffs.mockReturnValue([]);
});

// ---------------------------------------------------------------------------
// Vulnerabilities row
// ---------------------------------------------------------------------------
describe('CharSummary - Vulnerabilities row', () => {
    it.each([
        { values: ['poison'], expected: 'Vulnerabilities: poison' },
        { values: ['fire', 'Piercing', 'cold'], expected: 'Vulnerabilities: fire, Piercing, cold' },
    ])('renders the row as "$expected"', ({ values, expected }) => {
        renderSummary({ playerStats: { ...mockPlayerStats, vulnerabilities: values } });

        // Exact content pins label, join order, ", " separator, and that
        // values render verbatim (no forced capitalization).
        expect(vulnerabilityRow()).toHaveTextContent(expected);
    });

    it('renders vulnerabilities verbatim without leaking into the capitalized Resistances row', () => {
        renderSummary({
            playerStats: { ...mockPlayerStats, vulnerabilities: ['fire'], resistances: ['fire'] },
        });

        // Same raw type, two rows, two render contracts: Resistances is
        // capitalized ("Fire"), Vulnerabilities stays verbatim ("fire").
        expect(screen.getByText('Resistances:').closest('div')).toHaveTextContent('Resistances: Fire');
        expect(vulnerabilityRow()).toHaveTextContent('Vulnerabilities: fire');
    });

    it.each([
        { label: 'an empty array', vulnerabilities: [] },
        { label: 'null', vulnerabilities: null },
        { label: 'undefined', vulnerabilities: undefined },
    ])('omits the row when vulnerabilities is $label', ({ vulnerabilities }) => {
        renderSummary({ playerStats: { ...mockPlayerStats, vulnerabilities } });

        expect(screen.queryByText('Vulnerabilities:')).not.toBeInTheDocument();
    });
});
