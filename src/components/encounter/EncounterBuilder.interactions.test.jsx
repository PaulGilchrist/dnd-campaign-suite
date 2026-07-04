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
});

describe('EncounterBuilder interactions - derived values', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders all panels with derived values passed', async () => {
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.getByTestId('encounter-summary-panel')).toBeInTheDocument();
  });
});

describe('EncounterBuilder interactions - filter panel props', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders filter panel with props', async () => {
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.getByTestId('encounter-filter-panel')).toBeInTheDocument();
  });
});

describe('EncounterBuilder interactions - modal props', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders modal with props', async () => {
    render(<EncounterBuilder campaignName={mockCampaignName} />);
    expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
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
});
