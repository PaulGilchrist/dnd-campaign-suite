// @maintained-by-ai
//
// Coverage ownership: the condition-immunity sources of the "Immunities:" row
// (charSummaryCalc.js computeResistances) — NOT the aura source.
// Three exact-text tests pin the whole row-assembly lane:
//   A. base playerStats.immunities + unconditional automationConditionImmunities
//      merge, with Set dedup of a shared type.
//   B. automationConditionalImmunities gated on an active 'Rage' buff
//      (collectRageConditionalImmunities) — positive + both gate negatives.
//   C. conditionImmunity from buffs in CONDITION_IMMUNITY_BUFF_NAMES: allow-list
//      guard (Bless filtered), membership (Calm Emotions, Heroes' Feast),
//      cross-buff + cross-source dedup via the buff lowercase normalization,
//      and row order (fixed by CONDITION_IMMUNITY_BUFF_NAMES order, base first).
// Exact textContent equality (not substring/has-text) catches extra types,
// missing types, wrong order, and wrong capitalization in every test.
//
// NOT owned here (delegated to siblings — do not re-add):
//   - auraComboEffects immunities merge/dedup → CharSummary-AuraAndInitiative.test.jsx
//   - Feign Death resistance + condition immunity dual lane, badge/tooltips
//     → CharSummary-BuffResistances.test.jsx
//   - computeResistances calc-level contract (runCalc) → CharSummary.test-mocks.test.jsx
//     (this file owns the rendered-row lane only)

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

// Exact rendered row text (whitespace-collapsed) — a substring match would
// pass even if an extra type were appended or capitalization drifted.
function immunityRowText() {
    const row = screen.getByText('Immunities:').closest('div');
    return row.textContent.replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
    vi.clearAllMocks();
    getActiveBuffs.mockReturnValue([]);
});

describe('CharSummary - Immunities row sources', () => {
    it('merges base immunities and automationConditionImmunities, listing a shared type once', () => {
        renderSummary({
            playerStats: {
                ...mockPlayerStats,
                immunities: ['poison', 'charm'],
                automationConditionImmunities: ['poison', 'charmed'],
            },
        });

        // Pins base rendering, capitalization, comma separator, unconditional
        // merge of the automation list, and dedup of the shared 'poison'.
        expect(immunityRowText()).toBe('Immunities: Poison, Charm, Charmed');
    });

    it.each([
        {
            desc: 'Rage is active and the feature requires Rage',
            buffs: [{ name: 'Rage' }],
            requiresActive: 'Rage',
            expected: 'Immunities: Charmed',
        },
        {
            desc: 'no buff is active',
            buffs: [],
            requiresActive: 'Rage',
            expected: null,
        },
        {
            desc: 'Rage is active but the feature requires Heroism',
            buffs: [{ name: 'Rage' }],
            requiresActive: 'Heroism',
            expected: null,
        },
    ])('gates automationConditionalImmunities on an active Rage buff: $desc', ({ buffs, requiresActive, expected }) => {
        getActiveBuffs.mockReturnValue(buffs);
        renderSummary({
            playerStats: {
                ...mockPlayerStats,
                automationConditionalImmunities: [{ requiresActive, immunities: ['charmed'] }],
            },
        });

        if (expected) {
            expect(immunityRowText()).toBe(expected);
        } else {
            // Row absent entirely: catches both a leaked immunity and a
            // spuriously rendered empty row (default fixture immunities is []).
            expect(screen.queryByText('Immunities:')).not.toBeInTheDocument();
        }
    });

    it('surfaces only allow-listed buff immunities, unioned in list order and deduplicated case-insensitively', () => {
        getActiveBuffs.mockReturnValue([
            { name: 'Bless', conditionImmunity: ['charmed'] },           // outside the allow-list → absent
            { name: 'Calm Emotions', conditionImmunity: ['frightened'] }, // unique → membership pinned
            { name: "Heroes' Feast", conditionImmunity: ['poisoned'] },   // unique → membership pinned
            { name: 'Heroism', conditionImmunity: ['Frightened'] },       // real mixed-case value; deduped
        ]);
        renderSummary({ playerStats: { ...mockPlayerStats, immunities: ['poison'] } });

        // Order: base immunities first, then buffs in CONDITION_IMMUNITY_BUFF_NAMES
        // order (Calm Emotions < Heroes' Feast < Heroism); Heroism's mixed-case
        // 'Frightened' normalizes to the Calm Emotions entry. If the allow-list
        // guard broke, ', Charmed' would appear; removing a name from the list
        // drops or reorders its type.
        expect(immunityRowText()).toBe('Immunities: Poison, Frightened, Poisoned');
    });
});
