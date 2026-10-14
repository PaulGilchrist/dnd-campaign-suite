// @improved-by-ai
//
// Coverage ownership (CharSummary family delegation): popup CLICK wiring —
// user clicks in the summary that open detail popups. OWNED HERE (unique):
//   - Background span click → showBackgroundPopup(name, setPopupHtml, rules),
//     incl. the `rules || '5e'` fallback and '2024' passthrough (it.each).
//   - Armor Class row click → setPopupHtml with the exact
//     "Armor Class (<base>) = <formula>" string (showArmorClassFormulaPopup —
//     verified nowhere else in the family; BadgesAndAC owns only the AC number).
//
// NOT owned here (delegated — do not re-add):
//   - Background row presence/negatives, subtitle, stat list rows → CharSummary-Display.test.jsx
//   - Feat popup content (prereqs/benefits/desc formats) → CharSummary-Prerequisites.test.jsx
//   - AC totals & penalty badge arithmetic → CharSummary-BadgesAndAC.test.jsx
//   - Inspiration toggle → CharSummary-Remaining.test.jsx
//   - Ally modal confirm/cancel, short-rest button, window events
//     → CharSummary-Ally-Initiative / -Prerequisites / -EventHandlers.test.jsx
//
// Improvements (2026-10-14): 1 test → 4 runs
//   - Unmocked DiceRollContext (trivial React context — Prerequisites/
//     Ally-Initiative precedent): tests render through the real Provider with a
//     setPopupHtml spy, so the popup callback is proven wired through real
//     context plumbing. Deleted the module-level `let setPopupHtml` +
//     mockImplementation-in-beforeEach dance.
//   - Removed the window.location.defineProperty fiddle — vitest jsdom runs at
//     http://localhost/ (vitest.config.js), so isLocalhost was already true.
//   - Import shared mockPlayerStats/mockCampaignName (dropped ~30-line local dup).
//   - fireEvent.click replaces raw element.click(); added toHaveBeenCalledTimes(1)
//     so double-fire regressions fail.
//   - Added rules default/pass-through cases — the `playerStats.rules || '5e'`
//     fallback at CharSummary.jsx:456 had zero coverage before.
//   - Added AC formula popup click (unowned family gap): pins the verbatim
//     popup string, incl. that it reports the BASE AC, not the modified total.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { DiceRollContext } from '../../../hooks/combat/DiceRollContext.js';
import { showBackgroundPopup } from '../../../hooks/combat/useActionPopup.js';
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

beforeEach(() => {
    vi.clearAllMocks();
    getActiveBuffs.mockReturnValue([]);
});

// Render through the REAL DiceRollContext.Provider so the setPopupHtml spy
// flows to the component exactly as it does in the app. Returns the spy.
function renderSummary(statsOverride = {}) {
    const setPopupHtml = vi.fn();
    render(
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml }}>
            <CharSummary
                playerStats={{ ...mockPlayerStats, ...statsOverride }}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
            />
        </DiceRollContext.Provider>
    );
    return setPopupHtml;
}

// ---------------------------------------------------------------------------
// Background popup — clicking the background name opens its popup with the
// character's ruleset (defaults to 5e when unset).
// ---------------------------------------------------------------------------
describe('CharSummary - Background Popup', () => {
    it.each([
        ['5e rules are passed through', { rules: '5e' }, '5e'],
        ['2024 rules are passed through', { rules: '2024' }, '2024'],
        ['rules default to 5e when absent', { rules: undefined }, '5e'],
    ])('%s', (_case, statsOverride, expectedRules) => {
        const setPopupHtml = renderSummary({ ...statsOverride, background: 'Soldier' });

        fireEvent.click(screen.getByText('Soldier'));

        expect(showBackgroundPopup).toHaveBeenCalledTimes(1);
        // The popup callback handed to showBackgroundPopup must be the very
        // setPopupHtml from the surrounding context, not a stale/no-op copy.
        expect(showBackgroundPopup).toHaveBeenCalledWith('Soldier', setPopupHtml, expectedRules);
    });
});

// ---------------------------------------------------------------------------
// Armor Class formula popup — clicking the AC row shows the base-AC formula.
// ---------------------------------------------------------------------------
describe('CharSummary - Armor Class Formula Popup', () => {
    it('opens the popup with the exact base-AC formula when the Armor Class row is clicked', () => {
        const setPopupHtml = renderSummary({
            armorClass: 18,
            armorClassFormula: '16 + 2 (shield)',
        });

        fireEvent.click(screen.getByText('Armor Class:'));

        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        expect(setPopupHtml).toHaveBeenCalledWith('Armor Class (18) = 16 + 2 (shield)');
    });
});
