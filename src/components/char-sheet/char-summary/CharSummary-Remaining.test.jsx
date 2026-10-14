// @improved-by-ai
//
// Coverage ownership (CharSummary family delegation):
//   OWNED HERE (per sibling delegation comments):
//   - Inspiration toggle: the checkbox display is bound to the tracked
//     resource and each click updates it with the toggled value.
//   - Ally modal confirm ERROR path (delegated here by CharSummary-Prerequisites
//     and CharSummary-Ally-Initiative): console.error verbatim forwarding,
//     persistence despite a failed/hung campaign log, modal closes regardless.
//
// NOT owned here (delegated — do not re-add):
//   - Ally modal data source + happy-path confirm → CharSummary-Ally-Initiative.test.jsx
//   - Ally modal cancel → CharSummary-Prerequisites.test.jsx
//   - 'open-short-rest' window event → CharSummary-EventHandlers.test.jsx
//   - Background popup → CharSummary-UI-Interactions.test.jsx
//
// Improvements (2026-10-14):
//   - Deleted both window.location hostname fiddles (~40 lines): vitest's jsdom
//     is configured with url http://localhost/, so isLocalhost was already true —
//     the defineProperty save/restore machinery was pure noise.
//   - Imports shared mockPlayerStats/mockCampaignName from
//     CharSummary.test-mocks.test.jsx instead of duplicating the fixture.
//   - Inspiration tests now prove the checkbox DISPLAY follows the tracked
//     resource (rerender with the new value → checked flips), not just that
//     update was called; added toHaveBeenCalledTimes(1) so double-fire bugs
//     fail. Dropped the assertion on the test's own mock-captured variable
//     (tautological — it only re-checked the update spy argument).
//   - Ally error test: console.error spy installed BEFORE the confirm click
//     and asserts the exact Error instance is forwarded verbatim (was
//     expect.any(Error)). Also asserts allies are still persisted via
//     setRuntimeValue despite the log failure, and the sheet stays mounted.
//   - Replaced the fragile single `await Promise.resolve()` microtask flush
//     (and its inaccurate "flushMicrotasks() helper" comment) with waitFor.
//   - Added a never-settling addEntry test: a hung log request must still not
//     trap the modal or block persistence (modal close is synchronous by
//     design — setShowAllyModal(false) fires before the await).
//   - Added negative path: modal absent before the allies badge is clicked.
//
// Before: 3 tests / 207 lines
// After:  4 tests / ~190 lines

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { addEntry } from '../../../services/ui/logService.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';
import useTrackedResource from '../../../hooks/runtime/useTrackedResource.js';

// ---------------------------------------------------------------------------
// Mocks — only what the inspiration-toggle and ally-confirm lanes touch,
// plus heavy children stubbed to keep the render inert.
// ---------------------------------------------------------------------------
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

// AllySelectionModal stand-in: exposes the two confirm paths (with the
// currentAllies it received) and cancel.
vi.mock('../../common/AllySelectionModal.jsx', () => ({
    default: ({ onConfirm, onCancel, currentAllies }) => (
        <div data-testid="ally-selection-modal">
            Select Allies
            <button data-testid="ally-confirm" onClick={() => onConfirm(currentAllies)}>Confirm</button>
            <button data-testid="ally-cancel" onClick={onCancel}>Cancel</button>
        </div>
    ),
}));

// Tracked-resource hook: default off (inspiration); tests override per-case.
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

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    default: {
        getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
    },
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

beforeEach(() => {
    vi.clearAllMocks();
});

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

// ---------------------------------------------------------------------------
// Inspiration toggle — display follows the tracked resource; one update per
// click with the toggled value.
// ---------------------------------------------------------------------------
describe('CharSummary - Inspiration Toggle', () => {
    it.each`
        startingValue | expectedAfterToggle
        ${false}      | ${true}
        ${true}       | ${false}
    `('checkbox shows $startingValue and one click updates the tracked resource to $expectedAfterToggle', ({ startingValue, expectedAfterToggle }) => {
        const update = vi.fn();
        vi.mocked(useTrackedResource).mockReturnValue({ current: startingValue, update });
        const { rerender } = renderSummary();

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox.checked).toBe(startingValue);

        fireEvent.click(checkbox);

        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith(expectedAfterToggle);

        // Display is driven by the tracked resource, not local state:
        // once the hook reports the toggled value, the checkbox reflects it.
        vi.mocked(useTrackedResource).mockReturnValue({ current: expectedAfterToggle, update });
        rerender(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByRole('checkbox').checked).toBe(expectedAfterToggle);
    });
});

// ---------------------------------------------------------------------------
// Ally modal confirm — error path. Data source and happy-path confirm live in
// CharSummary-Ally-Initiative; cancel lives in CharSummary-Prerequisites.
// ---------------------------------------------------------------------------
describe('CharSummary - Ally Modal Confirm Error Path', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    function openModalAndConfirm() {
        expect(screen.queryByTestId('ally-selection-modal')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText(/Allies \(1\)/));
        expect(screen.getByTestId('ally-selection-modal')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('ally-confirm'));
    }

    it('forwards the rejection to console.error verbatim while still persisting allies and closing the modal', async () => {
        const logError = new Error('log failed');
        addEntry.mockRejectedValue(logError);
        renderSummary();

        openModalAndConfirm();

        // Modal closes synchronously — before the log promise settles.
        expect(screen.queryByTestId('ally-selection-modal')).not.toBeInTheDocument();
        // A failed log must not block ally persistence.
        expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerStats.name, 'selectedAllies', [mockPlayerStats.name], mockCampaignName);
        // The exact Error instance is reported verbatim.
        await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledWith('[CharSummary] Error logging ally selection:', logError));
        // The sheet survives the failed log.
        expect(screen.getByText(mockPlayerStats.name)).toBeInTheDocument();
    });

    it('closes the modal and persists allies even when the campaign log never settles', () => {
        addEntry.mockReturnValue(new Promise(() => {}));
        renderSummary();

        openModalAndConfirm();

        expect(screen.queryByTestId('ally-selection-modal')).not.toBeInTheDocument();
        expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerStats.name, 'selectedAllies', [mockPlayerStats.name], mockCampaignName);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
});
