import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EncounterBuilder from './EncounterBuilder.jsx';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(() => ({ monsters: [], loading: false })),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', () => ({
  default: vi.fn(() => ({
    modalOpen: false,
    modalMode: null,
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

vi.mock('./EncounterFilterPanel.jsx', () => ({ default: (props) => <div data-testid="encounter-filter-panel">{props.children}</div> }));
vi.mock('./EncounterSummaryPanel.jsx', () => ({ default: (props) => <div data-testid="encounter-summary-panel">{props.children}</div> }));
vi.mock('./EncounterMonsterTable.jsx', () => ({ default: (props) => <div data-testid="encounter-monster-table">{props.children}</div> }));
vi.mock('./EncounterSelectedMonsters.jsx', () => ({ default: (props) => <div data-testid="encounter-selected-monsters">{props.children}</div> }));
vi.mock('./EncounterModal.jsx', () => ({ default: (props) => <div data-testid="encounter-modal">{props.children}</div> }));
vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: (props) => <div data-testid="encounter-generator-modal">{props.children}</div> }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: (props) => <div data-testid="monster-card-modal">{props.children}</div> }));
vi.mock('../common/PreviewToggle.jsx', () => ({ default: (props) => <div data-testid="preview-toggle">{props.children}</div> }));

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

describe('EncounterBuilder rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders the encounter builder with default title and all child panels', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-monster-table')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-selected-monsters')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
      expect(screen.getByTestId('preview-toggle')).toBeInTheDocument();
    });

    it('renders save, load, and generate action buttons', () => {
      const { getAllByRole } = render(<EncounterBuilder campaignName={mockCampaignName} />);
      const buttons = getAllByRole('button');
      const buttonTexts = buttons.map(b => b.textContent.trim());
      expect(buttonTexts).toContain('Save');
      expect(buttonTexts).toContain('Load');
      expect(buttonTexts).toContain('Generate');
    });

    it('does not show reset button when no current encounter', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.queryByText('Reset')).not.toBeInTheDocument();
    });

    it('renders the dragon icon in the title', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const icon = document.querySelector('.fa-solid.fa-dragon');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('renders loading spinner when monsters are loading', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: [], loading: true });

      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText(/Loading monsters/)).toBeInTheDocument();
      const spinner = document.querySelector('.fa-spinner');
      expect(spinner).toBeInTheDocument();
    });

    it('renders monster table when monsters data is available', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({
        monsters: [{ index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 }],
        loading: false,
      });

      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-monster-table')).toBeInTheDocument();
      expect(screen.queryByText(/Loading monsters/)).not.toBeInTheDocument();
    });
  });

  describe('party display', () => {
    it('renders party member names and levels when characters are provided', () => {
      const characters = [
        { name: 'Thorin', level: 5 },
        { name: 'Elara', level: 3 },
      ];
      render(<EncounterBuilder campaignName={mockCampaignName} characters={characters} />);
      expect(screen.getByText('Thorin')).toBeInTheDocument();
      expect(screen.getByText('Lv5')).toBeInTheDocument();
      expect(screen.getByText('Elara')).toBeInTheDocument();
      expect(screen.getByText('Lv3')).toBeInTheDocument();
    });

    it('renders party icon when characters are present', () => {
      const characters = [{ name: 'Thorin', level: 5 }];
      render(<EncounterBuilder campaignName={mockCampaignName} characters={characters} />);
      const icon = document.querySelector('.fa-solid.fa-users');
      expect(icon).toBeInTheDocument();
    });

    it('renders no-characters message when characters are missing', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} characters={[]} />);
      expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    });
  });

  describe('generator modal', () => {
    it('renders generator modal when generate button is clicked', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const generateButton = screen.getByText('Generate');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('encounter-generator-modal')).toBeInTheDocument();
      });
    });
  });

  describe('monster card modal visibility', () => {
    it('does not render monster card modal when viewingMonster is null', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
    });
  });
});

describe('EncounterBuilder rendering - filter persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders successfully with saved filter in localStorage', () => {
    localStorage.setItem('encounterFilter-2024', JSON.stringify({ difficulty: 2, environment: 'forest' }));
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
  });

  it('renders successfully with corrupt saved filter data', () => {
    localStorage.setItem('encounterFilter-2024', 'not json');
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
  });

  it('renders successfully without difficulty number in saved filter', () => {
    localStorage.setItem('encounterFilter-2024', JSON.stringify({ environment: 'forest' }));
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
  });
});

describe('EncounterBuilder rendering - session persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders successfully with corrupt session data', () => {
    localStorage.setItem(`encounterSession-${mockCampaignName}`, 'not json');
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
  });

  it('renders successfully with session missing selectedMonsters array', () => {
    localStorage.setItem(`encounterSession-${mockCampaignName}`, JSON.stringify({
      currentEncounterName: 'test',
    }));
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
  });
});

// @cleaned-by-ai
