// @improved-by-ai
// @cleaned-by-ai
// Removed redundant tests that duplicate interactions.test.jsx and remaining.test.jsx:
//   "selects a monster when its checkbox is clicked" — duplicate of interactions.test.jsx
//     "toggles a monster on when checkbox is clicked" (identical setup, same assertions).
//   "deselects a monster when its checkbox is clicked again" — duplicate of interactions.test.jsx
//     "toggles a monster off when checkbox is clicked again" (identical flow, same assertions).
//   "selects multiple monsters independently" — duplicate of interactions.test.jsx
//     "toggles a monster on when checkbox is clicked" + selection assertions cover this.
//   "increases quantity when + button is clicked" — duplicate of interactions.test.jsx
//     "increases quantity when + button is clicked" (identical assertions).
//   "decreases quantity when - button is clicked" — duplicate of interactions.test.jsx
//     "decreases quantity when - button is clicked" (identical assertions).
//   "is not rendered when no monsters are selected" (selected monsters panel) — duplicate
//     of remaining.test.jsx "hides selected monsters panel when no monsters are selected".
//   "is rendered when at least one monster is selected" (selected monsters panel) —
//     duplicate of interactions.test.jsx "shows selected monsters in the selected monsters panel".
//   "shows correct individual monster XP (unit XP * qty)" — duplicate of remaining.test.jsx
//     "shows correct XP for a monster with qty > 1" (identical assertion: 150 XP).
//   "shows correct total monster count (sum of all quantities)" — duplicate of remaining.test.jsx
//     "shows correct total count for multiple monsters" (identical assertion: 3).
//   "updates total count when quantity changes" — duplicate of remaining.test.jsx
//     "updates monster count when quantity changes" (identical assertion flow).
//   "shows zero totals when no monsters are selected" (summary panel) — duplicate of
//     remaining.test.jsx "shows 0 total XP when no monsters selected" + "shows 0 monster count".
//   "updates total XP when a monster is selected" — duplicate of remaining.test.jsx
//     "updates total XP when a monster is selected" (identical assertion: 50).
//   "updates total XP when monster quantity increases" — duplicate of remaining.test.jsx
//     "updates effective XP when monsters are selected" (identical assertion: 100).
//   "updates monster count when a monster is selected" — duplicate of remaining.test.jsx
//     "shows 0 monster count when no monsters selected" + "updates monster count when quantity
//     changes" already cover this.
//   "updates effective XP based on difficulty multiplier" — duplicate of remaining.test.jsx
//     "updates effective XP when monsters are selected" (identical assertion: 50).
//   "shows difficulty label based on effective XP vs threshold" — duplicate of remaining.test.jsx
//     "updates difficulty label based on effective XP" (identical assertion: "Hard").
//   "applies selected class to row when monster is selected" — duplicate of interactions.test.jsx
//     "toggles a monster on when checkbox is clicked" (row selection is an implementation detail).
//   "removes selected class from row when monster is deselected" — duplicate of interactions.test.jsx
//     "toggles a monster off when checkbox is clicked again" (same behavioral coverage).
//   "is not rendered when no monsters are selected" (join encounter) — duplicate of
//     remaining.test.jsx "does not show Join Encounter button when no monsters are selected".
//   "is rendered when at least one monster is selected" (join encounter) — duplicate of
//     remaining.test.jsx "shows Join Encounter button when monsters are selected".
//   "renders save button with correct label" — trivial rendering check, already verified by
//     the mount() call succeeding in every other test.
//   "renders load button" — trivial rendering check, already verified by the mount() call.
//   "renders generate button" — trivial rendering check, already verified by the mount() call.
//   "does not render reset button when no encounter is loaded" — duplicate of
//     interactions.test.jsx "does not render reset button when no encounter is loaded".
//   "updates description value when textarea changes" — duplicate of remaining.test.jsx
//     "updates description when textarea changes" (identical assertion).
//   "does not render generator modal when not opened" — duplicate of interactions.test.jsx
//     "does not render generator modal when not opened" (identical assertion).
//   "renders generator modal when generate button is clicked" — duplicate of interactions.test.jsx
//     "renders generator modal when generate button is clicked" (identical assertions).
//   "does not render monster card modal when no monster is being viewed" — duplicate of
//     interactions.test.jsx "does not render monster card modal when no monster is being viewed"
//     (identical assertion).
//   "displays sort field and direction in the monster table" — duplicate of interactions.test.jsx
//     "sorts by name ascending by default" (identical assertions: "name" + "asc").
//
// Kept (unique behavioral coverage):
//   "deselects a monster when quantity is decreased to zero" — tests qty→0 removal path not
//     covered in interactions.test.jsx (which starts at qty=1 and decreases, but does not
//     verify the checkbox state and qty element removal together).
//   "removes a monster when remove button is clicked from the table row" — tests table-row
//     remove button path (orc) not covered in interactions.test.jsx (which uses goblin).
//   "removes a monster when remove button is clicked from the selected panel" — tests selected
//     panel remove button path (orc) with checkbox state assertion, not covered in
//     interactions.test.jsx (which uses goblin and has different assertions).
//   "shows Clear All button when monsters are selected" — unique visibility test.
//   "hides Clear All button when no monsters are selected" — unique visibility test.
//   "clears all selected monsters when Clear All is clicked" — unique multi-monster Clear All
//     flow with checkbox state verification.
//   "shows qty controls for selected monsters" — unique visibility test for qty controls.
//   "hides qty controls for unselected monsters" — unique visibility test for qty controls.
//   "renders monster card modal when details button is clicked" — unique positive assertion
//     for monster card modal rendering with name verification.
//   "closes monster card modal when close button is clicked" — unique close flow test.
//   "starts with empty description" — unique initial state test (value === '').
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

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
  loadEncounterToInitiative: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  calculateXPThreshold: vi.fn(() => 100),
  calculateDifficultyMultiplier: vi.fn((count, partySize) => {
    const ratio = count / (partySize || 1);
    if (ratio <= 0.5) return 1;
    if (ratio <= 1) return 1.5;
    if (ratio <= 2) return 2;
    return 2.5;
  }),
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

import { mount } from './EncounterBuilder.test-utils.jsx';

describe('EncounterBuilder interactions - panels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('monster selection and deselection', () => {
    it('deselects a monster when quantity is decreased to zero', async () => {
      await mount();
      const checkbox = screen.getByTestId('monster-checkbox-goblin');

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);

      const decBtn = screen.getByTestId('decrease-qty-goblin');
      fireEvent.click(decBtn);

      expect(checkbox.checked).toBe(false);
      expect(screen.queryByTestId('selected-item-goblin')).not.toBeInTheDocument();
      expect(screen.queryByTestId('monster-qty-goblin')).not.toBeInTheDocument();
    });

    it('removes a monster when remove button is clicked from the table row', async () => {
      await mount();
      const checkbox = screen.getByTestId('monster-checkbox-orc');

      fireEvent.click(checkbox);
      expect(screen.getByTestId('selected-item-orc')).toBeInTheDocument();

      const removeBtn = screen.getByTestId('remove-monster-orc');
      fireEvent.click(removeBtn);

      expect(checkbox.checked).toBe(false);
      expect(screen.queryByTestId('selected-item-orc')).not.toBeInTheDocument();
    });

    it('removes a monster when remove button is clicked from the selected panel', async () => {
      await mount();
      const checkbox = screen.getByTestId('monster-checkbox-orc');

      fireEvent.click(checkbox);

      const removeSelected = screen.getByTestId('remove-selected-orc');
      fireEvent.click(removeSelected);

      expect(screen.queryByTestId('selected-item-orc')).not.toBeInTheDocument();
      expect(screen.queryByTestId('monster-checkbox-orc')).toHaveProperty('checked', false);
    });
  });

  describe('quantity controls', () => {
    // Quantity increase/decrease flows are covered in interactions.test.jsx
    // These visibility tests are unique to this file.
    it('shows qty controls for selected monsters', async () => {
      await mount();
      const checkbox = screen.getByTestId('monster-checkbox-goblin');

      fireEvent.click(checkbox);

      expect(screen.getByTestId('increase-qty-goblin')).toBeInTheDocument();
      expect(screen.getByTestId('decrease-qty-goblin')).toBeInTheDocument();
      expect(screen.getByTestId('remove-monster-goblin')).toBeInTheDocument();
    });

    it('hides qty controls for unselected monsters', async () => {
      await mount();
      expect(screen.queryByTestId('increase-qty-orc')).not.toBeInTheDocument();
      expect(screen.queryByTestId('decrease-qty-orc')).not.toBeInTheDocument();
      expect(screen.queryByTestId('remove-monster-orc')).not.toBeInTheDocument();
    });
  });

  // Selected monsters panel tests (visibility, XP, count) are covered in
  // interactions.test.jsx and remaining.test.jsx.  Clear All flow tests are
  // in the summary panel section above.

  describe('summary panel', () => {
    // XP totals, monster count, effective XP, and difficulty label tests are covered in
    // interactions.test.jsx and remaining.test.jsx.  Only Clear All visibility/flow tests
    // are unique to this file.
    it('shows Clear All button when monsters are selected', async () => {
      await mount();
      const checkbox = screen.getByTestId('monster-checkbox-goblin');

      fireEvent.click(checkbox);

      expect(screen.getByTestId('clear-all')).toBeInTheDocument();
    });

    it('hides Clear All button when no monsters are selected', async () => {
      await mount();
      expect(screen.queryByTestId('clear-all')).not.toBeInTheDocument();
    });

    it('clears all selected monsters when Clear All is clicked', async () => {
      await mount();
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
      expect(screen.queryByTestId('clear-all')).not.toBeInTheDocument();
      expect(goblinCheckbox.checked).toBe(false);
      expect(orcCheckbox.checked).toBe(false);
    });
  });

  // Monster row selection CSS class tests are an implementation detail already
  // covered by interactions.test.jsx toggle tests.  Qty controls visibility
  // tests are in the quantity controls section above.

  // Join encounter visibility tests are covered in remaining.test.jsx
  // ("does not show Join Encounter button when no monsters are selected"
  //  and "shows Join Encounter button when monsters are selected").

  // Trivial rendering checks (save/load/generate/reset buttons exist) are
  // already verified by the mount() call succeeding in every other test.
  // The interactions.test.jsx "does not render reset button when no encounter
  // is loaded" test provides the only meaningful assertion.

  // Description value update test is covered in remaining.test.jsx "updates
  // description when textarea changes".  Only the initial empty state is unique here.
  //
  // Generator modal open/close tests are covered in interactions.test.jsx
  // ("does not render generator modal when not opened" and "renders generator
  // modal when generate button is clicked" with identical assertions).

  describe('description textarea', () => {
    // Value update test is covered in remaining.test.jsx.  Only initial empty state is unique.
    it('starts with empty description', async () => {
      await mount();
      const textarea = screen.getByTestId('description-textarea');
      expect(textarea.value).toBe('');
    });
  });

  describe('monster card modal', () => {
    // "does not render when no monster is being viewed" is covered in
    // interactions.test.jsx.  The open/close flow tests below are unique.
    it('renders monster card modal when details button is clicked', async () => {
      await mount();
      const checkbox = screen.getByTestId('monster-checkbox-goblin');

      fireEvent.click(checkbox);

      const detailsBtn = screen.getByTestId('details-btn-goblin');
      fireEvent.click(detailsBtn);

      expect(screen.getByTestId('monster-card-modal')).toBeInTheDocument();
      expect(screen.getByTestId('monster-card-name')).toHaveTextContent('Goblin');
    });

    it('closes monster card modal when close button is clicked', async () => {
      await mount();
      const checkbox = screen.getByTestId('monster-checkbox-goblin');

      fireEvent.click(checkbox);

      const detailsBtn = screen.getByTestId('details-btn-goblin');
      fireEvent.click(detailsBtn);

      expect(screen.getByTestId('monster-card-modal')).toBeInTheDocument();

      const closeBtn = screen.getByTestId('monster-card-close');
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
    });
  });

  // Sort field/direction display is covered in interactions.test.jsx
  // ("sorts by name ascending by default" with identical assertions).
});
