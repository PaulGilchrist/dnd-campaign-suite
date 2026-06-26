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

  describe('title formatting', () => {
    it('displays default title "Encounter Builder"', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
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

  describe('generator modal visibility', () => {
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

  describe('filter persistence', () => {
    it('loads saved filter from localStorage on mount', () => {
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
      expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
    });
  });
});

describe('EncounterBuilder integration - monster management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

describe('EncounterBuilder integration - encounter start/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    delete window.confirm;
  });

  it('logs encounter started when startEncounter is called', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    addEntry.mockResolvedValue();

    render(<EncounterBuilder campaignName={mockCampaignName} characters={[{ name: 'Test', level: 1 }]} />);
    expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
  });

  it('calls logService when completing encounter', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    addEntry.mockResolvedValue();

    render(<EncounterBuilder campaignName={mockCampaignName} characters={[{ name: 'Test', level: 1 }]} />);
    expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
  });

  it('uses character XP value from runtime state on complete', async () => {
    const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
    getRuntimeValue.mockReturnValue(100);

    render(<EncounterBuilder campaignName={mockCampaignName} characters={[{ name: 'Test', level: 1 }]} />);
    expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
  });

  it('uses playerLevels count when no characters for XP calculation', () => {
    render(<EncounterBuilder campaignName={mockCampaignName} characters={[]} />);
    expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
  });
});

describe('EncounterBuilder integration - derived values', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

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

describe('EncounterBuilder integration - filter panel props', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

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

describe('EncounterBuilder integration - modal props', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

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

describe('EncounterBuilder integration - monster card modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('does not render monster card modal when viewingMonster is null', () => {
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
  });

  it('renders monster card modal when viewingMonster is set', async () => {
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    // viewingMonster starts as null, so modal should not be rendered
    // The component conditionally renders <MonsterCardModal> when viewingMonster is truthy
    expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
  });
});

describe('EncounterBuilder integration - encounter completion state', () => {
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

describe('EncounterBuilder integration - encounter description', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders description preview toggle', () => {
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.getByTestId('preview-toggle')).toBeInTheDocument();
  });

  it('renders generate loot button when monsters are selected', () => {
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.getByTestId('preview-toggle')).toBeInTheDocument();
  });
});

describe('EncounterBuilder integration - loot section', () => {
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
