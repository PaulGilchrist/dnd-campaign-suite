// @maintained-by-ai
/* Lane — update-save onto a deleted encounter row (404 recovery, QA backlog
 * 2026-10-28-S). Load arms the toolbar Update lane; if the disk row is deleted
 * elsewhere before Save, the PUT 404s. Old behavior: generic `Failed to save
 * encounter` toast + stale name stays attached (soft dead-end, recovery only
 * via toolbar `Reset`) + 3 console lines (1 service + 2 wrapper double-logs).
 * New behavior pinned here:
 *  - failure copy NAMES the encounter and says the row is gone;
 *  - the stale name detaches (toolbar Save flips back to create mode) AND the
 *    create-name modal opens automatically with the surviving draft;
 *  - saving through that modal lands via the CREATE lane (saveEncounter, not
 *    another PUT);
 *  - wrappers log NOTHING (c5d784d1f single-layer fingerprint: 1 service,
 *    0 wrappers) — service-level status/log stays owned by
 *    encountersService.test.js;
 *  - non-404 failures keep the old generic copy and keep the armed name (the
 *    row may still exist — a wrong detach would lose the update link).
 * Seam mocks mirror update-save-confirm.test.jsx (management hook, heavy
 * modals, network services severed); encountersService is REAL so
 * formatEncounterName bytes are pinned for real. */
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

// Minimal stand-in mirroring EncounterModal's real contract (same as
// update-save-confirm.test.jsx): save mode exposes a confirm button wired to
// onSave under a FRESH name — the 404 fallback must land a NEW row.
vi.mock('./EncounterModal.jsx', () => ({
  default: (props) => {
    if (!props.isOpen) return null;
    return (
      <div data-testid="encounter-modal">
        {props.mode === 'save' && (
          <button data-testid="modal-save" onClick={() => props.onSave('qa-resaved')}>
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
// Real formatEncounterName: 'qa-update-bug' → 'Qa Update Bug'.
const NAMED_404_COPY =
  'Could not update "Qa Update Bug" — it no longer exists. Save it as a new encounter.';
const NOT_FOUND = Object.assign(new Error('Encounter not found'), { status: 404 });

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
    updateEncounter: vi.fn().mockRejectedValue(NOT_FOUND),
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
// (same trick as update-save-confirm.test.jsx).
async function clickLoadRow() {
  fireEvent.click(screen.getByLabelText('Load encounter'));
  fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
  fireEvent.click(screen.getByTestId('monster-checkbox-goblin'));
  await waitFor(() => expect(screen.getByTestId('load-encounter-qa-update-bug')).toBeInTheDocument());
  fireEvent.click(screen.getByTestId('load-encounter-qa-update-bug'));
  await waitFor(() => expect(screen.getByTitle('Update encounter')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EncounterBuilder — update-save onto a deleted row (404 recovery)', () => {
  it('404 leg: named copy + stale name detached + create-name modal opens automatically, zero wrapper console.error', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const management = renderBuilder();
    await clickLoadRow();

    fireEvent.click(screen.getByTitle('Update encounter'));

    // Exact byte-pinned named failure copy (criterion: names the encounter
    // and conveys the row is gone).
    await waitFor(() => expect(toastNode()).toHaveTextContent(NAMED_404_COPY));
    expect(toastNode()).toHaveClass('encounter-toast-error');
    expect(management.updateEncounter).toHaveBeenCalledTimes(1);

    // Not stuck: create-name modal opened automatically with the draft…
    expect(screen.getByTestId('modal-save')).toBeInTheDocument();
    // …and the stale name detached (toolbar Save label flips back to create
    // mode without a `Reset` click; Reset button gone because nothing is
    // attached anymore).
    expect(screen.getByTitle('Save encounter')).toBeInTheDocument();
    expect(screen.queryByTitle('Update encounter')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reset encounter')).not.toBeInTheDocument();

    // Single-layer logging fingerprint (c5d784d1f): this component logged
    // NOTHING — the service owns the one console.error (pinned in
    // encountersService.test.js).
    expect(console.error).not.toHaveBeenCalled();
  });

  it('404 then modal save: lands through the CREATE lane (saveEncounter, fresh name) with "Encounter saved"', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const management = renderBuilder();
    await clickLoadRow();

    fireEvent.click(screen.getByTitle('Update encounter'));
    await waitFor(() => expect(screen.getByTestId('modal-save')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('modal-save'));

    // Create lane only — the vanished row is never PUT to again.
    await waitFor(() => expect(management.saveEncounter).toHaveBeenCalledTimes(1));
    expect(management.saveEncounter).toHaveBeenCalledWith('qa-resaved', expect.objectContaining({
      selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 1 }],
    }));
    expect(management.updateEncounter).toHaveBeenCalledTimes(1); // only the failed PUT
    await waitFor(() => expect(toastNode()).toHaveTextContent('Encounter saved'));
    // Re-attached to the NEW name: toolbar updates the fresh row from here on.
    expect(screen.getByTitle('Update encounter')).toBeInTheDocument();
  });

  it('non-404 failure: generic copy kept, name stays armed, no modal, no wrapper console.error', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const management = renderBuilder({
      updateEncounter: vi.fn().mockRejectedValue(new Error('server offline')),
    });
    await clickLoadRow();

    fireEvent.click(screen.getByTitle('Update encounter'));

    await waitFor(() => expect(toastNode()).toHaveTextContent('Failed to save encounter'));
    expect(toastNode()).toHaveClass('encounter-toast-error');
    // Row may still exist (5xx/timeout) — keep the update link, do NOT open
    // the create modal or detach the name.
    expect(screen.queryByTestId('modal-save')).not.toBeInTheDocument();
    expect(screen.getByTitle('Update encounter')).toBeInTheDocument();
    expect(management.saveEncounter).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
