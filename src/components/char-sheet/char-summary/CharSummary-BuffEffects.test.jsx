// @maintained-by-ai
//
// Coverage ownership (per family delegation): AC buff ATTRIBUTION BADGES —
// the text, .aura-source marker, and tooltip of each buff-driven indicator in
// the Armor Class row (CharSummary.jsx AC_BADGE_SPECS).
//
// NOT owned here (delegated — do not re-add):
//   - AC total NUMBER arithmetic → CharSummary-BadgesAndAC.test.jsx
//   - Un-buffed baseline AC row text → CharSummary-FixtureContract.test.jsx
//   - Cover badges → CharSummary-Cover.test.jsx
//   - Bait and Switch badge → CharSummary-XPModes.test.jsx
//   - Aura resistance asterisk markers → CharSummary-AuraAndInitiative.test.jsx
//   - Resistance rows from buffs → CharSummary-BuffResistances.test.jsx
//
// Every positive case pins the full attribution contract of one AC_BADGE_SPECS
// entry: exact text, .aura-source class, containment in the Armor Class row,
// and tooltip presence/absence (the tooltip is the whole point of the
// indicator — "which buff raised my AC?" — and a wrong or fabricated tooltip
// is an attribution bug). Multi-fragment and multi-badge rendering share one
// render to keep the suite to the minimum confidence-giving runs.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
// renderSummary always pins getActiveBuffs, so no per-suite beforeEach needed.
// mockPlayerStats has Dex +2 (drives the mage-armor formula text).
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
// Positive paths — attribution badges in the Armor Class row.
// ---------------------------------------------------------------------------
describe('CharSummary - AC buff attribution badges', () => {
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
        expect(armorClassRow()).toContainElement(badge);
        expect(badge).toHaveClass('aura-source');
        if (expectedTitle) {
            expect(badge).toHaveAttribute('title', expectedTitle);
        } else {
            // The bare haste span must not carry a fabricated attribution tooltip.
            expect(badge).not.toHaveAttribute('title');
        }
    });

    it('renders every active AC buff badge side by side, folding Haste into the Mage Armor span', () => {
        renderSummary([
            { effect: 'haste' },
            { effect: 'mage_armor', baseAc: 13 },
            { effect: 'shield' },
            { effect: 'shield_of_faith' },
            { effect: 'defensive_duelist', acBonus: 3 },
        ]);
        // Haste + Mage Armor share one span (the union branch of the
        // haste-mage-armor spec), attributed via the Mage Armor tooltip.
        const combined = screen.getByTitle('From Mage Armor (13 + 2 Dex)');
        expect(combined).toHaveClass('aura-source');
        expect(combined.textContent).toContain('(+2 from Haste)');
        expect(combined.textContent).toContain('(13 + 2 Dex)');
        // The remaining buffs keep their own badges — none suppresses another.
        for (const text of ['(+5 from Shield)', '(+2 from Shield of Faith)', '(+3 from Defensive Duelist)']) {
            expect(armorClassRow()).toContainElement(screen.getByText(text));
        }
        expect(armorClassRow().querySelectorAll('.aura-source')).toHaveLength(4);
    });
});

// ---------------------------------------------------------------------------
// Negative paths — nothing attributed when nothing should be.
// ---------------------------------------------------------------------------
describe('CharSummary - AC buff badges absent', () => {
    it.each([
        { name: 'no buffs are active', buffs: [] },
        { name: 'the Defensive Duelist buff carries no acBonus (guard must not fabricate +0)', buffs: [{ effect: 'defensive_duelist' }] },
        { name: 'an unrelated buff is active', buffs: [{ effect: 'water_breathing' }] },
    ])('renders no attribution badge in the AC row when $name', ({ buffs }) => {
        renderSummary(buffs);
        expect(armorClassRow().querySelectorAll('.aura-source')).toHaveLength(0);
        expect(armorClassRow()).not.toHaveTextContent(/\(.*from .*\)/i);
    });
});
