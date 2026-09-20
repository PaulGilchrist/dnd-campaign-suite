// @improved-by-ai
// @cleaned-by-ai
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

vi.mock('./EncounterFilterPanel.jsx', () => ({
  default: (props) => (
    <div data-testid="encounter-filter-panel">
      <select
        data-testid="difficulty-select"
        value={props.filter?.difficulty}
        onChange={props.onDifficultyChange}
      >
        <option value={0}>Easy</option>
        <option value={1}>Medium</option>
        <option value={2}>Hard</option>
        <option value={3}>Deadly</option>
      </select>
      <div data-testid="player-levels">
        {props.filter?.playerLevels?.map((level, i) => (
          <div key={i} data-testid={`player-level-${i}`}>
            <input
              data-testid={`player-level-input-${i}`}
              type="number"
              value={level}
              onChange={(e) => props.onPlayerLevelChange(i, Number(e.target.value))}
            />
            <button
              data-testid={`remove-player-${i}`}
              disabled={props.filter?.playerLevels?.length <= 1}
              onClick={() => props.onRemovePlayer(i)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button data-testid="add-player" onClick={props.onAddPlayer}>Add Player</button>
      {props.onEnvironmentChange && (
        <select
          data-testid="environment-select"
          value={props.filter?.environment || ''}
          onChange={(e) => props.onEnvironmentChange(e)}
        >
          <option value="">All Environments</option>
          <option value="forest">Forest</option>
          <option value="hill">Hill</option>
          <option value="mountain">Mountain</option>
        </select>
      )}
    </div>
  ),
}));

vi.mock('./EncounterSummaryPanel.jsx', () => ({
  default: (props) => (
    <div data-testid="encounter-summary-panel">
      <span data-testid="total-xp">{props.totalMonsterXP.toLocaleString()}</span>
      <span data-testid="monster-count">{props.monsterCount}</span>
      <span data-testid="difficulty-multiplier">{props.difficultyMultiplier}</span>
      <span data-testid="effective-xp">{props.effectiveXP.toLocaleString()}</span>
      <span data-testid="difficulty-label">{props.difficultyLabels?.[props.difficultyIndex]}</span>
      {props.selectedMonsters?.length > 0 && (
        <button data-testid="clear-all" onClick={props.onClearMonsters}>Clear All</button>
      )}
    </div>
  ),
}));

vi.mock('./EncounterMonsterTable.jsx', () => ({
  default: (props) => (
    <div data-testid="encounter-monster-table">
      <input
        data-testid="search-input"
        value={props.searchQuery}
        onChange={(e) => props.onSearchQueryChange(e.target.value)}
        placeholder="Search by name, type, or subtype..."
      />
      <select
        data-testid="type-filter"
        value={props.typeFilter || ''}
        onChange={(e) => props.onTypeChange(e.target.value)}
      >
        <option value="">All Types</option>
        <option value="humanoid">Humanoid</option>
        <option value="dragon">Dragon</option>
        <option value="beast">Beast</option>
      </select>
      <select
        data-testid="size-filter"
        value={props.sizeFilter || ''}
        onChange={(e) => props.onSizeChange(e.target.value)}
      >
        <option value="">All Sizes</option>
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
      <input
        data-testid="cr-min"
        type="number"
        value={props.crMin ?? ''}
        onChange={(e) => props.onCRMinChange(e.target.value)}
        placeholder="Any"
      />
      <input
        data-testid="cr-max"
        type="number"
        value={props.crMax ?? ''}
        onChange={(e) => props.onCRMaxChange(e.target.value)}
        placeholder="Any"
      />
      {props.filteredMonsters?.map((monster) => {
        const selected = props.selectedMonsters.some((m) => m.index === monster.index);
        const qty = (props.selectedMonsters.find((m) => m.index === monster.index)?.qty) || 0;
        return (
          <div
            key={monster.index}
            data-testid={`monster-row-${monster.index}`}
            className={selected ? 'monster-row-selected' : ''}
            onClick={() => props.onToggleMonster(monster)}
          >
            <input
              type="checkbox"
              data-testid={`monster-checkbox-${monster.index}`}
              checked={selected}
              onChange={(e) => { e.stopPropagation(); props.onToggleMonster(monster); }}
              onClick={(e) => e.stopPropagation()}
            />
            <span data-testid={`monster-name-${monster.index}`}>{monster.name}</span>
            {qty > 0 && (
              <>
                <span data-testid={`monster-qty-${monster.index}`}>{qty}</span>
                <button
                  data-testid={`decrease-qty-${monster.index}`}
                  onClick={(e) => { e.stopPropagation(); props.onDecreaseQty(monster.index); }}
                >
                  -
                </button>
                <button
                  data-testid={`increase-qty-${monster.index}`}
                  onClick={(e) => { e.stopPropagation(); props.onIncreaseQty(monster.index); }}
                >
                  +
                </button>
                <button
                  data-testid={`remove-monster-${monster.index}`}
                  onClick={(e) => { e.stopPropagation(); props.onRemoveMonster(monster.index); }}
                >
                  Remove
                </button>
              </>
            )}
            {props.onViewDetails && (
              <button
                data-testid={`details-btn-${monster.index}`}
                onClick={(e) => { e.stopPropagation(); props.onViewDetails(monster); }}
              >
                Details
              </button>
            )}
          </div>
        );
      })}
      {props.sortField && (
        <div data-testid="sort-field">{props.sortField}</div>
      )}
      {props.sortDirection && (
        <div data-testid="sort-direction">{props.sortDirection}</div>
      )}
    </div>
  ),
}));

vi.mock('./EncounterSelectedMonsters.jsx', () => ({
  default: (props) => {
    if (!props.selectedMonsters || props.selectedMonsters.length === 0) {
      return null;
    }
    const totalMonsters = props.selectedMonsters.reduce((sum, m) => sum + (m.qty || 1), 0);
    return (
      <div data-testid="encounter-selected-monsters">
        <div data-testid="selected-count">{totalMonsters}</div>
        {props.selectedMonsters.map((monster) => (
          <div key={monster.index} data-testid={`selected-item-${monster.index}`}>
            <span data-testid={`selected-name-${monster.index}`}>{monster.name}</span>
            <span data-testid={`selected-xp-${monster.index}`}>
              {(monster.xp * (monster.qty || 1)).toLocaleString()} XP
            </span>
            <button
              data-testid={`remove-selected-${monster.index}`}
              onClick={() => props.onRemoveMonster(monster.index)}
            >
              Remove
            </button>
            {props.onViewDetails && (
              <button
                data-testid={`view-details-selected-${monster.index}`}
                onClick={() => props.onViewDetails(monster)}
              >
                View
              </button>
            )}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('./EncounterModal.jsx', () => ({
  default: (props) => {
    if (!props.isOpen) return null;
    return (
      <div data-testid="encounter-modal">
        <button data-testid="modal-close" onClick={props.onClose}>Close</button>
        {props.mode === 'save' && (
          <div>
            <input
              data-testid="encounter-name-input"
              placeholder="e.g., Goblin Ambush"
            />
            <button data-testid="modal-save" onClick={() => props.onSave('Test Encounter')}>
              Save
            </button>
          </div>
        )}
        {props.mode === 'load' && (
          <div>
            {props.encounters?.map((enc) => (
              <button
                key={enc.name}
                data-testid={`load-encounter-${enc.name}`}
                onClick={() => props.onLoad(enc.name)}
              >
                Load {enc.name}
              </button>
            ))}
            {props.onDelete && props.encounters?.length > 0 && (
              <button
                data-testid={`delete-encounter-${props.encounters[0].name}`}
                onClick={() => props.onDelete(props.encounters[0].name)}
              >
                Delete
              </button>
            )}
            {props.onRename && props.encounters?.length > 0 && (
              <button
                data-testid={`rename-encounter-${props.encounters[0].name}`}
                onClick={() => props.onRename(props.encounters[0].name, 'Renamed Encounter')}
              >
                Rename
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
}));

vi.mock('./EncounterGeneratorModal.jsx', () => ({
  default: (props) => {
    if (!props.onClose) return null;
    return (
      <div data-testid="encounter-generator-modal">
        <button data-testid="generator-close" onClick={props.onClose}>Close</button>
        <button
          data-testid="generator-apply"
          onClick={() => props.onApply([
            { index: 'suggested-goblin', name: 'Suggested Goblin', xp: 50, challenge_rating: 0.25 },
          ])}
        >
          Apply
        </button>
      </div>
    );
  },
}));

vi.mock('./MonsterCardModal.jsx', () => ({
  default: (props) => {
    if (!props.monster) return null;
    return (
      <div data-testid="monster-card-modal">
        <span data-testid="monster-card-name">{props.monster.name}</span>
        <button data-testid="monster-card-close" onClick={props.onClose}>Close</button>
      </div>
    );
  },
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: (props) => (
    <div data-testid="preview-toggle">
      <textarea
        data-testid="description-textarea"
        value={props.value || ''}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    </div>
  ),
}));

vi.mock('../../services/encounters/encountersService.js', () => ({
  formatEncounterName: vi.fn((name) => `Encounter: ${name}`),
}));

vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  calculateXPThreshold: vi.fn(() => 100),
  calculateDifficultyMultiplier: vi.fn(() => 1),
}));

vi.mock('../../config/encounterConfig.js', () => ({
  ENCOUNTER_CONFIG: { defaultDifficulty: 1 },
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  const store = new Map();
  let syncedStateValue = null;
  const syncedStateSetter = vi.fn((val) => { syncedStateValue = val; });

  return {
    getStore: vi.fn(() => store),
    useSyncedState: vi.fn((key, prop, defaultValue) => {
      if (key === 'campaign' && prop === 'encounter-viewingMonster') {
        return [syncedStateValue, syncedStateSetter];
      }
      return [defaultValue, vi.fn()];
    }),
    listeners: new Map(),
    getRuntimeValue: vi.fn(() => 0),
    setRuntimeValue: vi.fn(),
  };
});

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const mockCampaignName = 'test-campaign';
const defaultCharacters = [
  { name: 'Thorin', level: 5 },
  { name: 'Elara', level: 3 },
];
const sampleMonsters = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] },
  { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, type: 'humanoid', environments: ['hill', 'mountain'] },
  { index: 'dragon', name: 'Young Dragon', xp: 120, challenge_rating: 2, type: 'dragon', environments: ['underground'] },
];

describe('EncounterBuilder - remaining uncovered lines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('handleSaveEncounter - save path', () => {
    it('calls openSaveModal when Save button is clicked with no current encounter name', async () => {
      const openSaveModal = vi.fn();

      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal, openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      const checkbox = screen.getByTestId('monster-checkbox-goblin');
      fireEvent.click(checkbox);

      const saveBtn = screen.getByText(/Save|Update/);
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(openSaveModal).toHaveBeenCalled();
      });
    });
  });

  describe('handleJoinEncounter', () => {
    it('does not show Join Encounter button when no monsters are selected', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      expect(screen.queryByText('Join Encounter')).not.toBeInTheDocument();
    });

    it('shows Join Encounter button when monsters are selected', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      const checkbox = screen.getByTestId('monster-checkbox-goblin');
      fireEvent.click(checkbox);

      expect(screen.getByText('Join Encounter')).toBeInTheDocument();
    });
  });

  describe('handleClearMonsters', () => {
    it('clears all selected monsters when Clear All is clicked', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      const goblinCheckbox = screen.getByTestId('monster-checkbox-goblin');
      const orcCheckbox = screen.getByTestId('monster-checkbox-orc');
      fireEvent.click(goblinCheckbox);
      fireEvent.click(orcCheckbox);

      expect(screen.getByTestId('selected-item-goblin')).toBeInTheDocument();
      expect(screen.getByTestId('selected-item-orc')).toBeInTheDocument();

      const clearBtn = screen.getByTestId('clear-all');
      fireEvent.click(clearBtn);

      expect(screen.queryByTestId('selected-item-goblin')).not.toBeInTheDocument();
      expect(screen.queryByTestId('selected-item-orc')).not.toBeInTheDocument();
    });
  });

  describe('handleApplySuggestion', () => {
    it('sets selected monsters when generator applies suggestions', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      const generateBtn = screen.getByText('Generate');
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByTestId('encounter-generator-modal')).toBeInTheDocument();
      });

      const applyBtn = screen.getByTestId('generator-apply');
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(screen.getByTestId('selected-item-suggested-goblin')).toBeInTheDocument();
      });
    });
  });

  describe('setViewingMonster (monster card modal)', () => {
    it('opens and closes the monster card modal when details button is clicked', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      const detailsBtn = screen.getByTestId('details-btn-goblin');
      fireEvent.click(detailsBtn);

      await waitFor(() => {
        expect(screen.getByTestId('monster-card-modal')).toBeInTheDocument();
      });

      const closeBtn = screen.getByTestId('monster-card-close');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('description editing', () => {
    it('updates description when textarea changes', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      const textarea = screen.getByTestId('description-textarea');
      fireEvent.change(textarea, { target: { value: 'Goblins ambush at dawn.' } });
      expect(textarea.value).toBe('Goblins ambush at dawn.');
    });
  });

  describe('filteredMonsters - selected monster preservation', () => {
    it('keeps selected monsters visible even when they dont match current filters', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      const checkbox = screen.getByTestId('monster-checkbox-goblin');
      fireEvent.click(checkbox);
      expect(screen.getByTestId('monster-row-goblin')).toBeInTheDocument();

      const typeFilter = screen.getByTestId('type-filter');
      fireEvent.change(typeFilter, { target: { value: 'dragon' } });

      expect(screen.getByTestId('monster-row-goblin')).toBeInTheDocument();
      expect(screen.getByTestId('monster-row-dragon')).toBeInTheDocument();
    });
  });

  describe('encounter title display', () => {
    it('shows default title and dragon icon before loading an encounter', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
      const icon = document.querySelector('.fa-solid.fa-dragon');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('party summary display', () => {
    it('shows party members with levels when characters are provided', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      expect(screen.getByText('Thorin')).toBeInTheDocument();
      expect(screen.getByText('Lv5')).toBeInTheDocument();
      expect(screen.getByText('Elara')).toBeInTheDocument();
      expect(screen.getByText('Lv3')).toBeInTheDocument();
      const icon = document.querySelector('.fa-solid.fa-users');
      expect(icon).toBeInTheDocument();
    });

    it('shows no-chars message when characters array is empty', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={[]} onJoinEncounter={vi.fn()} />);

      expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    });

    it('shows no-chars message when characters is null', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={null} onJoinEncounter={vi.fn()} />);

      expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    });
  });

  describe('action buttons visibility', () => {
    it('renders Save, Load, and Generate buttons by default, and hides Reset when no encounter is loaded', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Load')).toBeInTheDocument();
      expect(screen.getByText('Generate')).toBeInTheDocument();
      expect(screen.queryByText('Reset')).not.toBeInTheDocument();
    });
  });

  describe('generator modal', () => {
    it('opens and closes the generator modal', async () => {
      const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
      useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

      const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
      useEncounterManagement.mockReturnValue({
        modalOpen: false, modalMode: null, encounters: [], loading: false,
        openSaveModal: vi.fn(), openLoadModal: vi.fn(), closeModal: vi.fn(),
        saveEncounter: vi.fn(), updateEncounter: vi.fn(), loadEncounterData: vi.fn(),
        deleteEncounterAction: vi.fn(), renameEncounterAction: vi.fn(),
      });

      render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);

      const generateBtn = screen.getByText('Generate');
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByTestId('encounter-generator-modal')).toBeInTheDocument();
      });

      const closeBtn = screen.getByTestId('generator-close');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('encounter-generator-modal')).not.toBeInTheDocument();
      });
    });
  });
});
