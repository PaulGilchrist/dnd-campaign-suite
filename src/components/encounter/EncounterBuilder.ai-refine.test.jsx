// @maintained-by-ai
/* Lane: AI-refine on a SAVED encounter (campaign-authoring Phase 6 residual).
 * The proposal lands in the working draft — selected monsters re-resolve from
 * the bestiary, description updates, and NOTHING is persisted: the toolbar
 * Update (updateEncounter lane) stays the only path to disk. The button only
 * exists on the saved-encounter editing surface. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import useEncounterManagement from '../../hooks/management/useEncounterManagement.js';
import { refineEntity } from '../../services/ai/aiClient.js';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(() => ({ monsters: [], loading: false })),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../services/ai/aiClient.js', () => ({
  refineEntity: vi.fn(),
}));

vi.mock('./EncounterFilterPanel.jsx', () => ({
  default: () => <div data-testid="encounter-filter-panel" />,
}));

vi.mock('./EncounterSummaryPanel.jsx', () => ({
  default: () => <div data-testid="encounter-summary-panel" />,
}));

vi.mock('./EncounterMonsterTable.jsx', () => ({
  default: (props) => (
    <div data-testid="encounter-monster-table">
      {props.filteredMonsters?.map((monster) => (
        <div key={monster.index}>
          <input
            type="checkbox"
            data-testid={`monster-checkbox-${monster.index}`}
            onChange={() => props.onToggleMonster(monster)}
          />
        </div>
      ))}
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
            <span data-testid={`selected-qty-${monster.index}`}>{monster.qty}</span>
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

const sampleMonsters = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] },
  { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, type: 'humanoid', environments: ['hill'] },
];

// Load-hydrated XP matches the mocked calculators (100 threshold, ×1 mult) so
// the load lane never fires its effective-XP write-back — any updateEncounter
// call seen below can ONLY come from a persistence bug.
const SAVED_ROW = {
  name: 'test-encounter',
  description: 'Cave ambush',
  selectedMonsters: [{ index: 'orc', name: 'Orc', qty: 2 }],
  effectiveXP: 200,
};

function createManagement() {
  let modalOpen = false;
  let modalMode = null;
  return {
    get modalOpen() { return modalOpen; },
    get modalMode() { return modalMode; },
    encounters: [{ name: SAVED_ROW.name }],
    loading: false,
    openSaveModal: vi.fn(),
    openLoadModal: vi.fn(() => { modalOpen = true; modalMode = 'load'; }),
    closeModal: vi.fn(() => { modalOpen = false; modalMode = null; }),
    saveEncounter: vi.fn(),
    updateEncounter: vi.fn(),
    loadEncounterData: vi.fn(async () => SAVED_ROW),
    deleteEncounterAction: vi.fn(),
    renameEncounterAction: vi.fn(),
  };
}

let mgmt;

async function loadSavedEncounter() {
  fireEvent.click(screen.getByText('Load'));
  fireEvent.click(screen.getByTestId('monster-checkbox-goblin')); // render nudge
  await waitFor(() => expect(screen.getByTestId('encounter-modal')).toBeInTheDocument());
  fireEvent.click(screen.getByTestId('load-encounter-test-encounter'));
  await waitFor(() => expect(screen.getByTestId('selected-item-orc')).toBeInTheDocument());
}

beforeEach(() => {
  mgmt = createManagement();
  useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });
  useEncounterManagement.mockReturnValue(mgmt);
  refineEntity.mockReset();
  localStorage.clear();
  render(<EncounterBuilder campaignName="test-campaign" characters={[{ name: 'Thorin', level: 5 }]} onJoinEncounter={vi.fn()} />);
});

afterEach(cleanup);

describe('EncounterBuilder AI refine (saved-encounter surface)', () => {
  it('offers the refine button only once a saved encounter is loaded', async () => {
    expect(screen.queryByRole('button', { name: /refine with AI/i })).toBeNull();
    await loadSavedEncounter();
    expect(screen.getByRole('button', { name: /refine with AI/i })).toBeTruthy();
  });

  it('proposes into the draft: entity carries the saved row, replacement re-resolves bestiary rows, nothing is saved', async () => {
    await loadSavedEncounter();
    fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
    fireEvent.change(screen.getByPlaceholderText(/what should change/i), { target: { value: 'swarm them' } });

    refineEntity.mockResolvedValue({
      ok: true,
      replacement: {
        name: 'test-encounter',
        description: 'A drowning swarm',
        selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 3 }],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply to form/i }));

    await waitFor(() => expect(refineEntity).toHaveBeenCalledWith({
      campaignName: 'test-campaign',
      kind: 'encounter',
      instruction: 'swarm them',
      // Builder-preset shape: name-keyed row + stripped monster refs.
      entity: {
        name: 'test-encounter',
        description: 'Cave ambush',
        selectedMonsters: [{ index: 'orc', name: 'Orc', qty: 2 }],
      },
    }));

    // Proposal hydrated into the draft: bestiary row resolved (xp rides along
    // for the XP math), description replaced, and the honest "you still save"
    // toast. Persistence untouched — Update stays the only write lane.
    await waitFor(() => expect(screen.getByTestId('selected-item-goblin')).toBeInTheDocument());
    expect(screen.queryByTestId('selected-item-orc')).toBeNull();
    expect(screen.getByTestId('selected-qty-goblin').textContent).toBe('3');
    expect(screen.getByTestId('description-textarea').value).toBe('A drowning swarm');
    expect(screen.getByRole('status').textContent).toMatch(/press update to save/i);
    expect(mgmt.updateEncounter).not.toHaveBeenCalled();
    expect(mgmt.saveEncounter).not.toHaveBeenCalled();
  });

  it('surfaces refine errors inline and leaves the draft untouched', async () => {
    await loadSavedEncounter();
    fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
    fireEvent.change(screen.getByPlaceholderText(/what should change/i), { target: { value: 'do it' } });
    refineEntity.mockResolvedValue({ ok: false, errors: ['index not bestiary'] });
    fireEvent.click(screen.getByRole('button', { name: /apply to form/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('index not bestiary');
    expect(screen.getByTestId('selected-item-orc')).toBeInTheDocument();
    expect(screen.getByTestId('description-textarea').value).toBe('Cave ambush');
  });
});
