// @maintained-by-ai
//
// Coverage ownership (CharSummary family delegation):
//   - Character header area: name, header action buttons, and the delete-confirm
//     flow (onDeleteCharacter fires ONLY when window.confirm is accepted) —
//     no sibling touches onDeleteCharacter/window.confirm on CharSummary
//     except CharSummary-DeleteConfirm.test.jsx, which owns the cross-layer
//     single-dialog count with the REAL useCharacterManagement behind the
//     leaf (fix#36 queue: hook-level guard removed, leaf is sole owner).
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
//   - StatListsBlock rows: Senses (join + See Invisibility append + null
//     guard), Proficiencies (join order with 'N from: X' filter + row guard),
//     Languages join + null guard. Absence of all empty-list rows on the
//     untouched fixture is pinned by CharSummary-FixtureContract.test.jsx, so
//     only the null paths are re-pinned here. Vulnerabilities row
//     → CharSummary-OtherEffects.test.jsx.
//   - Background row presence/negatives (negatives delegated here by
//     CharSummary-UI-Interactions.test.jsx); popup content on click stays there.
//
//   - Short rest button open/close flow is owned by CharSummary-Prerequisites
//     .test.jsx (which also asserts the modal is closed pre-click) — the
//     former "renders without opening" test here was a subset and was removed.

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
    // Header — name, action buttons, delete-confirm flow
    // -------------------------------------------------------------------
    describe('Header', () => {
        it('renders the character name and the full set of action buttons', () => {
            renderSummary();
            expect(screen.getByText(mockPlayerStats.name)).toBeInTheDocument();
            for (const label of ['Edit', 'Delete', 'Upload', 'Download']) {
                expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
            }
        });

        it.each`
            confirmed | description
            ${true}   | ${'accepted'}
            ${false}  | ${'cancelled'}
        `('deletes the character only when the confirm dialog is $description', ({ confirmed }) => {
            const onDeleteCharacter = vi.fn();
            vi.spyOn(window, 'confirm').mockReturnValue(confirmed);
            renderSummary(mockPlayerStats, { onDeleteCharacter });

            fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

            expect(window.confirm).toHaveBeenCalled();
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
        it('falls back to the race name and omits parentheticals when subrace and types are absent', () => {
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
    // Senses row
    // -------------------------------------------------------------------
    describe('Senses', () => {
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

        it('does not render the senses row when senses is null', () => {
            renderSummary({ ...mockPlayerStats, senses: null });
            expect(screen.queryByText('Senses:')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------
    // Proficiencies row
    // -------------------------------------------------------------------
    describe('Proficiencies', () => {
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

        it.each`
            proficiencies     | toolProficiencies     | description
            ${null}           | ${[]}                 | ${'null with no tools'}
            ${[]}             | ${["Thieves' Tools"]} | ${'empty even when tools exist'}
        `('does not render the proficiencies row when proficiencies is $description', ({ proficiencies, toolProficiencies }) => {
            renderSummary({ ...mockPlayerStats, proficiencies, toolProficiencies });
            expect(screen.queryByText('Proficiencies:')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------
    // Languages row
    // -------------------------------------------------------------------
    describe('Languages', () => {
        it('renders all languages joined by comma in order', () => {
            const stats = { ...mockPlayerStats, languages: ['Common', 'Dwarvish', 'Celestial'] };
            renderSummary(stats);
            expect(statRowText('Languages:')).toBe('Languages: Common, Dwarvish, Celestial');
        });

        it('does not render the languages row when languages is null', () => {
            renderSummary({ ...mockPlayerStats, languages: null });
            expect(screen.queryByText('Languages:')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------
    // Background row (negatives delegated here by CharSummary-UI-Interactions)
    // -------------------------------------------------------------------
    describe('Background', () => {
        it('renders the background name in its own row', () => {
            renderSummary();
            expect(statRowText('Background:')).toBe('Background: Soldier');
        });

        it('does not render the background row when background is an empty string', () => {
            renderSummary({ ...mockPlayerStats, background: '' });
            expect(screen.queryByText('Background:')).not.toBeInTheDocument();
        });
    });
});
