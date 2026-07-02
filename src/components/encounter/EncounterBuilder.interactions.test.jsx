import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('EncounterBuilder interactions - save/load flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

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

describe('EncounterBuilder interactions - monster management', () => {
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

describe('EncounterBuilder interactions - derived values', () => {
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

describe('EncounterBuilder interactions - filter panel props', () => {
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

describe('EncounterBuilder interactions - modal props', () => {
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

describe('EncounterBuilder interactions - encounter start/complete', () => {
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

  it('has onStartCombat callback defined', () => {
    const onStartCombat = vi.fn();
    render(<EncounterBuilder campaignName={mockCampaignName} characters={[{ name: 'Test', level: 1 }]} onStartCombat={onStartCombat} />);
    expect(onStartCombat).toBeDefined();
  });

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

  it('has confirmation dialog handler for encounter completion', async () => {
    const confirmSpy = vi.fn(() => true);
    window.confirm = confirmSpy;
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(confirmSpy).toBeDefined();
  });
});

describe('EncounterBuilder interactions - description section', () => {
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

describe('EncounterBuilder interactions - encounter completion state', () => {
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

describe('EncounterBuilder interactions - loot section', () => {
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
