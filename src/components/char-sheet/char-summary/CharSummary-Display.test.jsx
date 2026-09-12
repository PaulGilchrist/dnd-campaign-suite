// @improved-by-ai
// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

// ---------------------------------------------------------------------------
// Shared mocks — kept minimal. Each test file should mock everything it needs
// to avoid brittle cross-file mock state dependency.
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

vi.mock('../../../services/ui/sanitize.js', () => ({
    sanitizeHtml: (html) => html,
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
// Tests
// ---------------------------------------------------------------------------

describe('CharSummary - Display', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------
    // Avatar Image — tests real AvatarImage rendering, not the mock
    // -------------------------------------------------------------------
    describe('Avatar Image', () => {
        it('renders an img element with correct alt when imagePath is provided', () => {
            const stats = { ...mockPlayerStats, imagePath: '/images/character.png' };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByRole('img', { name: mockPlayerStats.name })).toBeInTheDocument();
        });

        it('renders an initial when imagePath is null', () => {
            const stats = { ...mockPlayerStats, imagePath: null };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            // AvatarImage falls back to a div with the initial letter when no image
            expect(screen.getByText(mockPlayerStats.name.charAt(0).toUpperCase())).toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------
    // Senses rendering
    // -------------------------------------------------------------------
    describe('Senses', () => {
        it('renders senses', () => {
            const stats = { ...mockPlayerStats, senses: [{ name: 'Blindsight', value: '60 ft' }] };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Senses:/)).toBeInTheDocument();
            expect(screen.getByText(/Blindsight 60 ft/)).toBeInTheDocument();
        });

        it.each`
            senses    | description
            ${null}   | ${'null'}
            ${[]}     | ${'empty array'}
        `('does not render senses section when senses is $description', ({ senses }) => {
            const stats = { ...mockPlayerStats, senses };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/Senses:/)).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------
    // Proficiencies rendering
    // -------------------------------------------------------------------
    describe('Proficiencies', () => {
        it('renders proficiency items and tool proficiencies', () => {
            const stats = {
                ...mockPlayerStats,
                proficiencies: ['Heavy Armor'],
                toolProficiencies: ["Blacksmith's Tools"],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Proficiencies:/)).toBeInTheDocument();
            expect(screen.getByText(/Heavy Armor/)).toBeInTheDocument();
            expect(screen.getByText(/Blacksmith/)).toBeInTheDocument();
        });

        it('filters out regex-matched proficiency patterns', () => {
            const stats = {
                ...mockPlayerStats,
                proficiencies: ['10 from: Druid', 'Heavy Armor'],
                toolProficiencies: [],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Proficiencies:/)).toBeInTheDocument();
            expect(screen.getByText(/Heavy Armor/)).toBeInTheDocument();
            expect(screen.queryByText(/10 from:/)).not.toBeInTheDocument();
        });

        it('does not render proficiencies section when proficiencies is null', () => {
            const stats = { ...mockPlayerStats, proficiencies: null, toolProficiencies: [] };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/Proficiencies:/)).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------
    // Languages rendering
    // -------------------------------------------------------------------
    describe('Languages', () => {
        it('renders multiple languages joined by comma', () => {
            const stats = { ...mockPlayerStats, languages: ['Common', 'Dwarvish', 'Celestial'] };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Languages:/)).toBeInTheDocument();
            expect(screen.getByText(/Common/)).toBeInTheDocument();
            expect(screen.getByText(/Dwarvish/)).toBeInTheDocument();
            expect(screen.getByText(/Celestial/)).toBeInTheDocument();
        });

    });

    // -------------------------------------------------------------------
    // Short rest button rendering
    // -------------------------------------------------------------------
    describe('Short Rest Button', () => {
        it('renders the short rest button with correct label and role', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByRole('button', { name: /short rest/i })).toBeInTheDocument();
        });
    });
});
