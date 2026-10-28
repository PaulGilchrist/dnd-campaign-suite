// @maintained-by-ai
/* Lane: save/load confirmation toasts (backlog 2026-10-13 — silent save/load).
 * Success paths toast after the POST/GET resolves; failure paths surface an
 * error toast instead of silence; the toast auto-hides on a display-only
 * timer (no game state). Mirrors the .sessions-toast pattern in Sessions.jsx. */
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

// Minimal stand-in mirroring EncounterModal's real contract: save mode exposes
// a confirm button wired to onSave, load mode one row button per encounter.
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
const sampleMonsters = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid' },
];

function createManagement(overrides = {}) {
  let modalOpen = false;
  let modalMode = null;
  return {
    get modalOpen() { return modalOpen; },
    get modalMode() { return modalMode; },
    encounters: [{ name: 'test-encounter' }],
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
  useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });
  useEncounterManagement.mockReturnValue(management);
  render(<EncounterBuilder campaignName={mockCampaignName} characters={[{ name: 'Thorin', level: 5 }]} />);
  return management;
}

const toastNode = () => document.querySelector('.encounter-toast');

async function clickSaveThroughModal() {
  fireEvent.click(screen.getByLabelText('Save encounter'));
  await waitFor(() => expect(screen.getByTestId('modal-save')).toBeInTheDocument());
  fireEvent.click(screen.getByTestId('modal-save'));
}

async function clickLoadRow() {
  fireEvent.click(screen.getByLabelText('Load encounter'));
  // The management mock drives modal visibility via getters, so the open flag
  // is only re-read on the next render — the checkbox toggle forces one
  // (same trick as EncounterBuilder.load-encounter.test.jsx).
  fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
  await waitFor(() => expect(screen.getByTestId('load-encounter-test-encounter')).toBeInTheDocument());
  fireEvent.click(screen.getByTestId('load-encounter-test-encounter'));
}

describe('EncounterBuilder - save/load toasts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toasts "Encounter saved" after a new-encounter save resolves', async () => {
    const management = renderBuilder();
    fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
    await clickSaveThroughModal();

    await waitFor(() => {
      expect(toastNode()).toHaveTextContent('Encounter saved');
    });
    expect(toastNode()).not.toHaveClass('encounter-toast-error');
    expect(management.saveEncounter).toHaveBeenCalledWith('new-encounter', expect.objectContaining({
      selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 1 }],
    }));
  });

  it('toasts an error instead of silence when the save POST fails', async () => {
    renderBuilder({ saveEncounter: vi.fn().mockRejectedValue(new Error('server unavailable')) });
    // Draft must be non-empty — the empty-draft gate blocks the save flow itself.
    fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
    await clickSaveThroughModal();

    await waitFor(() => {
      expect(toastNode()).toHaveTextContent('Failed to save encounter');
    });
    expect(toastNode()).toHaveClass('encounter-toast-error');
  });

  it('toasts "Encounter updated" when updating an already-loaded encounter (confirm accepted)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const management = renderBuilder();
    await clickLoadRow();
    await waitFor(() => expect(screen.getByText('Encounter: test-encounter')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Update encounter'));
    await waitFor(() => {
      expect(toastNode()).toHaveTextContent('Encounter updated');
    });
    // Toast honesty: the update lane never claims the create copy.
    expect(toastNode()).not.toHaveTextContent('Encounter saved');
    // Exact formatted copy pinned byte-identically in update-save-confirm lane;
    // here formatEncounterName is mocked to `Encounter: <name>`.
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/^Overwrite encounter ".*test-encounter"\? This replaces the saved encounter\.$/);
    expect(management.updateEncounter).toHaveBeenCalledWith('test-encounter', expect.anything());
  });

  it('toasts an error when the update PUT fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const failingUpdate = vi.fn().mockResolvedValue(undefined);
    renderBuilder({ updateEncounter: failingUpdate });
    await clickLoadRow();
    await waitFor(() => expect(screen.getByText('Encounter: test-encounter')).toBeInTheDocument());

    failingUpdate.mockRejectedValue(new Error('put failed'));
    fireEvent.click(screen.getByTitle('Update encounter'));
    await waitFor(() => {
      expect(toastNode()).toHaveTextContent('Failed to save encounter');
    });
    expect(toastNode()).toHaveClass('encounter-toast-error');
  });

  it('toasts "Encounter loaded" after a successful load', async () => {
    renderBuilder();
    await clickLoadRow();

    await waitFor(() => {
      expect(toastNode()).toHaveTextContent('Encounter loaded');
    });
    expect(toastNode()).not.toHaveClass('encounter-toast-error');
  });

  it('toasts an error instead of silence when the load GET fails', async () => {
    renderBuilder({ loadEncounterData: vi.fn().mockRejectedValue(new Error('server unavailable')) });
    await clickLoadRow();

    await waitFor(() => {
      expect(toastNode()).toHaveTextContent('Failed to load encounter');
    });
    expect(toastNode()).toHaveClass('encounter-toast-error');
  });

  it('auto-hides the toast after ~2.5s without interaction', async () => {
    renderBuilder();
    await clickLoadRow();

    await waitFor(() => expect(toastNode()).toHaveTextContent('Encounter loaded'));
    // Display-only auto-hide timer — real timers, generous bound.
    await waitFor(() => expect(toastNode()).not.toBeInTheDocument(), { timeout: 3500 });
  });
});
