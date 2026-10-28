// @maintained-by-ai
/* Lane — update-save named overwrite confirm + toast honesty (bug-eb-update-save-silent-overwrite).
 * The toolbar Save lane with a loaded encounter (currentEncounterName set) must gate its PUT
 * behind a NAMED native confirm — house canon for durable-data mutations (row delete confirms
 * `Delete "X"?` at EncounterModal.jsx:68, level-change, character/map deletes) — and toast the
 * honest `Encounter updated` copy on success. Cancel = zero network, draft + disk untouched.
 * The create lane (name-modal path) NEVER sees the confirm and keeps `Encounter saved`.
 * Ownership: confirm placement/copy + both toast copies pinned here; delete single-confirm count
 * stays owned by delete-confirmation.test.jsx; empty-draft gate by empty-save-gate.test.jsx.
 * Seam mocks mirror toast.test.jsx (management hook, heavy modals, network services severed);
 * encountersService is REAL so formatEncounterName bytes are pinned for real. */
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
  default: () => <div data-testid="encounter-summary-panel" />,
}));

vi.mock('./EncounterMonsterTable.jsx', () => ({
  default: (props) => (
    <div data-testid="encounter-monster-table">
      {props.filteredMonsters?.map((monster) => (
        <div key={monster.index} data-testid={`monster-row-${monster.index}`}>
          <input
            type="checkbox"
            data-testid={`monster-checkbox-${monster.index}`}
            checked={props.selectedMonsters.some((m) => m.index === monster.index)}
            onChange={() => props.onToggleMonster(monster)}
          />
        </div>
      ))}
    </div>
  ),
}));

vi.mock('./EncounterSelectedMonsters.jsx', () => ({ default: () => null }));

// Minimal stand-in mirroring EncounterModal's real contract (same as toast.test.jsx):
// save mode exposes a confirm button wired to onSave, load mode one row button per encounter.
vi.mock('./EncounterModal.jsx', () => ({
  default: (props) => {
    if (!props.isOpen) return null;
    return (
      <div data-testid="encounter-modal">
        {props.mode === 'save' && (
          <button data-testid="modal-save" onClick={() => props.onSave('qa-update-bug')}>
            Save
          </button>
        )}
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
  default: () => <textarea data-testid="description-textarea" />,
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

const CAMPAIGN = 'test-campaign';
const CONFIRM_COPY = 'Overwrite encounter "Qa Update Bug"? This replaces the saved encounter.';

const sampleMonsters = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid' },
];

function createManagement(overrides = {}) {
  let modalOpen = false;
  let modalMode = null;
  return {
    get modalOpen() { return modalOpen; },
    get modalMode() { return modalMode; },
    encounters: [{ name: 'qa-update-bug' }],
    loading: false,
    openSaveModal: vi.fn(() => { modalOpen = true; modalMode = 'save'; }),
    openLoadModal: vi.fn(() => { modalOpen = true; modalMode = 'load'; }),
    closeModal: vi.fn(() => { modalOpen = false; modalMode = null; }),
    saveEncounter: vi.fn().mockResolvedValue(undefined),
    updateEncounter: vi.fn().mockResolvedValue(undefined),
    loadEncounterData: vi.fn().mockResolvedValue({
      selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 1 }],
      description: '',
      effectiveXP: 50,
    }),
    deleteEncounterAction: vi.fn(),
    renameEncounterAction: vi.fn(),
    ...overrides,
  };
}

function renderBuilder(overrides) {
  const management = createManagement(overrides);
  useMonstersData.mockReturnValue({ monsters: sampleMonsters.map(m => ({ ...m })), loading: false });
  useEncounterManagement.mockReturnValue(management);
  render(<EncounterBuilder campaignName={CAMPAIGN} characters={[{ name: 'Thorin', level: 5 }]} />);
  return management;
}

const toastNode = () => document.querySelector('.encounter-toast');

// Toggle a checkbox to force a re-render so the getter-driven modal flags refresh
// (same trick as toast.test.jsx).
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function clickLoadRow() {
  fireEvent.click(screen.getByLabelText('Load encounter'));
  // Management mock drives modal visibility via getters — force a re-render.
  fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
  // Undo that toggle so the draft mirrors the loaded row only.
  fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
  await waitFor(() => expect(screen.getByTestId('load-encounter-qa-update-bug')).toBeInTheDocument());
  fireEvent.click(screen.getByTestId('load-encounter-qa-update-bug'));
  await waitFor(() => expect(screen.getByTitle('Update encounter')).toBeInTheDocument());
}

describe('EncounterBuilder — update-save named overwrite confirm (bug-eb-update-save-silent-overwrite)', () => {
  it('cancel leg: confirm shown with the named copy, then aborts — no updateEncounter call, no toast, title stays armed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const management = renderBuilder();
    await clickLoadRow();
    // Let the rig's own "Encounter loaded" toast auto-hide (2.5s display timer)
    // so the cancel-leg can prove ZERO toast afterwards.
    await waitFor(() => expect(toastNode()).not.toBeInTheDocument(), { timeout: 4000 });

    fireEvent.click(screen.getByTitle('Update encounter'));

    // Exact byte-pinned named confirm (real formatEncounterName: 'qa-update-bug' → 'Qa Update Bug').
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(CONFIRM_COPY);
    // Cancel = zero network, zero toast (nothing happened).
    expect(management.updateEncounter).not.toHaveBeenCalled();
    expect(management.saveEncounter).not.toHaveBeenCalled();
    expect(toastNode()).not.toBeInTheDocument();
    // Draft untouched: the toolbar still represents the same loaded encounter.
    expect(screen.getByTitle('Update encounter')).toBeInTheDocument();
  });

  it('accept leg: confirm once → updateEncounter called exactly once → toast reads "Encounter updated"', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const management = renderBuilder();
    await clickLoadRow();

    fireEvent.click(screen.getByTitle('Update encounter'));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(CONFIRM_COPY);
    await waitFor(() => expect(management.updateEncounter).toHaveBeenCalledTimes(1));
    expect(management.updateEncounter).toHaveBeenCalledWith('qa-update-bug', expect.objectContaining({
      selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 1 }],
    }));
    await waitFor(() => expect(toastNode()).toHaveTextContent('Encounter updated'));
    // Toast honesty: update never borrows the create copy.
    expect(toastNode()).not.toHaveTextContent('Encounter saved');
    expect(toastNode()).not.toHaveClass('encounter-toast-error');
  });

  it('create lane unaffected: toolbar Save with no loaded encounter opens the name modal with ZERO confirm, modal save toasts "Encounter saved"', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const management = renderBuilder();

    fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
    fireEvent.click(screen.getByLabelText('Save encounter'));

    await waitFor(() => expect(screen.getByTestId('modal-save')).toBeInTheDocument());
    // The create path never sees the overwrite confirm.
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(management.updateEncounter).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('modal-save'));

    await waitFor(() => expect(toastNode()).toHaveTextContent('Encounter saved'));
    expect(toastNode()).not.toHaveTextContent('Encounter updated');
    expect(management.saveEncounter).toHaveBeenCalledTimes(1);
    expect(management.updateEncounter).not.toHaveBeenCalled();
  });
});
