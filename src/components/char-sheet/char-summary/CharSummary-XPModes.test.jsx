// @maintained-by-ai
//
// CharSummary XP modes + Bait and Switch AC badge.
//
// Coverage ownership (CharSummary family delegation):
//   OWNED HERE (unique behavioral coverage — no sibling covers these):
//   - XP modal preview calculation (hidden until a valid number is typed,
//     positive delta, clamped-to-zero delta)
//   - XP modal Apply → full chain: displayed XP updates, clamped to 0, modal
//     closes, and the write reaches the runtime store (server-first: other
//     players see it)
//   - XP modal Apply-with-empty-delta and Cancel → modal closes, XP and
//     runtime store untouched
//   - Milestone checkbox → subtitle switches between "(N XP)" and
//     "(milestone)", persisted via the runtime store
//   - Bait and Switch AC badge: source attribution, generic-label fallback,
//     active/bonus gating, and its contribution to the AC total
//
// NOT owned here (delegated — do not re-add):
//   - XP modal open via the clickable suffix + "Current:" display and
//     milestone-checkbox mutation isolation of the shared fixture
//     → CharSummary-FixtureContract.test.jsx
//   - XP subtitle rerender on playerStats.xp prop change, window events
//     → CharSummary-EventHandlers.test.jsx
//   - "(milestone)" subtitle row content → CharSummary-Display.test.jsx
//   - Other AC badges / AC totals → CharSummary-BadgesAndAC.test.jsx
//   - Surge badges → CharSummary-WildMagic.test.jsx
//
// Notes on trims (8 tests / 18 runs → 6 tests / 11 runs):
//   - "opens showing current XP" and the 'abc'/empty preview cases were
//     absorbed into one test: jsdom sanitizes type=number to '', so a
//     non-numeric entry, an empty entry, and the pristine open state are the
//     same code path.
//   - Preview and Apply cases were merged into one delta → preview → persist
//     chain per case; only two genuinely distinct branches remain (normal
//     addition, Math.max clamp — the clamp branch must both preview AND
//     persist 0).
//   - The {source: 'Bait and Switch'} badge case was dropped: its rendered
//     text is identical to the null-source fallback, so it proved nothing the
//     fallback case doesn't. 'Trickster' is the only source that can
//     distinguish attribution from fallback.

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
// The spinbutton lookup doubles as the "modal opened" assertion.
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
// XP Modal — preview, apply, cancel, mode toggle
// ---------------------------------------------------------------------------
describe('XP Modal', () => {
    // jsdom sanitizes a type=number input to '' for non-numeric entry, so
    // 'abc' exercises the same "no valid number" path as the pristine open
    // state — both must show the current total with no preview arrow.
    it('shows the current XP with no preview arrow until a valid number is typed', () => {
        const input = openXpModal(xpStats());
        expect(screen.getByText('Current: 2,300 XP')).toBeInTheDocument();
        expect(screen.queryByText(/→/)).not.toBeInTheDocument();

        typeDelta(input, 'abc');
        expect(screen.getByText('Current: 2,300 XP')).toBeInTheDocument();
        expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    });

    it.each([
        { label: 'addition', delta: '100', expected: 2400 },
        { label: 'subtracting below zero', delta: '-2500', expected: 0 },
    ])('previews then applies delta $delta, persisting the $label result', ({ delta, expected }) => {
        const input = openXpModal(xpStats());
        typeDelta(input, delta);
        expect(screen.getByText(`→ ${expected.toLocaleString()} XP`)).toBeVisible();

        clickButton('Apply');
        expect(screen.getByText(`(${expected.toLocaleString()} XP)`)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        // Server-first: the persisted write is the cross-player behavior.
        expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerStats.name, 'xp', expected, mockCampaignName);
    });

    it.each([
        { label: 'applying with an empty delta', action: () => clickButton('Apply') },
        { label: 'cancelling', action: () => clickButton('Cancel') },
    ])('closes without touching XP or the runtime store when $label', ({ action }) => {
        openXpModal(xpStats());
        action();

        expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
        expect(screen.getByText('(2,300 XP)')).toBeInTheDocument();
        expect(setRuntimeValue).not.toHaveBeenCalledWith(mockPlayerStats.name, 'xp', expect.anything(), mockCampaignName);
    });

    it.each([
        { from: 'experience', to: 'milestone', suffix: '(milestone)' },
        { from: 'milestone', to: 'experience', suffix: '(2,300 XP)' },
    ])('toggling the Milestone checkbox switches the subtitle to $suffix and persists the mode', ({ from, to, suffix }) => {
        openXpModal({ ...mockPlayerStats, xpMode: from });
        fireEvent.click(screen.getByRole('checkbox', { name: /milestone leveling/i }));

        expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
        expect(screen.getByText(suffix)).toBeInTheDocument();
        expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerStats.name, 'xpMode', to, mockCampaignName);
    });
});

// ---------------------------------------------------------------------------
// Bait and Switch AC badge — sourced from runtime values (charSummaryCalc
// gates the bonus on active && stored bonus; the badge renders the source
// or falls back to the generic label)
// ---------------------------------------------------------------------------
describe('Bait and Switch AC bonus display', () => {
    it.each([
        // Named source must be attributed verbatim — 'Trickster' is distinct
        // from the fallback label so this proves attribution, not fallback.
        { bonus: 5, source: 'Trickster', label: 'Trickster' },
        // No stored source → badge falls back to the generic label.
        { bonus: 2, source: null, label: 'Bait and Switch' },
    ])('adds +$bonus to AC attributing to $label', ({ bonus, source, label }) => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
            if (key === 'baitAndSwitchActive') return true;
            if (key === 'baitAndSwitchBonus') return bonus;
            if (key === 'baitAndSwitchSource') return source;
            return null;
        });
        renderSummary(mockPlayerStats);

        expect(screen.getByText(new RegExp(`\\+${bonus} from ${label}`))).toBeVisible();
        // The badge is not decorative — the bonus is included in the AC total
        // (base 18 from the shared fixture).
        expect(armorClassLine()).toHaveTextContent(`Armor Class: ${18 + bonus}`);
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
