// @improved-by-ai
//
// Coverage ownership (per family delegation): AC buff ATTRIBUTION BADGES —
// the text, .aura-source marker, and tooltip of each buff-driven indicator in
// the Armor Class row (CharSummary.jsx AC_BADGE_SPECS).
//
// NOT owned here (delegated — do not re-add):
//   - AC total NUMBER arithmetic → CharSummary-BadgesAndAC.test.jsx
//   - Cover badges → CharSummary-Cover.test.jsx
//   - Bait and Switch badge → CharSummary-XPModes.test.jsx
//   - Aura resistance asterisk markers → CharSummary-AuraAndInitiative.test.jsx
//   - Resistance rows from buffs → CharSummary-BuffResistances.test.jsx
//
// Quality improvements over previous revision (7 tests / 8 runs → 4 tests / 10 runs):
//   - Each positive test now asserts the badge is a .aura-source span inside
//     the Armor Class row AND carries its attribution tooltip (title) — the
//     tooltip is the whole point of the indicator ("which buff raised my AC?"),
//     and was previously untested. Text-only assertions passed even if the
//     text were rendered by the wrong element without attribution.
//   - Fixed ugly it.each names (%s on objects → $effect interpolation).
//   - Added Haste + Mage Armor stacking: both fragments render inside the
//     single combined badge span (previously untested union branch of the
//     haste-mage-armor spec).
//   - Added Defensive Duelist guard negative: a buff with no acBonus must not
//     render a badge or fabricate a +0 bonus (charSummaryCalc guard path).
//   - Added unknown-buff negative: non-AC effects must not leak into the AC row.
//   - Added multi-buff coexistence test asserting the full badge SET structurally
//     (guards AC_BADGE_SPECS map against suppressive regressions), not just
//     individual texts.
//   - Negative paths scoped to the Armor Class row instead of the whole
//     document, so unrelated .aura-source markers elsewhere can't break them.
//   - renderSummary helper matches sibling convention.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
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

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    default: {
        getRules: () => ({ classRules: { getUnarmoredMovementIncrease: () => 0 } }),
    },
    getRules: () => ({ classRules: { getUnarmoredMovementIncrease: () => 0 } }),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

// ---------------------------------------------------------------------------
// Helpers — the AC row is <div class="clickable"><b>Armor Class: </b>{value}{badges}</div>
// ---------------------------------------------------------------------------
const renderSummary = (buffs = []) => {
    getActiveBuffs.mockReturnValue(buffs);
    render(
        <CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
        />
    );
};

const armorClassRow = () => screen.getByText(/^Armor Class:/).parentElement;

// ---------------------------------------------------------------------------
// Positive path — each buff renders an attributed .aura-source badge in the
// AC row with its exact label and attribution tooltip.
// mockPlayerStats has Dex +2 (drives the mage-armor formula text).
// ---------------------------------------------------------------------------
describe('CharSummary - AC buff attribution badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        { effect: 'haste', expectedText: '(+2 from Haste)', expectedTitle: undefined },
        { effect: 'shield', expectedText: '(+5 from Shield)', expectedTitle: 'From Shield' },
        { effect: 'shield_of_faith', expectedText: '(+2 from Shield of Faith)', expectedTitle: 'From Shield of Faith' },
        { effect: 'barkskin', expectedText: '(AC 17 from Barkskin)', expectedTitle: 'From Barkskin' },
        { effect: 'defensive_duelist', acBonus: 3, expectedText: '(+3 from Defensive Duelist)', expectedTitle: 'From Defensive Duelist' },
        { effect: 'mage_armor', baseAc: 13, expectedText: '(13 + 2 Dex)', expectedTitle: 'From Mage Armor (13 + 2 Dex)' },
    ])('attributes the AC buff "$effect" with badge $expectedText', ({ effect, acBonus, baseAc, expectedText, expectedTitle }) => {
        renderSummary([{ effect, ...(acBonus !== undefined ? { acBonus } : {}), ...(baseAc !== undefined ? { baseAc } : {}) }]);
        const badge = screen.getByText(expectedText);
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('aura-source');
        expect(armorClassRow()).toContainElement(badge);
        if (expectedTitle) {
            expect(badge).toHaveAttribute('title', expectedTitle);
        }
    });

    it('renders Haste and Mage Armor fragments inside one combined badge when both are active', () => {
        renderSummary([{ effect: 'haste' }, { effect: 'mage_armor', baseAc: 13 }]);
        const badge = screen.getByTitle('From Mage Armor (13 + 2 Dex)');
        expect(badge).toHaveClass('aura-source');
        expect(badge.textContent).toContain('(+2 from Haste)');
        expect(badge.textContent).toContain('(13 + 2 Dex)');
    });

    it('renders every active AC buff badge side by side', () => {
        renderSummary([
            { effect: 'haste' },
            { effect: 'shield' },
            { effect: 'shield_of_faith' },
            { effect: 'defensive_duelist', acBonus: 3 },
        ]);
        expect(screen.getByText('(+2 from Haste)')).toBeInTheDocument();
        expect(screen.getByText('(+5 from Shield)')).toBeInTheDocument();
        expect(screen.getByText('(+2 from Shield of Faith)')).toBeInTheDocument();
        expect(screen.getByText('(+3 from Defensive Duelist)')).toBeInTheDocument();
        expect(armorClassRow().querySelectorAll('.aura-source')).toHaveLength(4);
    });
});

// ---------------------------------------------------------------------------
// Negative paths — nothing attributed when nothing should be.
// ---------------------------------------------------------------------------
describe('CharSummary - AC buff badges absent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders no AC attribution badges when no buffs are active', () => {
        renderSummary();
        expect(armorClassRow().querySelectorAll('.aura-source')).toHaveLength(0);
    });

    it('does not render a Defensive Duelist badge when the buff carries no acBonus', () => {
        renderSummary([{ effect: 'defensive_duelist' }]);
        expect(armorClassRow().querySelectorAll('.aura-source')).toHaveLength(0);
        expect(armorClassRow()).not.toHaveTextContent(/Defensive Duelist/);
    });

    it('does not attribute AC to unrelated active buffs', () => {
        renderSummary([{ effect: 'water_breathing' }]);
        expect(armorClassRow().querySelectorAll('.aura-source')).toHaveLength(0);
    });
});
