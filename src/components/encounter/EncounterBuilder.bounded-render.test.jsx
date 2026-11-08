// @maintained-by-ai
/* Lane: bounded bestiary render (EN backlog 2026-11-08 — ~640 monster-checkbox
 * rows rendered unfiltered behind the search box). Locks the two faces:
 *   • bounded-empty-state face: with an empty search and no narrowing filter,
 *     the table mounts only BESTIARY_RENDER_CAP (50) rows plus the
 *     "Showing first N of M — type to narrow" affordance
 *   • filter face: typing renders the full match set (affordance gone) and the
 *     checkboxes still drive selection; clearing re-bounds to the capped face
 * Also pinned: rows selected beyond the cap stay visible so their checkbox
 * never hides, and any dropdown/CR filter counts as narrowing (full render).
 * Sibling lanes (not restated): filtering semantics — helpers.test; selected-
 * monster force-listing under an excluding type filter — remaining.test. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
  const React = await import('react');
  return {
    useSyncedState: (_key, _prop, initial) => React.useState(initial),
  };
});

// Sever network seams (never invoked with exact payloads in this lane).
vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn(async () => {}),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

// Heavy modals stubbed: none open in this lane. The real table/filter/summary
// panels run — the census must reflect the REAL checkbox rows, not a mock.
vi.mock('./EncounterModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));
vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));

import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import useEncounterManagement from '../../hooks/management/useEncounterManagement.js';

const CAMPAIGN = 'test-campaign';
const RENDER_CAP = 50;

// 60 bestiary rows — deliberately above the render cap so both faces are
// observable through the real table DOM.
const MONSTERS = Array.from({ length: 60 }, (_, i) => ({
  index: `beast-${i + 1}`,
  name: `Beast ${String(i + 1).padStart(2, '0')}`,
  xp: 100,
  challenge_rating: 1,
  type: 'beast',
  environments: ['forest'],
}));
const CHARACTERS = [{ name: 'Thorin', level: 5 }];

function mountBuilder() {
  useMonstersData.mockReturnValue({
    monsters: MONSTERS.map((m) => ({ ...m, environments: [...m.environments] })),
    loading: false,
  });
  useEncounterManagement.mockReturnValue({
    modalOpen: false,
    modalMode: null,
    encounters: [],
    loading: false,
    openSaveModal: vi.fn(),
    openLoadModal: vi.fn(),
    closeModal: vi.fn(),
    saveEncounter: vi.fn(),
    updateEncounter: vi.fn(),
    loadEncounterData: vi.fn(async () => null),
    deleteEncounterAction: vi.fn(async () => {}),
    renameEncounterAction: vi.fn(async () => {}),
  });
  return render(
    <EncounterBuilder
      campaignName={CAMPAIGN}
      characters={CHARACTERS.map((c) => ({ ...c }))}
      onJoinEncounter={vi.fn()}
    />
  );
}

const census = () => document.querySelectorAll('input.monster-checkbox').length;

const rowFor = (name) =>
  Array.from(document.querySelectorAll('tbody tr'))
    .find((tr) => tr.querySelector('.col-name')?.textContent === name);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EncounterBuilder - bounded bestiary render', () => {
  it('paints a capped slice with the narrow affordance when the search box is empty', () => {
    mountBuilder();
    expect(census()).toBe(RENDER_CAP);
    expect(screen.getByTestId('monster-table-cap-notice')).toHaveTextContent(
      `Showing first ${RENDER_CAP} of 60 — type to narrow`
    );
    expect(rowFor('Beast 01')).toBeTruthy();
    expect(rowFor('Beast 50')).toBeTruthy();
    // Rows past the cap are NOT in the DOM at all.
    expect(rowFor('Beast 51')).toBeUndefined();
    expect(rowFor('Beast 60')).toBeUndefined();
  });

  it('typing filters to the full match set, drops the affordance, and checkboxes still select', () => {
    mountBuilder();
    fireEvent.change(screen.getByLabelText('Search monsters'), { target: { value: 'Beast 5' } });

    // Beast 50–59 all render (no sub-cap on real matches), affordance gone.
    expect(census()).toBe(10);
    expect(screen.queryByTestId('monster-table-cap-notice')).toBeNull();
    expect(rowFor('Beast 50')).toBeTruthy();
    expect(rowFor('Beast 59')).toBeTruthy();
    expect(rowFor('Beast 60')).toBeUndefined();

    // Working checkbox: selecting Beast 59 opens the Join gate.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Beast 59' }));
    expect(screen.getByRole('button', { name: 'Join Encounter' })).toBeInTheDocument();
  });

  it('clearing the search re-bounds to the capped face with the affordance', () => {
    mountBuilder();
    const input = screen.getByLabelText('Search monsters');
    fireEvent.change(input, { target: { value: 'Beast 60' } });
    expect(census()).toBe(1);
    expect(rowFor('Beast 60')).toBeTruthy();

    fireEvent.change(input, { target: { value: '' } });
    expect(census()).toBe(RENDER_CAP);
    expect(screen.getByTestId('monster-table-cap-notice')).toBeInTheDocument();
    expect(rowFor('Beast 60')).toBeUndefined();
  });

  it('keeps a selected row beyond the cap visible after clearing the search', () => {
    mountBuilder();
    const input = screen.getByLabelText('Search monsters');
    fireEvent.change(input, { target: { value: 'Beast 60' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Beast 60' }));

    fireEvent.change(input, { target: { value: '' } });
    // 50 capped rows + the one kept-selected row; the notice counts the face.
    expect(census()).toBe(RENDER_CAP + 1);
    const beastRow = rowFor('Beast 60');
    expect(beastRow).toBeTruthy();
    expect(beastRow.querySelector('.monster-checkbox').checked).toBe(true);
    expect(screen.getByTestId('monster-table-cap-notice')).toHaveTextContent(
      `Showing first ${RENDER_CAP + 1} of 60`
    );
  });

  it('a dropdown filter counts as narrowing and renders its full match set uncapped', () => {
    mountBuilder();
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'beast' } });
    expect(census()).toBe(60);
    expect(screen.queryByTestId('monster-table-cap-notice')).toBeNull();
  });
});
