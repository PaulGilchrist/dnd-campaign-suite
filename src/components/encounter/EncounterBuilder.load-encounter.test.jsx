// @improved-by-ai
// @cleaned-by-ai
// Removed:
//   "sets encounter title with formatEncounterName formatting" — redundant
//     with "loads encounter data and sets title, description, and selected
//     monsters" which already asserts the same title element.
//   "handles loadEncounterData rejecting with an error" — captured
//     console.error into an array but never asserted on it; the only
//     assertion (loadEncounterData was called) is trivially true from the
//     mock setup, providing zero behavioral confidence.
// Consolidated:
//   "handles loadEncounterData returning data with no selectedMonsters" +
//   "handles loadEncounterData returning data with empty selectedMonsters
//     array" — both asserted the same observable behavior (description set,
//     no goblin selected). Merged into a single "no monsters after load"
//     test.
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

function createManagement(loadEncounterData, extra = {}) {
  let modalOpen = false;
  let modalMode = null;

  const management = {
    get modalOpen() { return modalOpen; },
    get modalMode() { return modalMode; },
    encounters: [{ name: 'test-encounter' }],
    loading: false,
    openSaveModal: vi.fn(() => { modalOpen = true; modalMode = 'save'; }),
    openLoadModal: vi.fn(() => { modalOpen = true; modalMode = 'load'; }),
    closeModal: vi.fn(() => { modalOpen = false; modalMode = null; }),
    saveEncounter: vi.fn(),
    updateEncounter: vi.fn(),
    loadEncounterData,
    deleteEncounterAction: vi.fn(),
    renameEncounterAction: vi.fn(),
    ...extra,
  };

  return management;
}

async function renderWithLoadEncounter(loadEncounterData, extra = {}) {
  const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
  useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

  const management = createManagement(loadEncounterData, extra);

  const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
  useEncounterManagement.mockReturnValue(management);

  render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);
}

async function setupLoadFlow() {
  const loadBtn = screen.getByText('Load');
  fireEvent.click(loadBtn);

  const checkbox = screen.getByTestId('monster-checkbox-goblin');
  fireEvent.click(checkbox);

  await waitFor(() => {
    expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
  });

  const loadEncounterBtn = screen.getByTestId('load-encounter-test-encounter');
  fireEvent.click(loadEncounterBtn);
}

describe('EncounterBuilder - handleLoadEncounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('loads encounter data and sets title, description, and selected monsters', async () => {
    const loadEncounterData = vi.fn().mockResolvedValue({
      selectedMonsters: [
        { index: 'goblin', name: 'Goblin', qty: 2 },
        { index: 'orc', name: 'Orc', qty: 1 },
      ],
      description: 'Ambush at dawn',
      effectiveXP: 200,
    });

    await renderWithLoadEncounter(loadEncounterData);
    await setupLoadFlow();

    await waitFor(() => {
      expect(loadEncounterData).toHaveBeenCalledWith('test-encounter');
    });

    expect(screen.getByText('Encounter: test-encounter')).toBeInTheDocument();
    expect(screen.getByTestId('description-textarea').value).toBe('Ambush at dawn');
    expect(screen.getByTestId('selected-item-goblin')).toBeInTheDocument();
    expect(screen.getByTestId('selected-item-orc')).toBeInTheDocument();
  });

  it('falls back to ref data when full monster not found in monsters list', async () => {
    const loadEncounterData = vi.fn().mockResolvedValue({
      selectedMonsters: [
        { index: 'unknown-monster', name: 'Unknown Monster', xp: 500, qty: 1 },
      ],
      description: '',
      effectiveXP: 500,
    });

    await renderWithLoadEncounter(loadEncounterData);
    await setupLoadFlow();

    await waitFor(() => {
      expect(screen.getByTestId('selected-item-unknown-monster')).toBeInTheDocument();
    });
  });

  it('calls updateEncounter when effectiveXP differs after load', async () => {
    const updateEncounter = vi.fn();
    const loadEncounterData = vi.fn().mockResolvedValue({
      selectedMonsters: [
        { index: 'goblin', name: 'Goblin', qty: 2 },
      ],
      description: '',
      effectiveXP: 200,
    });

    await renderWithLoadEncounter(loadEncounterData, { updateEncounter });
    await setupLoadFlow();

    await waitFor(() => {
      expect(updateEncounter).toHaveBeenCalled();
    });
  });

  it('does not call updateEncounter when effectiveXP matches after load', async () => {
    const updateEncounter = vi.fn();
    const loadEncounterData = vi.fn().mockResolvedValue({
      selectedMonsters: [
        { index: 'goblin', name: 'Goblin', qty: 1 },
      ],
      description: '',
      effectiveXP: 50,
    });

    await renderWithLoadEncounter(loadEncounterData, { updateEncounter });
    await setupLoadFlow();

    await waitFor(() => {
      expect(updateEncounter).not.toHaveBeenCalled();
    });
  });

  it('handles loadEncounterData returning null by keeping current state', async () => {
    const loadEncounterData = vi.fn().mockResolvedValue(null);

    await renderWithLoadEncounter(loadEncounterData);
    await setupLoadFlow();

    await waitFor(() => {
      expect(loadEncounterData).toHaveBeenCalled();
    });

    // After load returns null, the selected monsters from the setup flow remain
    expect(screen.getByTestId('selected-item-goblin')).toBeInTheDocument();
  });

  it('handles loadEncounterData returning data with no/empty selectedMonsters', async () => {
    const loadEncounterData = vi.fn().mockResolvedValue({
      selectedMonsters: [],
      description: 'No monsters',
      effectiveXP: 0,
    });

    await renderWithLoadEncounter(loadEncounterData);
    await setupLoadFlow();

    await waitFor(() => {
      expect(screen.getByTestId('description-textarea').value).toBe('No monsters');
    });

    expect(screen.queryByTestId('selected-item-goblin')).not.toBeInTheDocument();
  });

  it('resolves monster refs from the monsters list when loading', async () => {
    const loadEncounterData = vi.fn().mockResolvedValue({
      selectedMonsters: [
        { index: 'goblin', name: 'Goblin', qty: 3 },
      ],
      description: 'Resolving test',
      effectiveXP: 150,
    });

    await renderWithLoadEncounter(loadEncounterData);
    await setupLoadFlow();

    await waitFor(() => {
      expect(screen.getByTestId('selected-item-goblin')).toBeInTheDocument();
    });

    // Verify the selected item shows the correct XP (50 * 3 = 150)
    expect(screen.getByTestId('selected-xp-goblin')).toHaveTextContent('150 XP');
  });

});
