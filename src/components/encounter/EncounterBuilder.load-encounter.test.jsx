// @maintained-by-ai
/* Lane: loading a SAVED encounter into the builder — server GET boundary
 * (loadEncounterData) → state hydration: title/description/selected monsters
 * restored, bestiary-first ref resolution, effective-XP reconcile write-back,
 * and corrupt-response handling (null / rejection / empty roster). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import useEncounterManagement from '../../hooks/management/useEncounterManagement.js';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(() => ({ monsters: [], loading: false })),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', () => ({
  default: vi.fn(),
}));

vi.mock('./EncounterFilterPanel.jsx', () => ({
  default: () => <div data-testid="encounter-filter-panel" />,
}));

vi.mock('./EncounterSummaryPanel.jsx', () => ({
  default: (props) => (
    <div data-testid="encounter-summary-panel">
      <span data-testid="total-xp">{props.totalMonsterXP.toLocaleString()}</span>
      <span data-testid="monster-count">{props.monsterCount}</span>
      <span data-testid="effective-xp">{props.effectiveXP.toLocaleString()}</span>
    </div>
  ),
}));

vi.mock('./EncounterMonsterTable.jsx', () => ({
  default: (props) => (
    <div data-testid="encounter-monster-table">
      {props.filteredMonsters?.map((monster) => {
        const selected = props.selectedMonsters.find((m) => m.index === monster.index);
        return (
          <div key={monster.index} data-testid={`monster-row-${monster.index}`}>
            <input
              type="checkbox"
              data-testid={`monster-checkbox-${monster.index}`}
              checked={!!selected}
              onChange={() => props.onToggleMonster(monster)}
            />
            <span data-testid={`monster-name-${monster.index}`}>{monster.name}</span>
            {selected && selected.qty > 0 && (
              <span data-testid={`monster-qty-${monster.index}`}>{selected.qty}</span>
            )}
          </div>
        );
      })}
    </div>
  ),
}));

vi.mock('./EncounterSelectedMonsters.jsx', () => ({
  default: (props) => {
    if (!props.selectedMonsters || props.selectedMonsters.length === 0) return null;
    return (
      <div data-testid="encounter-selected-monsters">
        {props.selectedMonsters.map((monster) => (
          <div key={monster.index} data-testid={`selected-item-${monster.index}`}>
            <span data-testid={`selected-name-${monster.index}`}>{monster.name}</span>
            <span data-testid={`selected-xp-${monster.index}`}>
              {(monster.xp * (monster.qty || 1)).toLocaleString()} XP
            </span>
          </div>
        ))}
      </div>
    );
  },
}));

// Modal open/close is driven by plain-object state in the management mock, so
// the load button click must trigger a re-render via a real state update too —
// the goblin checkbox toggle in setupLoadFlow provides that render.
vi.mock('./EncounterModal.jsx', () => ({
  default: (props) => {
    if (!props.isOpen) return null;
    return (
      <div data-testid="encounter-modal">
        <button data-testid="modal-close" onClick={props.onClose}>Close</button>
        {props.mode === 'load' && props.encounters?.map((enc) => (
          <button
            key={enc.name}
            data-testid={`load-encounter-${enc.name}`}
            onClick={() => props.onLoad(enc.name)}
          >
            Load {enc.name}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: (props) => (
    <textarea
      data-testid="description-textarea"
      value={props.value || ''}
      onChange={(e) => props.onChange(e.target.value)}
    />
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => 0),
  setRuntimeValue: vi.fn(),
}));

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

  return {
    get modalOpen() { return modalOpen; },
    get modalMode() { return modalMode; },
    encounters: [{ name: 'test-encounter' }],
    loading: false,
    openSaveModal: vi.fn(),
    openLoadModal: vi.fn(() => { modalOpen = true; modalMode = 'load'; }),
    closeModal: vi.fn(() => { modalOpen = false; modalMode = null; }),
    saveEncounter: vi.fn(),
    updateEncounter: vi.fn(),
    loadEncounterData,
    deleteEncounterAction: vi.fn(),
    renameEncounterAction: vi.fn(),
    ...extra,
  };
}

function renderWithLoadEncounter(loadEncounterData, extra = {}) {
  useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });
  useEncounterManagement.mockReturnValue(createManagement(loadEncounterData, extra));

  render(<EncounterBuilder campaignName={mockCampaignName} characters={defaultCharacters} onJoinEncounter={vi.fn()} />);
}

// Opens the load modal and pre-selects a goblin (pre-load state) so hydrated
// output can be distinguished from leftovers, then clicks the saved encounter.
async function setupLoadFlow() {
  fireEvent.click(screen.getByText('Load'));
  fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));

  await waitFor(() => {
    expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId('load-encounter-test-encounter'));
}

describe('EncounterBuilder - handleLoadEncounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Silence the expected console.error on the rejection case (it is asserted
    // behaviorally via unchanged state below).
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates title, description, quantities, and XP from the saved encounter', async () => {
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
      expect(screen.getByText('Encounter: test-encounter')).toBeInTheDocument();
    });

    expect(screen.getByTestId('description-textarea').value).toBe('Ambush at dawn');
    // Resolved from the bestiary with saved quantities preserved.
    expect(screen.getByTestId('selected-name-goblin')).toHaveTextContent('Goblin');
    expect(screen.getByTestId('selected-xp-goblin')).toHaveTextContent('100 XP');
    expect(screen.getByTestId('selected-name-orc')).toHaveTextContent('Orc');
    expect(screen.getByTestId('selected-xp-orc')).toHaveTextContent('100 XP');
    expect(screen.getByTestId('monster-qty-goblin')).toHaveTextContent('2');
    expect(screen.getByTestId('total-xp')).toHaveTextContent('200');
    expect(screen.getByTestId('effective-xp')).toHaveTextContent('200');
  });

  it('falls back to stored ref data when a loaded monster is missing from the bestiary', async () => {
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
      expect(screen.getByTestId('selected-xp-unknown-monster')).toHaveTextContent('500 XP');
    });
    expect(screen.getByTestId('total-xp')).toHaveTextContent('500');
    expect(screen.getByTestId('effective-xp')).toHaveTextContent('500');
  });

  it.each([
    ['is stale and must be rewritten', 2, 200],
    ['is already accurate', 1, 50],
  ])('recomputes effective XP on load when the stored value %s', async (_label, qty, storedXP) => {
    const updateEncounter = vi.fn();
    const loadEncounterData = vi.fn().mockResolvedValue({
      selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty }],
      description: '',
      effectiveXP: storedXP,
    });

    await renderWithLoadEncounter(loadEncounterData, { updateEncounter });
    await setupLoadFlow();

    const recomputedXP = 50 * qty;
    await waitFor(() => {
      expect(screen.getByTestId('effective-xp')).toHaveTextContent(String(recomputedXP));
    });

    if (storedXP === recomputedXP) {
      expect(updateEncounter).not.toHaveBeenCalled();
    } else {
      expect(updateEncounter).toHaveBeenCalledWith('test-encounter', {
        selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty }],
        description: '',
        effectiveXP: recomputedXP,
      });
    }
  });

  it('clears stale description and keeps no selection when the stored roster is empty', async () => {
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

    expect(screen.getByText('Encounter: test-encounter')).toBeInTheDocument();
    expect(screen.queryByTestId('selected-item-goblin')).not.toBeInTheDocument();
    expect(screen.getByTestId('total-xp')).toHaveTextContent('0');
  });

  it.each([
    ['null', () => vi.fn().mockResolvedValue(null)],
    ['a rejection', () => vi.fn().mockRejectedValue(new Error('server unavailable'))],
  ])('preserves current title, description, and selection when the load returns %s', async (_label, makeLoad) => {
    const loadEncounterData = makeLoad();

    await renderWithLoadEncounter(loadEncounterData);
    await setupLoadFlow();

    await waitFor(() => {
      expect(loadEncounterData).toHaveBeenCalledWith('test-encounter');
    });

    expect(screen.getByTestId('selected-item-goblin')).toBeInTheDocument();
    expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    expect(screen.queryByText('Encounter: test-encounter')).not.toBeInTheDocument();
    expect(screen.getByTestId('description-textarea').value).toBe('');
  });
});
