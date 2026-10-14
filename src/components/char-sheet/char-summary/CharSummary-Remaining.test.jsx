// @maintained-by-ai
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
// Audit trim (2026-10-14): 4 tests / 221 lines → 3 tests / ~170 lines.
//   - Verified all three tests kill their production lanes (mutation run —
//     flipped the inspiration toggle / removed console.error / reordered
//     setShowAllyModal before the persistence write); nothing was weak.
//   - Inspiration it.each collapsed to ONE test: the toggle is a single
//     `!hasInspiration` lane, so the false→true arm is fully behavioral and
//     the true→false arm only duplicated it through the mock-echo rerender
//     (which proves a mock, not production).
//   - Ally suite: the never-settling-log test collapsed into the rejecting-log
//     test — synchronously-closed-modal + persisted-allies are already asserted
//     there before the rejection settles; an unhandled non-settling promise
//     was the only (marginal) extra signal.
//   - AllySelectionModal mock is now conditional: the never-opened modal renders
//     nothing, so the "modal absent before click" negative is observable against
//     the REAL modal instead of being an assertion about the test's own mock.
//   - Dropped the unobservable "sheet stays mounted" assertion (its assertions
//     live on document.body and survive component unmount) — replaced by the
//     badge count staying pinned at 1 after the failed log.

import { render, screen, fireEvent } from '@testing-library/react';
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

// AllySelectionModal stand-in: renders NOTHING while closed so the
// "absent before the badge click" negative is production behavior, and
// exposes the confirm path with the currentAllies it received.
vi.mock('../../common/AllySelectionModal.jsx', () => ({
    default: ({ currentAllies, onConfirm }) => (
        <div data-testid="ally-selection-modal">
            Select Allies
            <button data-testid="ally-confirm" onClick={() => onConfirm(currentAllies)}>Confirm</button>
        </div>
    ),
}));

// Tracked-resource hook: tests pin the reported value per-case.
vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(() => ({ current: false, update: vi.fn() })),
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
// Inspiration toggle — clicking the checkbox pushes the toggled value to the
// tracked resource exactly once (the checkbox's checked state is production
// markup bound to the same `hasInspiration` value).
// ---------------------------------------------------------------------------
describe('CharSummary - Inspiration Toggle', () => {
    it('clicking the inspiration checkbox updates the tracked resource to the toggled value', () => {
        const update = vi.fn();
        vi.mocked(useTrackedResource).mockReturnValue({ current: false, update });
        renderSummary();

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox.checked).toBe(false);

        fireEvent.click(checkbox);

        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith(true);
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

    it('closes the modal and persists allies before the log rejection settles, forwarding the exact error to console.error', async () => {
        const logError = new Error('log failed');
        addEntry.mockRejectedValue(logError);
        renderSummary();

        // Modal is not mounted until the allies badge is clicked.
        expect(screen.queryByTestId('ally-selection-modal')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText(/Allies \(1\)/));
        expect(screen.getByTestId('ally-selection-modal')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('ally-confirm'));

        // Modal close + ally persistence are synchronous — neither waits on
        // (nor is blocked by) the campaign log.
        expect(screen.queryByTestId('ally-selection-modal')).not.toBeInTheDocument();
        expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerStats.name, 'selectedAllies', [mockPlayerStats.name], mockCampaignName);
        // The badge reflects the persisted selection, not just the write call.
        expect(screen.getByText(/Allies \(1\)/)).toBeInTheDocument();

        // The exact Error instance is reported verbatim once the log rejects.
        await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledWith('[CharSummary] Error logging ally selection:', logError), { timeout: 2000 });
    });
});
