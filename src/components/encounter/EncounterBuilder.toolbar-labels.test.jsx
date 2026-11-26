// @maintained-by-ai 2026-11-16
/* Lane — 2026-11-16 WK backlog: EB toolbar buttons carried icon-leading-space
 * labels (" Save"/" Load") plus overriding aria-labels ("Save encounter"), so
 * getByRole(name, exact) could not resolve the visible words. Fixed: toolbar
 * icons are now decorative <i aria-hidden="true"> siblings with a space-free
 * label node (mirroring the clean modal buttons in this family), so each
 * button's accessible name is EXACTLY its visible text — Save (Update when a
 * saved encounter is loaded), Load, Generate, Reset, Join Encounter.
 * Pinned here: exact accessible names (with exact:true), aria-hidden icons,
 * whitespace-free textContent, and the unregressed Save/Load/Reset/Join lanes
 * (empty-gate inline .encounter-modal-error, load-modal open, Update flip,
 * Reset detach). Harness mirrors EncounterBuilder.reset-encounter.test.jsx. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  loadEncounterData: vi.fn(),
  updateEncounter: vi.fn(),
  saveEncounter: vi.fn(),
  openSaveModal: vi.fn(),
}));

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', async () => {
  const React = await import('react');
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
      deleteEncounterAction: vi.fn(),
      renameEncounterAction: vi.fn(),
    };
  }
  return { default: useEncounterManagement };
});

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

/** Exact-name + decorativity contract for one toolbar button. */
function expectCleanLabel(name) {
  const btn = screen.getByRole('button', { name, exact: true });
  expect(btn).toBeInTheDocument();
  // No aria-label overriding the visible words any more.
  expect(btn).not.toHaveAttribute('aria-label');
  // textContent is EXACTLY the label — no icon-leading/trailing space.
  expect(btn.textContent).toBe(name);
  const icon = btn.querySelector('i');
  expect(icon).not.toBeNull();
  expect(icon).toHaveAttribute('aria-hidden', 'true');
  return btn;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EncounterBuilder — toolbar exact accessible names', () => {
  it('create-mode toolbar resolves getByRole exact for Save, Load and Generate (no Reset)', () => {
    mountBuilder();
    expectCleanLabel('Save');
    expectCleanLabel('Load');
    expectCleanLabel('Generate');
    expect(screen.queryByRole('button', { name: 'Reset', exact: true })).toBeNull();
    // The old overriding aria-labels are gone: name 'Save encounter' must miss.
    expect(screen.queryByRole('button', { name: 'Save encounter' })).toBeNull();
  });

  it('empty-gate leg unregressed: exact-name Save click on an empty draft shows inline .encounter-modal-error, no modal, no save call', () => {
    mountBuilder();
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    expect(document.querySelector('.encounter-modal-error')).toHaveTextContent(
      'Encounter has no monsters to save'
    );
    expect(h.openSaveModal).not.toHaveBeenCalled();
    expect(h.saveEncounter).not.toHaveBeenCalled();
  });

  it('Load opens the pool modal and Join Encounter keeps its exact name once a monster is drafted', () => {
    mountBuilder();
    // Pre-draft: Join absent.
    expect(screen.queryByRole('button', { name: 'Join Encounter', exact: true })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Load', exact: true }));
    expect(screen.getByRole('heading', { name: 'Load Encounter' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    const join = screen.getByRole('button', { name: 'Join Encounter', exact: true });
    expect(join.textContent).toBe('Join Encounter');
    expect(join.querySelector('i')).toHaveAttribute('aria-hidden', 'true');
  });

  it('loaded encounter flips the toolbar to exact Update + Reset, and Reset detaches back to exact Save', async () => {
    h.loadEncounterData.mockResolvedValue({
      selectedMonsters: [{ index: 'goblin', qty: 1 }],
      description: '',
      effectiveXP: 50,
    });
    mountBuilder();
    fireEvent.click(screen.getByRole('button', { name: 'Load', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Load "test-encounter"' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Update', exact: true })).toBeInTheDocument();
    });
    expectCleanLabel('Update');
    expectCleanLabel('Reset');
    // The create-mode Save name is fully replaced while an encounter is bound.
    expect(screen.queryByRole('button', { name: 'Save', exact: true })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
    expect(screen.queryByRole('button', { name: 'Reset', exact: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update', exact: true })).toBeNull();
    expectCleanLabel('Save');
  });
});
