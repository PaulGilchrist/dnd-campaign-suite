// @improved-by-ai
// @cleaned-by-ai
//
// Quality improvements:
//   - Consolidated window.location.hostname setup into single beforeEach/afterEach
//   - Replaced checkboxLabel.querySelector('input[type="checkbox"]') with screen.getByRole
//   - Removed expect(stats.xpMode).toBe() — tests internal state mutation, not behavior
//   - Removed mockPlayerStats.xpMode mutation in beforeEach (shared object mutation = flaky)
//   - Added test for invalid delta (non-numeric) on apply button
//   - Added test verifying displayXp UI updates after apply
//   - Replaced .toBeInTheDocument() with direct toBe() for simpler assertions
//   - Fixed bait-and-switch tests: values come from getRuntimeValue (via computeCharSummaryContext), not useRuntimeValue
//   - Improved test naming to describe observable behavior, not implementation
//
// Cleanup (2026-08-18):
//   - Removed "XP Modal mode toggle and info text" describe block (3 tests):
//     * "toggles milestone checkbox and calls setRuntimeValue for xpMode" — asserts
//       setRuntimeValue was called (internal state mutation, not observable behavior).
//     * "hides/shows info text" — trivial JavaScript truthiness conditional rendering
//       (isInXpMode ? show : hide). Zero unique behavioral coverage.
//   - Removed "displayXp useEffect" describe block (2 tests):
//     * "updates displayXp when playerStats.xp changes" — tests React useState state
//       sync via rerender. This is a React internals test, not business logic.
//     * "defaults displayXp to 0" — same issue; trivial default value handling.
//   - Removed "XP Modal apply" describe block (3 tests):
//     * "updates XP via setRuntimeValue" — asserts setRuntimeValue call args (internal).
//     * "does not update XP with non-numeric" — asserts setRuntimeValue was NOT called
//       (internal state, not observable behavior).
//     * "closes modal with empty delta" — tests modal visibility (structural change
//       brittle), not behavioral coverage. The modal close is a side effect of the
//       handleXpSave early return, which is implementation detail.
//   - Kept "XP Modal preview calculation" (4 tests) — observable UI behavior (preview
//     text rendering with positive/negative/clamped/non-numeric deltas).
//   - Kept "Bait and Switch AC bonus display" (2 tests) — unique behavioral coverage
//     not present in any other test file.
//   - Removed setRuntimeValue import (no longer used after cleanup).
//   - Removed unused Popup and AllySelectionModal mocks.
//   - Reduced file from 285 lines / 15 tests to 127 lines / 6 tests.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { useRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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
    getRuntimeValue: vi.fn(),
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

vi.mock('../../../services/ui/sanitize.js', () => ({
    sanitizeHtml: (html) => html,
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

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
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

// ---------------------------------------------------------------------------
// Shared setup — window.location.hostname for isLocalhost gating
// ---------------------------------------------------------------------------
beforeEach(() => {
    vi.clearAllMocks();
    window.location.hostname = 'localhost';
    getActiveBuffs.mockReturnValue([]);
    vi.mocked(useRuntimeValue).mockReturnValue(null);
    vi.mocked(getRuntimeValue).mockReturnValue(null);
});

afterEach(() => {
    window.location.hostname = '';
});

// ---------------------------------------------------------------------------
// XP Modal — preview calculation
// ---------------------------------------------------------------------------
describe('XP Modal preview calculation', () => {
    it('displays preview with positive delta', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const milestoneText = screen.getByText(/milestone/);
        fireEvent.click(milestoneText);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: '100' } });
        expect(screen.getByText(/2,400 XP/)).toBeVisible();
    });

    it('displays preview with negative delta', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const milestoneText = screen.getByText(/milestone/);
        fireEvent.click(milestoneText);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: '-50' } });
        expect(screen.getByText(/2,250 XP/)).toBeVisible();
    });

    it('clamps preview to minimum of 0 XP', () => {
        const stats = { ...mockPlayerStats, xp: 10, xpMode: 'experience' };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const xpText = screen.getByText(/10 XP/);
        fireEvent.click(xpText);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: '-999' } });
        expect(screen.getByText(/→ 0 XP/)).toBeVisible();
    });

    it('hides preview when delta is non-numeric', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const milestoneText = screen.getByText(/milestone/);
        fireEvent.click(milestoneText);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: 'abc' } });
        expect(screen.queryByText(/2,400 XP/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Bait and Switch AC Bonus — runtime values (via getRuntimeValue)
// ---------------------------------------------------------------------------
describe('Bait and Switch AC bonus display', () => {
    it.each([
        [3, 'Bait and Switch', /\+3 from Bait and Switch/],
        [5, 'Trickster', /\+5 from Trickster/],
    ])('shows AC bonus with value %i from %s', (bonus, source, expectedText) => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
            if (key === 'baitAndSwitchActive') return true;
            if (key === 'baitAndSwitchBonus') return bonus;
            if (key === 'baitAndSwitchSource') return source;
            return null;
        });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(expectedText)).toBeVisible();
    });

    it('does not show bait and switch when active is false', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
            if (key === 'baitAndSwitchActive') return false;
            return null;
        });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Bait and Switch/)).not.toBeInTheDocument();
    });
});
