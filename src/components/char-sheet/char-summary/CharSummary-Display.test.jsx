// @maintained-by-ai 2026-11-26
//
// Coverage ownership (CharSummary family delegation):
//   - Character name in the sheet header, and the delete-confirm leaf
//     contract (onDeleteCharacter fires ONLY when window.confirm is
//     accepted). Header action-button presence per origin face is owned by
//     CharSummary.VisitorButtonFace.test.jsx (both loopback spellings +
//     visitor negation) — not restated here. The cross-layer single-dialog
//     count with the REAL useCharacterManagement behind the leaf →
//     CharSummary-DeleteConfirm.test.jsx (fix#36 queue: hook-level guard
//     removed, leaf is sole owner).
//   - Subtitle-row fallbacks (no subrace / no race type / no subclass). The
//     exact full-line grammar of the untouched fixture is pinned (fixture-
//     derived) by CharSummary-FixtureContract.test.jsx; XP/milestone suffix
//     content → CharSummary-XPModes.test.jsx.
//   - One integration pin that CharSummary wires playerStats.imagePath +
//     campaignName + name into the REAL AvatarImage (every other sibling mocks
//     it). The AvatarImage URL-branch matrix (absolute, campaign prefix,
//     http(s) passthrough) and initial-fallback live in
//     src/components/common/AvatarImage.test.jsx — not restated here.
//     Modal open/close flow → CharSummary-Prerequisites.test.jsx.
//   - StatListsBlock row CONTENT: Senses (join + See Invisibility append),
//     Proficiencies (join order with 'N from: X' filter), Languages join.
//     One consolidated guard test proves null/empty sources suppress the
//     Senses/Proficiencies/Languages/Background rows in a single render
//     (tools are suppressed with the row when proficiencies itself is empty).
//     Absence of all empty-list rows on the untouched fixture is pinned by
//     CharSummary-FixtureContract.test.jsx. Vulnerabilities row
//     → CharSummary-OtherEffects.test.jsx.
//   - Background row presence (negatives folded into the consolidated
//     guard test); popup content on click →
//     CharSummary-UI-Interactions.test.jsx.
//   - Short rest button open/close flow is owned by CharSummary-Prerequisites
//     .test.jsx (which also asserts the modal is closed pre-click) — the
//     former "renders without opening" test here was a subset and was removed.
//
//   Trim notes (2026-11-26, 15 runs → 11): the header test's button-presence
//   loop duplicated VisitorButtonFace's GM-face assertions (kept only the
//   name, which FixtureContract delegates here); the five per-row absence
//   tests (senses null, proficiencies null/empty ×2, languages null,
//   background '') share one behavior — "empty optional rows render nothing"
//   — and were consolidated into one render.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

// ---------------------------------------------------------------------------
// Mocks — minimal for this lane. AvatarImage intentionally NOT mocked (this
// file owns the CharSummary→AvatarImage wiring pin); AvatarModal is mocked to
// null so avatar clicks are inert while src construction stays real.
// ---------------------------------------------------------------------------
vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
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

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderSummary(stats = mockPlayerStats, props = {}) {
    render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} {...props} />);
}

// Full text of a "<b>Label: </b>value" row — pins order/separators, not just
// that the value text appears somewhere on the page.
function statRowText(label) {
    return screen.getByText(label).parentElement.textContent;
}

function subtitleText() {
    return screen.getByTestId('char-summary-text').textContent.replace(/\u00a0/g, ' ');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CharSummary - Display', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------
    // Header — name (button faces → VisitorButtonFace; delete-confirm leaf
    // contract stays here per DeleteConfirm's ownership note)
    // -------------------------------------------------------------------
    describe('Header', () => {
        it('renders the character name', () => {
            renderSummary();
            expect(screen.getByText(mockPlayerStats.name)).toBeInTheDocument();
        });

        it.each`
            confirmed | description
            ${true}   | ${'accepted'}
            ${false}  | ${'cancelled'}
        `('deletes the character only when the confirm dialog is $description', ({ confirmed }) => {
            const onDeleteCharacter = vi.fn();
            vi.spyOn(window, 'confirm').mockReturnValue(confirmed);
            renderSummary(mockPlayerStats, { onDeleteCharacter });

            // Accessible-name query doubles as the pin that the Delete button
            // carries its named aria-label (2026-10-28-P canon).
            fireEvent.click(screen.getByRole('button', { name: `Delete "${mockPlayerStats.name}"` }));

            // Named-confirm canon: the dialog must identify WHICH character.
            expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining(mockPlayerStats.name));
            expect(onDeleteCharacter).toHaveBeenCalledTimes(confirmed ? 1 : 0);
            if (confirmed) {
                expect(onDeleteCharacter).toHaveBeenCalledWith(mockPlayerStats.name);
            }
        });
    });

    // -------------------------------------------------------------------
    // Subtitle row — fallback composition when subrace/type/subclass absent
    // (exact full-line grammar of the default fixture → FixtureContract)
    // -------------------------------------------------------------------
    describe('Subtitle', () => {
        it('falls back to the race name and opens no parentheticals when subrace, race type and subclass are absent', () => {
            const stats = {
                ...mockPlayerStats,
                race: { name: 'Elf' },
                class: { name: 'Wizard', subclass: null },
            };
            renderSummary(stats);
            const text = subtitleText();
            expect(text).toContain('Elf, Wizard');
            expect(text).toContain('Level 5');
            expect(text).toContain('Lawful Good');
            // No subclass/race-type parenthetical is OPENED without data to
            // wrap. (The XP levelSuffix may legitimately add "(milestone)" —
            // XPModes owns that content.) Known source defect, reported
            // 2026-11-26: CharSummary.jsx renders the subclass group's
            // closing ')' unconditionally, so a subclass-less character
            // shows a stray ")" — not pinned as expected behavior; these
            // assertions pass before and after that fix.
            expect(text).not.toContain('Wizard (');
            expect(text).not.toContain('Elf (');
            expect(text).not.toContain('()');
            expect(text).not.toContain('Dwarf');
        });
    });

    // -------------------------------------------------------------------
    // Avatar Image — integration wiring of the real AvatarImage
    // (URL branch matrix + initial fallback → common/AvatarImage.test.jsx)
    // -------------------------------------------------------------------
    describe('Avatar Image', () => {
        it('wires name, imagePath and campaignName into a campaign-scoped img', () => {
            const stats = { ...mockPlayerStats, imagePath: '/images/character.png' };
            renderSummary(stats);
            const img = screen.getByRole('img', { name: mockPlayerStats.name });
            // Campaign-scoped prefix + original path (component string-concatenates,
            // so a leading-slash imagePath yields a tolerated extra '/').
            const src = img.getAttribute('src');
            expect(src).toMatch(new RegExp(`^campaigns/${mockCampaignName}/`));
            expect(src).toContain('images/character.png');
        });
    });

    // -------------------------------------------------------------------
    // Stat-list rows — content (Senses join + buff append, Proficiencies
    // join with synthetic-entry filter, Languages join)
    // -------------------------------------------------------------------
    describe('Stat list rows', () => {
        it('renders all senses joined by comma, without See Invisibility when inactive', () => {
            const stats = {
                ...mockPlayerStats,
                senses: [{ name: 'Blindsight', value: '60 ft' }, { name: 'Darkvision', value: '120 ft' }],
            };
            renderSummary(stats);
            const row = statRowText('Senses:');
            expect(row).toBe('Senses: Blindsight 60 ft, Darkvision 120 ft');
            expect(row).not.toContain('See Invisibility');
        });

        it('appends See Invisibility to the senses row while the see_invisibility buff is active', () => {
            getActiveBuffs.mockReturnValue([{ name: 'See Invisibility', effect: 'see_invisibility' }]);
            const stats = { ...mockPlayerStats, senses: [{ name: 'Darkvision', value: '60 ft' }] };
            renderSummary(stats);
            expect(statRowText('Senses:')).toBe('Senses: Darkvision 60 ft, See Invisibility');
        });

        it('joins real proficiencies and tools in order, filtering out synthetic "N from: Source" entries', () => {
            const stats = {
                ...mockPlayerStats,
                proficiencies: ['10 from: Druid', 'Heavy Armor', 'Light Armor'],
                toolProficiencies: ["Blacksmith's Tools", "Thieves' Tools"],
            };
            renderSummary(stats);
            expect(statRowText('Proficiencies:')).toBe("Proficiencies: Heavy Armor, Light Armor, Blacksmith's Tools, Thieves' Tools");
            expect(screen.queryByText(/10 from:/)).not.toBeInTheDocument();
        });

        it('renders all languages joined by comma in order', () => {
            const stats = { ...mockPlayerStats, languages: ['Common', 'Dwarvish', 'Celestial'] };
            renderSummary(stats);
            expect(statRowText('Languages:')).toBe('Languages: Common, Dwarvish, Celestial');
        });

        it('renders the background name in its own row', () => {
            renderSummary();
            expect(statRowText('Background:')).toBe('Background: Soldier');
        });
    });

    // -------------------------------------------------------------------
    // Absence guards — one render, all optional rows fed empty/null data.
    // (Baseline absence on the untouched fixture → FixtureContract; here the
    // explicit null/empty sources: null lists, empty proficiency list even
    // when tools exist, empty-string background.)
    // -------------------------------------------------------------------
    it('renders none of the Senses/Proficiencies/Languages/Background rows when their data is empty or null', () => {
        renderSummary({
            ...mockPlayerStats,
            senses: null,
            proficiencies: [],
            toolProficiencies: ["Thieves' Tools"],
            languages: null,
            background: '',
        });
        for (const label of ['Senses:', 'Proficiencies:', 'Languages:', 'Background:']) {
            expect(screen.queryByText(label)).not.toBeInTheDocument();
        }
        // The tools themselves live inside the Proficiencies row — with the
        // row suppressed they must not leak elsewhere either.
        expect(screen.queryByText(/Thieves' Tools/)).not.toBeInTheDocument();
    });
});
