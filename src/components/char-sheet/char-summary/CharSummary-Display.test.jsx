// @improved-by-ai
//
// Coverage ownership (CharSummary family delegation):
//   - Character header area: name, header action buttons, and the delete-confirm
//     flow (onDeleteCharacter fires ONLY when window.confirm is accepted) —
//     no sibling touches onDeleteCharacter/window.confirm.
//   - Subtitle row (CharacterSummaryText): subrace-over-race precedence,
//     lowercase race/class-type suffixes, alignment. CharSummary-XPModes.test.jsx
//     owns the XP/milestone suffix content inside this row (pinned here only as
//     part of the exact full-line string of the default fixture).
//   - Real AvatarImage URL construction (campaign-scoped src prefix, absolute-URL
//     passthrough, initial fallback) — every other sibling mocks AvatarImage, so
//     this is the only place the actual <img src> can be verified. Modal open/
//     close flow → CharSummary-Prerequisites.test.jsx.
//   - StatListsBlock rows: Senses (incl. See Invisibility append), Proficiencies
//     (join order + 'N from: X' regex filter), Languages. Vulnerabilities row
//     → CharSummary-OtherEffects.test.jsx.
//   - Background row presence/negatives (negatives delegated here by
//     CharSummary-UI-Interactions.test.jsx); popup content on click stays there.
//
// Quality improvements over previous revision (10 runs → 24 runs):
//   - Row assertions now pin the FULL rendered row text (order, separators,
//     capitalization) via the statRowText helper instead of page-wide /regex/
//     presence — loose regexes passed even if items were duplicated, reordered,
//     or rendered by the wrong row.
//   - Added See Invisibility append (charSummaryCalc seeInvisibilityActive →
//     senses row), untested at component level anywhere in the family.
//   - Added Avatar src assertions (campaign prefix + http passthrough) — the
//     old tests only checked alt/initial, passing even if src were broken.
//   - Added delete-confirm flow (both confirm outcomes) and header button set.
//   - Added subtitle-row subrace-fallback and negative paths for Languages and
//     the proficiencies guard (empty proficiencies with tools → row hidden).
//   - Removed unused sanitize.js mock (no unmocked module in the render tree
//     imports it); deterministic beforeEach re-pins getActiveBuffs instead of
//     vi.restoreAllMocks (which had reset the useTrackedResource/useLoggedDiceRoll
//     factory implementations, leaving behavior version-dependent).
//   - Added '@testing-library/jest-dom' import (family convention).

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

// ---------------------------------------------------------------------------
// Mocks — minimal for this lane. AvatarImage and ShortRestButton intentionally
// NOT mocked (this file owns their rendered output); AvatarModal is mocked to
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
    // Subtitle row — race/class/level/alignment composition
    // -------------------------------------------------------------------
    describe('Subtitle', () => {
        it('renders subrace, lowercase race type, class with subclass type, level and alignment', () => {
            renderSummary();
            expect(subtitleText()).toBe(
                'Hill Dwarf (hill dwarf), Cleric (war-choice), Level 5 (milestone), Lawful Good'
            );
        });

        it('falls back to the race name and omits parentheticals when subrace and types are absent', () => {
            const stats = {
                ...mockPlayerStats,
                race: { name: 'Elf' },
                class: { name: 'Wizard', subclass: null },
            };
            renderSummary(stats);
            expect(subtitleText()).toContain('Elf, Wizard');
            expect(subtitleText()).not.toContain('()');
            expect(subtitleText()).not.toContain('Dwarf');
        });
    });

    // -------------------------------------------------------------------
    // Avatar Image — real AvatarImage: URL construction and fallbacks
    // -------------------------------------------------------------------
    describe('Avatar Image', () => {
        it('builds a campaign-scoped src and accessible name for local images', () => {
            const stats = { ...mockPlayerStats, imagePath: '/images/character.png' };
            renderSummary(stats);
            const img = screen.getByRole('img', { name: mockPlayerStats.name });
            // Campaign-scoped prefix + original path (component string-concatenates,
            // so a leading-slash imagePath yields a tolerated extra '/').
            const src = img.getAttribute('src');
            expect(src).toMatch(new RegExp(`^campaigns/${mockCampaignName}/`));
            expect(src).toContain('images/character.png');
        });

        it('keeps absolute http image URLs unchanged', () => {
            const stats = { ...mockPlayerStats, imagePath: 'https://cdn.example.com/portrait.png' };
            renderSummary(stats);
            expect(screen.getByRole('img', { name: mockPlayerStats.name }))
                .toHaveAttribute('src', 'https://cdn.example.com/portrait.png');
        });

        it('renders the uppercased initial instead of an img when imagePath is null', () => {
            const stats = { ...mockPlayerStats, imagePath: null };
            renderSummary(stats);
            expect(screen.queryByRole('img')).not.toBeInTheDocument();
            expect(screen.getByText(/^T$/)).toBeInTheDocument();
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

        it.each`
            senses  | description
            ${null} | ${'null'}
            ${[]}   | ${'empty array'}
        `('does not render the senses row when senses is $description', ({ senses }) => {
            renderSummary({ ...mockPlayerStats, senses });
            expect(screen.queryByText('Senses:')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------
    // Proficiencies row
    // -------------------------------------------------------------------
    describe('Proficiencies', () => {
        it('renders proficiencies followed by tool proficiencies in one comma-separated row', () => {
            const stats = {
                ...mockPlayerStats,
                proficiencies: ['Heavy Armor', 'Light Armor'],
                toolProficiencies: ["Blacksmith's Tools", "Thieves' Tools"],
            };
            renderSummary(stats);
            expect(statRowText('Proficiencies:')).toBe("Proficiencies: Heavy Armor, Light Armor, Blacksmith's Tools, Thieves' Tools");
        });

        it('filters out synthetic "N from: Source" entries and keeps real proficiencies', () => {
            const stats = {
                ...mockPlayerStats,
                proficiencies: ['10 from: Druid', 'Heavy Armor'],
                toolProficiencies: [],
            };
            renderSummary(stats);
            expect(statRowText('Proficiencies:')).toBe('Proficiencies: Heavy Armor');
            expect(screen.queryByText(/10 from:/)).not.toBeInTheDocument();
        });

        it.each`
            proficiencies      | toolProficiencies      | description
            ${null}            | ${[]}                  | ${'null with no tools'}
            ${[]}              | ${[]}                  | ${'empty with no tools'}
            ${[]}              | ${["Thieves' Tools"]}  | ${'empty even when tools exist'}
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

        it.each`
            languages  | description
            ${null}    | ${'null'}
            ${[]}      | ${'empty array'}
        `('does not render the languages row when languages is $description', ({ languages }) => {
            renderSummary({ ...mockPlayerStats, languages });
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

        it.each`
            background   | description
            ${null}      | ${'null'}
            ${''}        | ${'an empty string'}
        `('does not render the background row when background is $description', ({ background }) => {
            renderSummary({ ...mockPlayerStats, background });
            expect(screen.queryByText('Background:')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------
    // Short rest button (modal open/close flow → CharSummary-Prerequisites)
    // -------------------------------------------------------------------
    describe('Short Rest Button', () => {
        it('renders the real short rest button without opening its modal until clicked', () => {
            renderSummary();
            expect(screen.getByRole('button', { name: /short rest/i })).toBeInTheDocument();
            expect(screen.queryByTestId('short-rest-modal')).not.toBeInTheDocument();
        });
    });
});
