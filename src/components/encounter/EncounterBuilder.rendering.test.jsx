// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import EncounterBuilder from './EncounterBuilder.jsx';

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

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
                {props.onViewDetails && (
                  <button
                    data-testid={`details-btn-${monster.index}`}
                    onClick={(e) => { e.stopPropagation(); props.onViewDetails(monster); }}
                  >
                    Details
                  </button>
                )}
              </>
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
  default: (props) => (
    <div data-testid="encounter-selected-monsters">
      {props.selectedMonsters && props.selectedMonsters.length > 0 && (() => {
        const totalMonsters = props.selectedMonsters.reduce((sum, m) => sum + (m.qty || 1), 0);
        return (
          <>
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
          </>
        );
      })()}
    </div>
  ),
}));

vi.mock('./EncounterModal.jsx', () => ({
  default: (props) => (
    <div data-testid="encounter-modal">
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
        </div>
      )}
    </div>
  ),
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

/* ------------------------------------------------------------------ */
/*  Runtime state mock — uses a shared object so tests can reset it   */
/* ------------------------------------------------------------------ */

const _runtimeState = {
  viewingMonster: null,
};

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn((key, prop, defaultValue) => {
    if (key === 'campaign' && prop === 'encounter-viewingMonster') {
      return [_runtimeState.viewingMonster, vi.fn((v) => { _runtimeState.viewingMonster = v; })];
    }
    return [defaultValue, vi.fn()];
  }),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => 0),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

/* ------------------------------------------------------------------ */
/*  Test data                                                         */
/* ------------------------------------------------------------------ */

const mockCampaignName = 'test-campaign';

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

// @cleaned-by-ai
describe('EncounterBuilder rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _runtimeState.viewingMonster = null;
  });

  describe('monster card modal visibility', () => {
    it('does not render monster card modal when viewingMonster is null', () => {
      render(<EncounterBuilder campaignName={mockCampaignName} />);
      expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
    });
  });
});
