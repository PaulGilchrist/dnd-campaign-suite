// @maintained-by-ai
/* Lane: empty-draft save gate (backlog 2026-10-24 — EB saved zero-monster
 * encounters with effectiveXP 0 and toast-confirmed them). Clicking
 * "Save encounter" (and the "Update encounter" leg) with zero drafted monsters
 * now shows a visible inline error on the existing .encounter-modal-error
 * class and never opens the name modal nor POSTs /encounters — the same
 * validate-with-error UX as EncounterModal's "Encounter name is required" and
 * MapsManager's "Map name cannot be empty". With ≥1 monster drafted the save
 * flow is byte-identical to before: header Save → name modal → onSave → toast.
 * Harness mirrors EncounterBuilder.toast.test.jsx (management-hook mock drives
 * modal visibility through getters; checkbox toggle forces the re-render). */
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

// Minimal stand-in mirroring EncounterModal's real contract.
vi.mock('./EncounterModal.jsx', () => ({
  default: (props) => {
    if (!props.isOpen) return null;
    return (
      <div data-testid="encounter-modal">
        {props.mode === 'save' && (
          <button data-testid="modal-save" onClick={() => props.onSave('new-encounter')}>
            Save
          </button>
        )}
      </div>
    );
  },
}));

vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: () => <textarea data-testid="description-textarea" />,
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

const campaignName = 'test-campaign';
const sampleMonsters = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid' },
];

const GATE_MESSAGE = 'Encounter has no monsters to save';

function createManagement(overrides = {}) {
  let modalOpen = false;
  let modalMode = null;
  return {
    get modalOpen() { return modalOpen; },
    get modalMode() { return modalMode; },
    encounters: [],
    loading: false,
    openSaveModal: vi.fn(() => { modalOpen = true; modalMode = 'save'; }),
    openLoadModal: vi.fn(() => { modalOpen = true; modalMode = 'load'; }),
    closeModal: vi.fn(() => { modalOpen = false; modalMode = null; }),
    saveEncounter: vi.fn().mockResolvedValue(undefined),
    updateEncounter: vi.fn().mockResolvedValue(undefined),
    loadEncounterData: vi.fn(),
    deleteEncounterAction: vi.fn(),
    renameEncounterAction: vi.fn(),
    ...overrides,
  };
}

function renderBuilder(overrides) {
  const management = createManagement(overrides);
  useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });
  useEncounterManagement.mockReturnValue(management);
  render(<EncounterBuilder campaignName={campaignName} characters={[{ name: 'Thorin', level: 5 }]} />);
  return management;
}

// The management mock drives modal visibility via getters, so the open flag is
// only re-read on the next render — the checkbox/description toggle forces one
// (same trick as EncounterBuilder.toast.test.jsx).
function forceRender() {
  fireEvent.change(screen.getByTestId('description-textarea'), { target: { value: 'x' } });
}

const gateBanner = () => document.querySelector('.encounter-builder > .encounter-modal-error');

describe('EncounterBuilder - empty-draft save gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks Save on an empty draft with a specific visible message — no modal, no save call', () => {
    const management = renderBuilder();

    fireEvent.click(screen.getByLabelText('Save encounter'));
    forceRender();

    expect(gateBanner()).toHaveTextContent(GATE_MESSAGE);
    expect(screen.queryByTestId('modal-save')).not.toBeInTheDocument();
    expect(management.openSaveModal).not.toHaveBeenCalled();
    expect(management.saveEncounter).not.toHaveBeenCalled();
    expect(management.updateEncounter).not.toHaveBeenCalled();
    expect(document.querySelector('.encounter-toast')).not.toBeInTheDocument();
  });

  it('blocks the Update leg once every drafted monster is removed — no extra PUT, message appears', async () => {
    const management = renderBuilder();

    // Draft + save so the header flips to Update (currentEncounterName set).
    fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
    fireEvent.click(screen.getByLabelText('Save encounter'));
    await waitFor(() => expect(screen.getByTestId('modal-save')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('modal-save'));
    await waitFor(() => expect(screen.getByTitle('Update encounter')).toBeInTheDocument());

    // Draft back to empty, then click Update: the gate fires instead of a PUT.
    fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
    fireEvent.click(screen.getByTitle('Update encounter'));

    expect(gateBanner()).toHaveTextContent(GATE_MESSAGE);
    expect(management.updateEncounter).not.toHaveBeenCalled();
  });

  it('clears the message when a monster is drafted and the normal save flow still works end-to-end', async () => {
    const management = renderBuilder();

    fireEvent.click(screen.getByLabelText('Save encounter'));
    forceRender();
    expect(gateBanner()).toHaveTextContent(GATE_MESSAGE);

    fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
    expect(gateBanner()).not.toBeInTheDocument();

    // Non-empty save flow unchanged: header Save → name modal → onSave → toast.
    fireEvent.click(screen.getByLabelText('Save encounter'));
    await waitFor(() => expect(screen.getByTestId('modal-save')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('modal-save'));

    await waitFor(() => {
      expect(document.querySelector('.encounter-toast')).toHaveTextContent('Encounter saved');
    });
    expect(management.saveEncounter).toHaveBeenCalledWith('new-encounter', expect.objectContaining({
      selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 1 }],
    }));
  });
});
