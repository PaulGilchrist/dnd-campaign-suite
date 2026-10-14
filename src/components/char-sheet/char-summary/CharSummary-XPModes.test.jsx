// @improved-by-ai
//
// CharSummary XP modes + Bait and Switch AC badge.
//
// Coverage ownership (CharSummary family delegation):
//   OWNED HERE (unique behavioral coverage — no sibling covers these):
//   - XP modal open → preview calculation (positive / negative / clamped /
//     non-numeric deltas)
//   - XP modal Apply → displayed XP updates, clamped to 0, and the write
//     reaches the runtime store (server-first: other players see it)
//   - XP modal Apply-with-empty-delta and Cancel → modal closes, XP and
//     runtime store untouched
//   - Milestone checkbox → subtitle switches between "(N XP)" and
//     "(milestone)", persisted via the runtime store
//   - Bait and Switch AC badge rendering and its contribution to the AC total
//
// NOT owned here (delegated — do not re-add):
//   - XP subtitle rerender on playerStats.xp prop change, window events
//     → CharSummary-EventHandlers.test.jsx
//   - "(milestone)" subtitle row content → CharSummary-Display.test.jsx
//   - Other AC badges / AC totals → CharSummary-BadgesAndAC.test.jsx
//   - Surge badges → CharSummary-WildMagic.test.jsx
//
// Notes on what used to live here and stays removed:
//   - displayXp useState sync and "hides/shows info text" tests — React
//     internals trivia, zero business-logic value.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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
// Helpers
// ---------------------------------------------------------------------------

// XP-mode fixture with a fresh per-test object (the milestone toggle mutates
// playerStats.xpMode in place, so the shared mock must never be handed in).
const xpStats = (xp = 2300) => ({ ...mockPlayerStats, xp, xpMode: 'experience' });

function renderSummary(stats) {
    return render(
        <CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />
    );
}

// Opens the XP modal via the clickable XP suffix in the subtitle and
// returns the delta input (role: spinbutton, labelled "Add or subtract XP:").
function openXpModal(stats = xpStats()) {
    renderSummary(stats);
    const suffix = stats.xpMode === 'experience' ? /\d XP\)/ : /\(milestone\)/;
    fireEvent.click(screen.getByText(suffix));
    return screen.getByRole('spinbutton', { name: /add or subtract xp/i });
}

function typeDelta(input, value) {
    fireEvent.change(input, { target: { value } });
}

function clickButton(name) {
    fireEvent.click(screen.getByRole('button', { name }));
}

const armorClassLine = () => screen.getByText('Armor Class:', { selector: 'b' }).parentElement;

// ---------------------------------------------------------------------------
// Setup — pin hostname; all runtime reads default to null
// ---------------------------------------------------------------------------
beforeEach(() => {
    vi.clearAllMocks();
    window.location.hostname = 'localhost';
    getActiveBuffs.mockReturnValue([]);
    vi.mocked(useRuntimeValue).mockReturnValue(null);
    vi.mocked(getRuntimeValue).mockReturnValue(null);
});

afterEach(() => {
    window.location.hostname = 'localhost';
});

// ---------------------------------------------------------------------------
// XP Modal — open, preview, apply, cancel, mode toggle
// ---------------------------------------------------------------------------
describe('XP Modal', () => {
    it('opens from the clickable XP suffix showing the current XP with no preview yet', () => {
        openXpModal(xpStats());
        expect(screen.getByText('Current: 2,300 XP')).toBeInTheDocument();
        expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    });

    it.each([
        { label: 'positive', delta: '100', expected: '→ 2,400 XP' },
        { label: 'negative', delta: '-50', expected: '→ 2,250 XP' },
        { label: 'clamped to zero', delta: '-999', xp: 10, expected: '→ 0 XP' },
    ])('previews the new total for a $label delta', ({ delta, xp, expected }) => {
        const input = openXpModal(xpStats(xp));
        typeDelta(input, delta);
        expect(screen.getByText(expected)).toBeVisible();
    });

    // jsdom sanitizes a type=number input to '' when a non-numeric value is
    // set, so both entry states must keep the preview arrow hidden.
    it.each([
        { label: 'non-numeric', delta: 'abc' },
        { label: 'empty', delta: '' },
    ])('hides the preview arrow when the delta is $label', ({ delta }) => {
        const input = openXpModal(xpStats());
        typeDelta(input, '+100');
        typeDelta(input, delta);
        expect(screen.getByText('Current: 2,300 XP')).toBeInTheDocument();
        expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    });

    it.each([
        { delta: '100', expected: 2400 },
        { delta: '-250', expected: 2050 },
        { delta: '-99999', expected: 0 },
    ])('apply of delta $delta updates the displayed XP and persists the clamped total', ({ delta, expected }) => {
        const input = openXpModal(xpStats());
        typeDelta(input, delta);
        clickButton('Apply');

        expect(screen.getByText(`(${expected.toLocaleString()} XP)`)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        // Server-first: the persisted write is the cross-player behavior.
        expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'xp', expected, mockCampaignName);
    });

    it.each([
        { label: 'applying with an empty delta', action: () => clickButton('Apply') },
        { label: 'cancelling', action: () => clickButton('Cancel') },
    ])('leaves XP and the runtime store untouched when $label', ({ action }) => {
        openXpModal(xpStats());
        action();

        expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
        expect(screen.getByText('(2,300 XP)')).toBeInTheDocument();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Thorin', 'xp', expect.anything(), mockCampaignName);
    });

    it.each([
        { from: 'experience', to: 'milestone', suffix: '(milestone)' },
        { from: 'milestone', to: 'experience', suffix: '(2,300 XP)' },
    ])('toggling the Milestone checkbox switches the subtitle to $suffix and persists the mode', ({ from, to, suffix }) => {
        openXpModal({ ...mockPlayerStats, xpMode: from });
        fireEvent.click(screen.getByRole('checkbox', { name: /milestone leveling/i }));

        expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
        expect(screen.getByText(suffix)).toBeInTheDocument();
        expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'xpMode', to, mockCampaignName);
    });
});

// ---------------------------------------------------------------------------
// Bait and Switch AC badge — sourced from runtime values (charSummaryCalc
// reads them through the mocked getRuntimeValue)
// ---------------------------------------------------------------------------
describe('Bait and Switch AC bonus display', () => {
    it.each([
        { bonus: 3, source: 'Bait and Switch', ac: 21 },
        { bonus: 5, source: 'Trickster', ac: 23 },
        // No stored source → badge falls back to the generic label.
        { bonus: 2, source: null, ac: 20 },
    ])('adds +$bonus to AC attributing to $source', ({ bonus, source, ac }) => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
            if (key === 'baitAndSwitchActive') return true;
            if (key === 'baitAndSwitchBonus') return bonus;
            if (key === 'baitAndSwitchSource') return source;
            return null;
        });
        renderSummary(mockPlayerStats);

        const acLine = armorClassLine();
        expect(screen.getByText(new RegExp(`\\+${bonus} from ${source || 'Bait and Switch'}`))).toBeVisible();
        // The badge is not decorative — the bonus is included in the AC total.
        expect(acLine).toHaveTextContent(`Armor Class: ${ac}`);
    });

    it.each([
        { label: 'inactive', active: false, bonus: 3 },
        { label: 'active but no bonus stored', active: true, bonus: 0 },
    ])('shows no badge when bait and switch is $label', ({ active, bonus }) => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
            if (key === 'baitAndSwitchActive') return active;
            if (key === 'baitAndSwitchBonus') return bonus;
            return null;
        });
        renderSummary(mockPlayerStats);

        expect(screen.queryByText(/from Bait and Switch/)).not.toBeInTheDocument();
        expect(armorClassLine()).toHaveTextContent('Armor Class: 18');
    });
});
