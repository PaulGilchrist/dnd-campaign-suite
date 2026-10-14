// @maintained-by-ai
//
// CharSummary-FixtureContract — render-lane counterpart of the contract suite
// embedded in CharSummary.test-mocks.test.jsx. That fixture module must stay
// free of vi.mock (consumers import it), so the render-level pins for the
// shared fixture live here with the standard family mock harness.
//
// Owned here (fixture-validity via full <CharSummary> render):
//   - The untouched mockPlayerStats drives one clean default render — descriptor
//     grammar, AC row, Speed row, proficiency/initiative rows all exactly from
//     fixture values; empty stat lists and all-off toggle badges absent.
//     Consumers that render the fixture unchanged hardcode this baseline.
//     (Name header → CharSummary-Display.test.jsx; subtitle fallbacks and
//     null-list guards → same file; both render this same fixture.)
//   - The XP milestone checkbox mutates the PASSED-OBJECT in place
//     (handleXpModeToggle): consumers must hand in a spread copy
//     (CharSummary-XPModes.test.jsx relies on this property — its toggle
//     coverage uses fresh copies, so fixture-poisoning is pinned only here).
//
// NOT owned here (delegated):
//   - Calc lane + shape guards ......... CharSummary.test-mocks.test.jsx
//   - Exhaustion/condition/fly speed ... CharSummary-SpeedCalculations.test.jsx
//   - XP modal math, mode toggles ...... CharSummary-XPModes.test.jsx
//   - AC totals & badge noise .......... CharSummary-BadgesAndAC.test.jsx
//   - Starry Form / Sanctuary badges .. CharSummary-Badges.test.jsx
//   - Vulnerabilities row content ...... CharSummary-OtherEffects.test.jsx

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

// Standard family harness (same set as CharSummary-Movement.test.jsx).
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

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
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

// ---------------------------------------------------------------------------
// Helpers — expected strings are DERIVED from fixture fields (never restated
// literals) so fixture edits flow through, while production grammar drift
// fails loudly.
// ---------------------------------------------------------------------------
const renderFixture = (stats = mockPlayerStats) =>
    render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);

const speedSpan = () => screen.getByText(/^\d+ ft\./);
const armorClassLine = () => screen.getByText(/^Armor Class:/).parentElement;

const BASE_SPEED = mockPlayerStats.race.subrace.speed;
const XP_SUFFIX = mockPlayerStats.xpMode === 'experience'
    ? `(${mockPlayerStats.xp.toLocaleString()} XP)`
    : '(milestone)';

beforeEach(() => {
    vi.clearAllMocks();
    getActiveBuffs.mockReturnValue([]);
});

// ---------------------------------------------------------------------------
// The untouched fixture drives a full, clean default render — every consumer
// that renders mockPlayerStats unchanged relies on this baseline. One render,
// exact-value assertions: any production grammar or default-flag drift fails
// loudly on the named row.
// ---------------------------------------------------------------------------
describe('untouched fixture renders the default sheet', () => {
    it('renders descriptor, AC, Speed, proficiency and initiative rows exactly from the fixture values', () => {
        renderFixture();

        expect(screen.getByTestId('char-summary-text')).toHaveTextContent(
            `${mockPlayerStats.race.subrace.name} (${mockPlayerStats.race.type.toLowerCase()}), ` +
            `${mockPlayerStats.class.name} (${mockPlayerStats.class.subclass.name.toLowerCase()}-${mockPlayerStats.class.subclass.type.toLowerCase()}), ` +
            `Level ${mockPlayerStats.level} ${XP_SUFFIX}, ${mockPlayerStats.alignment}`
        );
        // AC is exactly the fixture armorClass — no buff/penalty noise on the default fixture.
        expect(armorClassLine().textContent.replace(/\s+/g, ' ').trim())
            .toBe(`Armor Class: ${mockPlayerStats.armorClass}`);
        // Baseline Speed span carries no suffix noise (buff/suffix lanes are siblings' own).
        expect(speedSpan().textContent).toBe(`${BASE_SPEED} ft.`);
        // Signed-formatted rows, not substring matches (initiative "+2", not any "2").
        // Proficiency's <b> parent is the whole column, so pin the exact row prefix;
        // Initiative's <b> sits in its own span, so the span text is exact.
        expect(screen.getByText(/^Proficiency:/).parentElement.textContent)
            .toMatch(new RegExp(`^Proficiency:\\s*\\+${mockPlayerStats.proficiency}(?!\\d)`));
        expect(screen.getByText(/^Initiative:/).parentElement.textContent)
            .toBe(`Initiative: +${mockPlayerStats.initiative}`);
    });

    it('omits every empty stat-list row and every all-off toggle badge', () => {
        renderFixture();

        for (const label of ['Vulnerabilities:', 'Senses:', 'Proficiencies:', 'Languages:', 'Resistances:', 'Immunities:']) {
            expect(screen.queryByText(label), `${label} row on an empty fixture list`).not.toBeInTheDocument();
        }
        for (const badge of ['Wild Shape', 'Majesty', 'Wrath of the Sea', 'Starry Form']) {
            expect(screen.queryByText(new RegExp(badge)), `${badge} badge with default off flags`).not.toBeInTheDocument();
        }
    });
});

// ---------------------------------------------------------------------------
// XP-mode mutation isolation — CharSummary mutates playerStats.xpMode in
// place, so passing the shared fixture directly would poison it for every
// later consumer. Consumers (CharSummary-XPModes) spread a fresh copy; this
// pin fails loudly if the mutate-in-place contract ever regresses.
// (Modal math and suffix-switching on toggle → CharSummary-XPModes.)
// ---------------------------------------------------------------------------
describe('milestone checkbox mutation cannot poison the shared fixture', () => {
    it('flips the spread copy in place and writes the mode to the store, leaving the shared fixture at milestone', () => {
        const copy = { ...mockPlayerStats };
        renderFixture(copy);

        fireEvent.click(screen.getByText(XP_SUFFIX));
        expect(screen.getByText(`Current: ${mockPlayerStats.xp.toLocaleString()} XP`)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('checkbox', { name: /milestone leveling/i }));

        expect(copy.xpMode).toBe('experience');
        expect(mockPlayerStats.xpMode).toBe('milestone');
        expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerStats.name, 'xpMode', 'experience', mockCampaignName);
    });
});
