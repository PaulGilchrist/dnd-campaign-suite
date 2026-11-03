// @maintained-by-ai
//
// CI 2026-11-03 a11y lane: the sheet-summary Allies trigger must be a REAL
// <button> with an accessible name that is keyboard-focusable and Enter-
// actuated (was a bare clickable span). Confirm-persists behavior is pinned
// in CharSummary-Ally-Initiative.test.jsx; modal row checkbox semantics are
// pinned in common/AllySelectionModal.test.jsx — not duplicated here.

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { DiceRollContext } from '../../../hooks/combat/DiceRollContext.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

// ---------------------------------------------------------------------------
// Mocks — same lane set as CharSummary-Ally-Initiative.test.jsx.
// ---------------------------------------------------------------------------
vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hhp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: () => <div data-testid="short-rest-btn">Short Rest</div> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));
vi.mock('./TrackedResourceInput.jsx', () => ({ default: () => <div data-testid="tracked-resource-input">Tracked Resource</div> }));

vi.mock('../../common/AllySelectionModal.jsx', () => ({
    default: vi.fn(() => <div data-testid="ally-selection-modal">Select Allies</div>),
}));

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

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

function renderSummary(props = {}) {
    render(
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                {...props}
            />
        </DiceRollContext.Provider>
    );
}

describe('CharSummary - Allies trigger a11y', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the trigger as a real button with an accessible name', () => {
        renderSummary();

        const trigger = screen.getByRole('button', { name: /Allies \(1\)/ });
        expect(trigger).toHaveAttribute('type', 'button');
        expect(trigger).toHaveAttribute('title', 'Manage allies');
        expect(trigger.tagName).toBe('BUTTON');
    });

    it('is keyboard-focusable', () => {
        renderSummary();

        const trigger = screen.getByRole('button', { name: /Allies \(1\)/ });
        trigger.focus();
        expect(document.activeElement).toBe(trigger);
    });

    it('Enter on the focused trigger opens the AllySelectionModal', async () => {
        const user = userEvent.setup();
        renderSummary();

        expect(screen.queryByTestId('ally-selection-modal')).not.toBeInTheDocument();

        screen.getByRole('button', { name: /Allies \(1\)/ }).focus();
        await user.keyboard('{Enter}');

        expect(screen.getByTestId('ally-selection-modal')).toBeInTheDocument();
    });

    it('mouse click still opens the modal (non-regression)', () => {
        renderSummary();

        fireEvent.click(screen.getByRole('button', { name: /Allies \(1\)/ }));

        expect(screen.getByTestId('ally-selection-modal')).toBeInTheDocument();
    });
});
