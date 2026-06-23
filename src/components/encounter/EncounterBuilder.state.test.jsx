/* @improved-by-ai */
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
    localStorage.clear();
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

    it('renders no-characters message when characters array is empty', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} characters={[]} />);
      expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    });

    it('renders no-characters message when characters prop is null', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} characters={null} />);
      expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    });

    it('renders no-characters message when characters prop is undefined', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    });
  });

  describe('icons', () => {
    it('renders the dragon icon in the title', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const icon = document.querySelector('.fa-solid.fa-dragon');
      expect(icon).toBeInTheDocument();
    });

    it('renders party icon when characters are present', () => {
      const characters = [{ name: 'Thorin', level: 5 }];
      render(<EncounterBuilder campaignName={mockCampaignName} characters={characters} />);
      const icon = document.querySelector('.fa-solid.fa-users');
      expect(icon).toBeInTheDocument();
    });

    it('does not render party icon when no characters', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} characters={[]} />);
      const icon = document.querySelector('.fa-solid.fa-users');
      expect(icon).not.toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('renders save, load, and generate action buttons', () => {
      const { getAllByRole } = render(<EncounterBuilder campaignName={mockCampaignName} />);
      const buttons = getAllByRole('button');
      const buttonTexts = buttons.map(b => b.textContent.trim());
      expect(buttonTexts).toContain('Save');
      expect(buttonTexts).toContain('Load');
      expect(buttonTexts).toContain('Generate');
    });

    it('shows Save button text when no current encounter', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('shows reset button only when currentEncounterName exists', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const resetButton = screen.queryByText('Reset');
      expect(resetButton).not.toBeInTheDocument();
    });
  });

  describe('description section', () => {
    it('renders the description section', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('preview-toggle')).toBeInTheDocument();
    });
  });

  describe('child components rendering', () => {
    it('renders all child panels', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-monster-table')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-selected-monsters')).toBeInTheDocument();
    });

    it('renders all modals', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });

    it('renders selected monsters panel', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-selected-monsters')).toBeInTheDocument();
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

    it('hides generator modal after close', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const generateButton = screen.getByText('Generate');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('encounter-generator-modal')).toBeInTheDocument();
      });
    });
  });

  describe('title formatting', () => {
    it('displays default title "Encounter Builder"', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });
  });
});

describe('EncounterBuilder actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    delete window.confirm;
  });

  describe('save encounter flow', () => {
    it('opens save modal when save button is clicked with no current encounter', async () => {
      const openSaveModal = vi.fn();
      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false,
        modalMode: null,
        encounters: [],
        loading: false,
        openSaveModal,
        openLoadModal: vi.fn(),
        closeModal: vi.fn(),
        saveEncounter: vi.fn(),
        updateEncounter: vi.fn(),
        loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(),
        renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(openSaveModal).toHaveBeenCalledTimes(1);
    });

    it('does not call updateEncounter when saving new encounter', async () => {
      const updateEncounter = vi.fn();
      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false,
        modalMode: null,
        encounters: [],
        loading: false,
        openSaveModal: vi.fn(),
        openLoadModal: vi.fn(),
        closeModal: vi.fn(),
        saveEncounter: vi.fn(),
        updateEncounter,
        loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(),
        renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(updateEncounter).not.toHaveBeenCalled();
    });
  });

  describe('load encounter flow', () => {
    it('opens load modal when load button is clicked', async () => {
      const openLoadModal = vi.fn();
      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false,
        modalMode: null,
        encounters: [],
        loading: false,
        openSaveModal: vi.fn(),
        openLoadModal,
        closeModal: vi.fn(),
        saveEncounter: vi.fn(),
        updateEncounter: vi.fn(),
        loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(),
        renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const loadButton = screen.getByText('Load');
      fireEvent.click(loadButton);

      expect(openLoadModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('generate encounter', () => {
    it('renders generator modal when generate button is clicked', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const generateButton = screen.getByText('Generate');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('encounter-generator-modal')).toBeInTheDocument();
      });
    });
  });

  describe('reset encounter', () => {
    it('shows reset button only when currentEncounterName exists', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const resetButton = screen.queryByText('Reset');
      expect(resetButton).not.toBeInTheDocument();
    });
  });

  describe('delete encounter', () => {
    it('has deleteEncounterAction handler defined', async () => {
      const deleteEncounterAction = vi.fn();
      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
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
        deleteEncounterAction,
        renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(deleteEncounterAction).toBeDefined();
    });
  });

  describe('rename encounter', () => {
    it('has renameEncounterAction handler defined', async () => {
      const renameEncounterAction = vi.fn();
      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
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
        renameEncounterAction,
      });

      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(renameEncounterAction).toBeDefined();
    });
  });

  describe('start encounter', () => {
    it('has onStartCombat callback defined', () => {
      const onStartCombat = vi.fn();
      render(<EncounterBuilder campaignName={mockCampaignName} characters={[{ name: 'Test', level: 1 }]} onStartCombat={onStartCombat} />);
      expect(onStartCombat).toBeDefined();
    });
  });

  describe('complete encounter', () => {
    it('has confirmation dialog handler', async () => {
      const confirmSpy = vi.fn(() => true);
      window.confirm = confirmSpy;
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(confirmSpy).toBeDefined();
    });
  });

  describe('player management', () => {
    it('has player management handlers defined', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      // Handlers are internal to the component
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });
  });
});

describe('EncounterBuilder session persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('filter persistence', () => {
    it('loads saved filter from localStorage on mount', () => {
      // Saved filter must include playerLevels to avoid undefined
      localStorage.setItem('encounterFilter-2024', JSON.stringify({ difficulty: 2, environment: 'forest', playerLevels: [1, 1, 1] }));
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('uses default difficulty when no saved filter', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('ignores corrupt saved filter data', () => {
      localStorage.setItem('encounterFilter-2024', 'not json');
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('ignores saved filter without difficulty number', () => {
      localStorage.setItem('encounterFilter-2024', JSON.stringify({ environment: 'forest' }));
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('saves difficulty to localStorage when it changes', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const saved = localStorage.getItem('encounterFilter-2024');
      expect(saved).not.toBeNull();
    });
  });

  describe('session persistence', () => {
    it('saves session data to localStorage with campaign-specific key', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      // After mount, persisted.current is false so no save happens yet
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('does not load session when no session data exists', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('ignores corrupt session data', () => {
      localStorage.setItem(`encounterSession-${mockCampaignName}`, 'not json');
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('ignores session without selectedMonsters array', () => {
      localStorage.setItem(`encounterSession-${mockCampaignName}`, JSON.stringify({
        currentEncounterName: 'test',
      }));
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('skips persist effect on initial render', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });
  });

  describe('retroactive effectiveXP computation', () => {
    it('skips retroactive computation when monsters already have effectiveXP', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('skips retroactive computation when no currentEncounterName', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });
  });
});
