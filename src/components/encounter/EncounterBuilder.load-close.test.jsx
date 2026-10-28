// @maintained-by-ai
/* Lane — Load-row close-on-action (QA backlog 2026-10-28-S: the Load modal
 * stayed OPEN after a `Load <name>` row click and intercepted the toolbar Save
 * via .encounter-modal-overlay pointer-events, while the generator Apply lane
 * (bad3f6e86) auto-closed — an asymmetry costing an extra × click).
 * EncounterModal.handleLoad now mirrors the modal's own save leg:
 * `await onLoad(name); onClose()` — the draft arms AND the overlay unmounts in
 * the same action. Pinned here end-to-end on the REAL EncounterModal:
 *  - row click: loadEncounterData dispatched once, monster checkboxes re-armed,
 *    toolbar Save title flips to `Update encounter`, overlay gone (Save
 *    immediately clickable);
 *  - × cancel leg: overlay closes with ZERO load dispatch, no draft change, no
 *    Save-title flip (zero network — no load/save/update/delete calls);
 *  - toolbar aria `Load encounter` vs modal row aria `Load <name>` stays a
 *    strict-mode-safe pairing (run-S locator note: row aria is UNQUOTED).
 * Owned elsewhere — do NOT duplicate: hydration/XP reconcile (#403
 * load-encounter), delete/rename close legs (EncounterModal.delete-close),
 * update-save 404 recovery (update-save-404). Management mock uses real
 * useState (reset-encounter pattern) so open/close drive genuine re-renders. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  loadEncounterData: vi.fn(),
  updateEncounter: vi.fn(),
  saveEncounter: vi.fn(),
  openSaveModal: vi.fn(),
  deleteEncounterAction: vi.fn(),
  renameEncounterAction: vi.fn(),
}));

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', async () => {
  const React = await import('react');
  // Named `use...` so rules-of-hooks accepts the internal useState calls.
  function useEncounterManagement() {
    const [modalMode, setModalMode] = React.useState(null);
    return {
      modalOpen: modalMode !== null,
      modalMode,
      encounters: [{ name: 'test-encounter' }],
      loading: false,
      openSaveModal: () => { setModalMode('save'); h.openSaveModal(); },
      openLoadModal: () => setModalMode('load'),
      closeModal: () => setModalMode(null),
      saveEncounter: h.saveEncounter,
      updateEncounter: h.updateEncounter,
      loadEncounterData: h.loadEncounterData,
      deleteEncounterAction: h.deleteEncounterAction,
      renameEncounterAction: h.renameEncounterAction,
    };
  }
  return { default: useEncounterManagement };
});

// viewingMonster lives in the runtime store but is never driven by this lane
// (same local passthrough as reset-encounter.test.jsx).
vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
  const React = await import('react');
  return {
    useSyncedState: (_key, _prop, initial) => React.useState(initial),
  };
});

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  calculateXPThreshold: vi.fn(() => 100),
  calculateDifficultyMultiplier: vi.fn(() => 1),
}));

vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));

vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn(async () => {}),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';

const CAMPAIGN = 'test-campaign';
const CHARACTERS = [{ name: 'Thorin', level: 5 }];
const MONSTERS = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] },
  { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, type: 'humanoid', environments: ['hill'] },
];

const overlay = () => document.querySelector('.encounter-modal-overlay');

function mountBuilder() {
  useMonstersData.mockReturnValue({
    monsters: MONSTERS.map((m) => ({ ...m, environments: [...m.environments] })),
    loading: false,
  });
  return render(
    <EncounterBuilder
      campaignName={CAMPAIGN}
      characters={CHARACTERS.map((c) => ({ ...c }))}
      onJoinEncounter={vi.fn()}
    />
  );
}

async function openLoadModal() {
  fireEvent.click(screen.getByRole('button', { name: 'Load encounter' }));
  await waitFor(() => {
    expect(overlay()).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Load Encounter' })).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EncounterBuilder — Load row closes the modal on action (generator-Apply parity)', () => {
  it('clicking a Load row arms the draft AND unmounts the overlay — toolbar Save is immediately clickable', async () => {
    // effectiveXP matches recomputed value (goblin qty 2 × 50 × mult 1) so the
    // reconcile write-back never fires — zero mutation besides the load GET.
    h.loadEncounterData.mockResolvedValue({
      selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }],
      description: '',
      effectiveXP: 100,
    });
    mountBuilder();
    await openLoadModal();

    // Row aria-label is UNQUOTED (run-S fingerprint).
    fireEvent.click(screen.getByRole('button', { name: 'Load test-encounter' }));

    await waitFor(() => {
      // (a) draft armed exactly as before: checkbox checked, Save title flips.
      expect(screen.getByRole('checkbox', { name: 'Select Goblin' })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Save encounter' })).toHaveAttribute(
        'title',
        'Update encounter'
      );
      // (b) modal auto-closed: overlay gone, nothing intercepts the toolbar.
      expect(overlay()).not.toBeInTheDocument();
    });
    expect(h.loadEncounterData).toHaveBeenCalledTimes(1);
    expect(h.loadEncounterData).toHaveBeenCalledWith('test-encounter');
  });

  it('× closes the modal WITHOUT arming: zero load dispatch, no Save-title flip, draft untouched', async () => {
    mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(overlay()).not.toBeInTheDocument();
    });
    // No draft change, zero network on every lane.
    expect(h.loadEncounterData).not.toHaveBeenCalled();
    expect(h.updateEncounter).not.toHaveBeenCalled();
    expect(h.saveEncounter).not.toHaveBeenCalled();
    expect(h.deleteEncounterAction).not.toHaveBeenCalled();
    expect(h.renameEncounterAction).not.toHaveBeenCalled();
    // Toolbar Save stays in create mode; no Reset affordance (nothing armed).
    expect(screen.getByRole('button', { name: 'Save encounter' })).toHaveAttribute(
      'title',
      'Save encounter'
    );
    expect(screen.queryByRole('button', { name: 'Reset encounter' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Goblin' })).not.toBeChecked();
  });
});
