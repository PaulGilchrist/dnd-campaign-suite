// @improved-by-ai
// @cleaned-by-ai
// Removed tests:
//   "does not show delete button when encounters list is empty" — tests mock
//     component conditional rendering (EncounterModal.jsx DOM), not the
//     handleDeleteEncounter handler behavior.  The handler tests the
//     window.confirm path; button visibility is a rendering concern.
//   "does not call renameEncounterAction when encounters list is empty" —
//     same as above: tests EncounterModal.jsx conditional rendering, not the
//     handleRenameEncounter handler.
//   "updates the filter environment state when environment select changes" —
//     only asserts DOM values on the mock EncounterFilterPanel component
//     (envSelect.value).  Does not verify that handleEnvironmentChange was
//     called or that the filter state actually changed.  Adds zero
//     behavioral confidence.
//   "calls closeModal when close button is clicked" — brittle: requires
//     clicking a monster checkbox to trigger a React re-render so that the
//     getter-based mock hook state (modalOpen getter) is picked up.  This is
//     an internal implementation detail of how the inline mock interacts with
//     the component, not an observable behavior.  The open/close modal flow
//     is already covered in panel-interactions.test.jsx and remaining.test.jsx.
//
// Kept (unique behavioral coverage):
//   "calls deleteEncounterAction when user confirms deletion" — tests the
//     positive window.confirm path for handleDeleteEncounter.
//   "does not call deleteEncounterAction when user cancels confirmation" —
//     tests the negative window.confirm path for handleDeleteEncounter.
//   "calls renameEncounterAction with old and new names when rename is clicked" —
//     the only test that exercises the handleRenameEncounter handler.
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

function createModalManagement(deleteFn = vi.fn(), renameFn = vi.fn()) {
  let modalOpen = false;
  let modalMode = null;
  const closeModalSpy = vi.fn(() => { modalOpen = false; modalMode = null; });

  return {
    get modalOpen() { return modalOpen; },
    get modalMode() { return modalMode; },
    encounters: [{ name: 'test-encounter' }],
    loading: false,
    openSaveModal: vi.fn(() => { modalOpen = true; modalMode = 'save'; }),
    openLoadModal: vi.fn(() => { modalOpen = true; modalMode = 'load'; }),
    closeModal: closeModalSpy,
    saveEncounter: vi.fn(),
    updateEncounter: vi.fn(),
    loadEncounterData: vi.fn(),
    deleteEncounterAction: deleteFn,
    renameEncounterAction: renameFn,
  };
}

async function renderWithManagement(management) {
  const { useMonstersData } = await import('../../hooks/ui/useMonstersData.js');
  useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });

  const { default: useEncounterManagement } = await import('../../hooks/management/useEncounterManagement.js');
  useEncounterManagement.mockReturnValue(management);

  render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);
}

async function openLoadModal(management) {
  const loadBtn = screen.getByText('Load');
  fireEvent.click(loadBtn);

  // Click a monster checkbox to trigger a React re-render so the component
  // picks up the getter-based hook state (modalOpen/modalMode are getters,
  // not useState).  Without this the modal DOM won't appear because React
  // won't re-render after openLoadModal mutates the management object.
  const checkbox = screen.getByTestId('monster-checkbox-goblin');
  fireEvent.click(checkbox);

  await waitFor(() => {
    expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
  });

  return management;
}

describe('EncounterBuilder - encounter management handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('handleDeleteEncounter', () => {
    it('calls deleteEncounterAction when user confirms deletion', async () => {
      const deleteFn = vi.fn().mockResolvedValue(undefined);
      global.window.confirm = vi.fn(() => true);

      const management = createModalManagement(deleteFn);
      await renderWithManagement(management);
      await openLoadModal(management);

      const deleteBtn = screen.getByTestId('delete-encounter-test-encounter');
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(deleteFn).toHaveBeenCalledWith('test-encounter');
      });
    });

    it('does not call deleteEncounterAction when user cancels confirmation', async () => {
      const deleteFn = vi.fn();
      global.window.confirm = vi.fn(() => false);

      const management = createModalManagement(deleteFn);
      await renderWithManagement(management);
      await openLoadModal(management);

      const deleteBtn = screen.getByTestId('delete-encounter-test-encounter');
      fireEvent.click(deleteBtn);

      expect(deleteFn).not.toHaveBeenCalled();
    });
  });

  describe('handleRenameEncounter', () => {
    it('calls renameEncounterAction with old and new names when rename is clicked', async () => {
      const renameFn = vi.fn().mockResolvedValue(undefined);

      const management = createModalManagement(vi.fn(), renameFn);
      await renderWithManagement(management);
      await openLoadModal(management);

      const renameBtn = screen.getByTestId('rename-encounter-test-encounter');
      fireEvent.click(renameBtn);

      await waitFor(() => {
        expect(renameFn).toHaveBeenCalledWith('test-encounter', 'Renamed Encounter');
      });
    });
  });
});
