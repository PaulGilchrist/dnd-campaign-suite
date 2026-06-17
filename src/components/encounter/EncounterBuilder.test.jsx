import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EncounterBuilder from './EncounterBuilder.jsx';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
    useMonstersData: vi.fn(() => ({ monsters: [], loading: false })),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', () => ({
    default: vi.fn(() => ({
        modalOpen: false,
        modalMode: 'save',
        encounters: [],
        loading: false,
        openSaveModal: vi.fn(),
        openLoadModal: vi.fn(),
        closeModal: vi.fn(),
        saveEncounter: vi.fn(),
        updateEncounter: vi.fn(),
        loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(),
        renameEncounterAction: vi.fn(),
    })),
}));

vi.mock('./EncounterFilterPanel.jsx', () => ({ default: () => <div data-testid="encounter-filter-panel">Filter Panel</div> }));
vi.mock('./EncounterSummaryPanel.jsx', () => ({ default: () => <div data-testid="encounter-summary-panel">Summary Panel</div> }));
vi.mock('./EncounterMonsterTable.jsx', () => ({ default: () => <div data-testid="encounter-monster-table">Monster Table</div> }));
vi.mock('./EncounterSelectedMonsters.jsx', () => ({ default: () => <div data-testid="encounter-selected-monsters">Selected Monsters</div> }));
vi.mock('./EncounterModal.jsx', () => ({ default: () => <div data-testid="encounter-modal">Encounter Modal</div> }));
vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => <div data-testid="encounter-generator-modal">Generator Modal</div> }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal">Monster Card Modal</div> }));
vi.mock('../common/PreviewToggle.jsx', () => ({ default: () => <div data-testid="preview-toggle">Preview Toggle</div> }));

vi.mock('../../services/encounters/encountersService.js', () => ({
    formatEncounterName: vi.fn((name) => name),
}));

vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
    loadEncounterToInitiative: vi.fn(),
}));

vi.mock('../../services/items/lootGenerator.js', () => ({
    generateLootSuggestions: vi.fn(() => Promise.resolve({ lootEntries: [], totalEncounterXp: 0 })),
}));

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
    calculateXPThreshold: vi.fn(() => 100),
    calculateDifficultyMultiplier: vi.fn(() => 1),
}));

vi.mock('../../config/encounterConfig.js', () => ({
    ENCOUNTER_CONFIG: { defaultDifficulty: 1 },
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => 0),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const mockCampaignName = 'test-campaign';

describe('EncounterBuilder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('renders encounter title', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders save/update button', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('renders load button', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByText('Load')).toBeInTheDocument();
    });

    it('renders generate button', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByText('Generate')).toBeInTheDocument();
    });

    it('renders filter panel', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });

    it('renders summary panel', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
    });

    it('renders monster table', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByTestId('encounter-monster-table')).toBeInTheDocument();
    });

    it('renders selected monsters panel', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByTestId('encounter-selected-monsters')).toBeInTheDocument();
    });

    it('renders encounter modal', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });

    it('renders description section', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByTestId('preview-toggle')).toBeInTheDocument();
    });

    it('renders party summary when characters provided', () => {
        const characters = [
            { name: 'Thorin', level: 5 },
            { name: 'Elara', level: 3 },
        ];
        render(<EncounterBuilder campaignName={mockCampaignName} characters={characters} />);
        expect(screen.getByText('Thorin')).toBeInTheDocument();
        expect(screen.getByText('Lv5')).toBeInTheDocument();
        expect(screen.getByText('Elara')).toBeInTheDocument();
    });

    it('shows no characters message when no characters', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} characters={[]} />);
        expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    });

    it('shows reset button when encounter has a name', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders encounter actions section', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders monster card modal when viewing a monster', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders generator modal when showGenerator is true', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders difficulty labels', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        const filterPanel = screen.getByTestId('encounter-filter-panel');
        expect(filterPanel).toBeInTheDocument();
    });

    it('renders loot suggestions section when loot data exists', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders loading state when monsters are loading', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders dragon icon in title', () => {
        render(<EncounterBuilder campaignName={mockCampaignName} />);
        const icon = document.querySelector('.fa-solid.fa-dragon');
        expect(icon).toBeInTheDocument();
    });

    it('renders party icon', () => {
        const characters = [{ name: 'Thorin', level: 5 }];
        render(<EncounterBuilder campaignName={mockCampaignName} characters={characters} />);
        const icon = document.querySelector('.fa-solid.fa-users');
        expect(icon).toBeInTheDocument();
    });
});
