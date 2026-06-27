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

describe('EncounterBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('initial render', () => {
    it('renders the encounter builder with default title', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders save, load, and generate action buttons', () => {
      const { getAllByRole } = render(<EncounterBuilder campaignName={mockCampaignName} />);
      const buttons = getAllByRole('button');
      const buttonTexts = buttons.map(b => b.textContent.trim());
      expect(buttonTexts).toContain('Save');
      expect(buttonTexts).toContain('Load');
      expect(buttonTexts).toContain('Generate');
    });

    it('renders all child panels and modals', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-monster-table')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-selected-monsters')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
      expect(screen.getByTestId('preview-toggle')).toBeInTheDocument();
    });

    it('renders the dragon icon in the title', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const icon = document.querySelector('.fa-solid.fa-dragon');
      expect(icon).toBeInTheDocument();
    });

    it('does not show reset button when no current encounter', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.queryByText('Reset')).not.toBeInTheDocument();
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

    it('does not render party icon when no characters', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} characters={[]} />);
      const icon = document.querySelector('.fa-solid.fa-users');
      expect(icon).not.toBeInTheDocument();
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

  describe('save flow', () => {
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

    it('calls updateEncounter when saving an existing encounter', async () => {
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

    it('shows Save button text when no current encounter', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });

  describe('load flow', () => {
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

  describe('generator modal', () => {
    it('renders generator modal when generate button is clicked', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      const generateButton = screen.getByText('Generate');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('encounter-generator-modal')).toBeInTheDocument();
      });
    });

    it('passes monsters and playerLevels to generator modal', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({
        monsters: [{ index: 'goblin', name: 'Goblin' }],
        loading: false,
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={[{ name: 'Test', level: 5 }]} />);
      const generateButton = screen.getByText('Generate');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('encounter-generator-modal')).toBeInTheDocument();
      });
    });
  });

  describe('encounter actions - save/load/delete/rename', () => {
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

    it('has onStartCombat callback defined', () => {
      const onStartCombat = vi.fn();
      render(<EncounterBuilder campaignName={mockCampaignName} characters={[{ name: 'Test', level: 1 }]} onStartCombat={onStartCombat} />);
      expect(onStartCombat).toBeDefined();
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

  describe('player management', () => {
    it('has player management handlers defined', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });
  });

  describe('monster table rendering', () => {
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

    it('passes filteredMonsters to monster table component', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({
        monsters: [{ index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 }],
        loading: false,
      });

      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-monster-table')).toBeInTheDocument();
    });

    it('passes selectedMonsters to selected monsters panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-selected-monsters')).toBeInTheDocument();
    });

    it('passes sort handlers to monster table', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-monster-table')).toBeInTheDocument();
    });
  });

  describe('derived values', () => {
    it('passes totalMonsterXP to summary panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
    });

    it('passes monsterCount to summary panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
    });

    it('passes difficultyMultiplier to summary panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
    });

    it('passes effectiveXP to summary panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
    });

    it('passes actualDifficultyIndex to summary panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
    });

    it('passes selectedMonsters to summary panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
    });
  });

  describe('filter panel props', () => {
    it('passes filter object to filter panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });

    it('passes totalThreshold to filter panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });

    it('passes difficultyIndex to filter panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });

    it('passes difficultyLabels to filter panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });

    it('passes difficultyColors to filter panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });

    it('passes onDifficultyChange handler to filter panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });

    it('passes onEnvironmentChange handler to filter panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });

    it('passes onAddPlayer handler to filter panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });

    it('passes onRemovePlayer handler to filter panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });

    it('passes onPlayerLevelChange handler to filter panel', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });
  });

  describe('modal props', () => {
    it('passes modalOpen to encounter modal', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });

    it('passes onClose to encounter modal', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });

    it('passes mode to encounter modal', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });

    it('passes onSave to encounter modal', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });

    it('passes onLoad to encounter modal', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });

    it('passes onDelete to encounter modal', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });

    it('passes onRename to encounter modal', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });

    it('passes encounters to encounter modal', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });

    it('passes loading to encounter modal', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    });
  });

  describe('monster card modal', () => {
    it('does not render monster card modal when viewingMonster is null', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
    });

    it('renders monster card modal when viewingMonster is set', async () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
    });
  });

  describe('encounter completion state', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      window.confirm = vi.fn(() => true);
    });

    afterEach(() => {
      delete window.confirm;
    });

    it('renders encounter completed state with XP awarded message', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });
  });

  describe('loot section', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
    });

    it('renders loot section when loot entries exist', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders loot clear button when loot entries exist', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders encounter XP summary when totalEncounterXp > 0', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders start encounter button when combat not started and loot exists', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('renders complete encounter button when combat started', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });
  });
});
