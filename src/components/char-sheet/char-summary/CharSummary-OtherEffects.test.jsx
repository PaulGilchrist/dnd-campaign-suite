// @maintained-by-ai
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
//   - Empty-list row omission on the untouched fixture
//     → CharSummary-FixtureContract.test.jsx ("omits every empty stat-list
//       row") — only the null/undefined guard branches are unique here.
//
// Trimmed vs previous revision: the verbatim-vs-capitalized contrast test was
// removed — the multi-case it.each already pins the FULL row text with mixed
// casing ("fire, Piercing, cold"), so copy-pasted capitalization into this
// row still fails loudly here. Resistances capitalization is its siblings'
// contract. beforeEach re-pin also dropped: the vi.mock factory pins
// getActiveBuffs to [] and vi.clearAllMocks preserves implementations.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CharSummary from './CharSummary.jsx';

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
        // values render verbatim (no forced capitalization — unlike the
        // Resistances row, this row must never title-case "fire").
        expect(vulnerabilityRow()).toHaveTextContent(expected);
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
