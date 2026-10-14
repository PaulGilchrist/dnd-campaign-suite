// @improved-by-ai
//
// CharSummary-FixtureContract — render-lane counterpart of the contract suite
// embedded in CharSummary.test-mocks.test.jsx. That fixture module must stay
// free of vi.mock (consumers import it), so the render-level pins for the
// shared fixture live here with the standard family mock harness.
//
// Owned here (fixture-validity via full <CharSummary> render):
//   - The untouched mockPlayerStats drives a clean default render — name,
//     descriptor grammar, AC row, Speed row, proficiency/initiative rows,
//     empty stat lists absent, all toggle badges off. Consumers that render
//     the fixture unchanged hardcode this baseline.
//   - The XP milestone checkbox mutates the PASSED-OBJECT in place
//     (handleXpModeToggle): consumers must hand in a spread copy
//     (CharSummary-XPModes.test.jsx relies on this property).
//
// NOT owned here (delegated):
//   - Calc lane + shape guards ......... CharSummary.test-mocks.test.jsx
//   - Exhaustion/condition/fly speed ... CharSummary-SpeedCalculations.test.jsx
//   - XP modal math, mode toggles ...... CharSummary-XPModes.test.jsx
//   - AC totals & badge noise .......... CharSummary-BadgesAndAC.test.jsx

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
// that renders mockPlayerStats unchanged relies on this baseline.
// ---------------------------------------------------------------------------
describe('untouched fixture renders the default sheet', () => {
    it('renders the name header from the fixture identity', () => {
        renderFixture();
        expect(screen.getByText(mockPlayerStats.name)).toBeInTheDocument();
    });

    it('renders the descriptor line exactly as the production grammar composes the fixture fields', () => {
        renderFixture();
        expect(screen.getByTestId('char-summary-text')).toHaveTextContent(
            `${mockPlayerStats.race.subrace.name} (${mockPlayerStats.race.type.toLowerCase()}), ` +
            `${mockPlayerStats.class.name} (${mockPlayerStats.class.subclass.name.toLowerCase()}-${mockPlayerStats.class.subclass.type.toLowerCase()}), ` +
            `Level ${mockPlayerStats.level} ${XP_SUFFIX}, ${mockPlayerStats.alignment}`
        );
    });

    it('shows AC as exactly the fixture armorClass — no buff/penalty noise renders on the default fixture', () => {
        renderFixture();
        expect(armorClassLine().textContent.replace(/\s+/g, ' ').trim())
            .toBe(`Armor Class: ${mockPlayerStats.armorClass}`);
    });

    it('renders the baseline Speed span from race.subrace.speed (no suffix noise)', () => {
        renderFixture();
        expect(speedSpan().textContent).toBe(`${BASE_SPEED} ft.`);
    });

    it('shows the proficiency and initiative rows from the fixture values', () => {
        renderFixture();
        expect(screen.getByText(/^Proficiency:/).parentElement)
            .toHaveTextContent(`+${mockPlayerStats.proficiency}`);
        expect(screen.getByText(/^Initiative:/).parentElement.textContent)
            .toContain(String(mockPlayerStats.initiative));
    });

    it.each(['Vulnerabilities:', 'Senses:', 'Proficiencies:', 'Languages:', 'Resistances:', 'Immunities:'])(
        'omits the %s row — the fixture list is empty and consumers assert on its absence', (label) => {
            renderFixture();
            expect(screen.queryByText(label)).not.toBeInTheDocument();
        });

    it.each(['Wild Shape', 'Majesty', 'Wrath of the Sea', 'Starry Form'])(
        'renders no %s badge with default all-off flags', (badge) => {
            renderFixture();
            expect(screen.queryByText(new RegExp(badge))).not.toBeInTheDocument();
        });
});

// ---------------------------------------------------------------------------
// XP-mode mutation isolation — CharSummary mutates playerStats.xpMode in
// place, so passing the shared fixture directly would poison it for every
// later test in the file. Consumers (CharSummary-XPModes) spread a fresh
// copy; this pin fails loudly if that ever regresses.
// ---------------------------------------------------------------------------
describe('milestone checkbox mutation cannot poison the shared fixture', () => {
    it('flips the spread copy to experience mode and writes the toggle to the store, leaving the fixture milestone', () => {
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
