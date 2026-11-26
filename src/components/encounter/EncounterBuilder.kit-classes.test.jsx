// @maintained-by-ai 2026-11-22
/* Lane — .ct-* design-kit convergence (QA backlog tranche 1, Encounters view):
 * the EncounterBuilder root carries .ct-container (the App.css kit scope) and
 * its toolbar/action buttons render with the shared kit hierarchy: Save/Load/
 * Reset on .ct-btn, Generate on .ct-generate-btn (the Settlements Generate
 * pattern), the Join commit CTA on .ct-btn .ct-btn-primary, the filter panel's
 * Add Player on .ct-btn-sm, and the summary's Clear All on .ct-btn-danger.
 * Zero bespoke .encounter-btn tokens may render while the generator dialog is
 * closed; the no-characters party row lost its inline style to the scoped
 * .party-summary-empty tier (no-inline-styles law). Exact accessible names
 * stay byte-identical (the toolbar-labels lane owns the AT contract). */
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
const MONSTERS = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] },
];

function mountBuilder(characters = [{ name: 'Thorin', level: 5 }]) {
  useMonstersData.mockReturnValue({
    monsters: MONSTERS.map((m) => ({ ...m, environments: [...m.environments] })),
    loading: false,
  });
  return render(
    <EncounterBuilder
      campaignName={CAMPAIGN}
      characters={characters.map((c) => ({ ...c }))}
      onJoinEncounter={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EncounterBuilder — kit button hierarchy (tranche 1)', () => {
  it('root carries the kit scope class and the header rides .ct-header/.ct-title', () => {
    const { container } = mountBuilder();
    const root = container.querySelector('.encounter-builder');
    expect(root).toHaveClass('ct-container');
    expect(root.querySelector(':scope > .ct-header > .ct-title')).toHaveTextContent('Encounter Builder');
    // Retired bespoke header tokens render nowhere.
    expect(container.querySelector('.encounter-header-row')).toBeNull();
    expect(container.querySelector('.encounter-title')).toBeNull();
  });

  it('Save/Load ride .ct-btn and Generate rides .ct-generate-btn, names byte-identical', () => {
    mountBuilder();
    expect(screen.getByRole('button', { name: 'Save', exact: true })).toHaveClass('ct-btn');
    expect(screen.getByRole('button', { name: 'Load', exact: true })).toHaveClass('ct-btn');
    expect(screen.getByRole('button', { name: 'Generate', exact: true })).toHaveClass('ct-generate-btn');
    expect(screen.getByRole('button', { name: 'Add player' })).toHaveClass('ct-btn', 'ct-btn-sm');
    expect(screen.getByRole('button', { name: 'Add player' })).not.toHaveClass('encounter-btn');
  });

  it('drafting a monster arms Join as .ct-btn .ct-btn-primary and Clear All as .ct-btn-danger', () => {
    mountBuilder();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    expect(screen.getByRole('button', { name: 'Join Encounter', exact: true }))
      .toHaveClass('ct-btn', 'ct-btn-primary');
    expect(screen.getByRole('button', { name: 'Clear All' })).toHaveClass('ct-btn', 'ct-btn-danger');
    // Whole-page census: no bespoke .encounter-btn tier renders with the
    // generator dialog closed (the toolbar/modal all ride the kit now).
    expect(document.querySelectorAll('.encounter-btn').length).toBe(0);
  });

  it('zero-characters party hint keeps its copy on the scoped .party-summary-empty tier, inline-style-free', () => {
    const { container } = mountBuilder([]);
    const hint = screen.getByText(/No characters in this campaign/);
    expect(hint).toHaveClass('party-summary', 'party-summary-empty');
    expect(hint).not.toHaveAttribute('style');
    expect(container.querySelector('.player-levels-header')).toBeInTheDocument();
  });

  it('loading a saved encounter re-arms the toolbar (Update/Reset on .ct-btn) — behavior lane unregressed', async () => {
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
    expect(screen.getByRole('button', { name: 'Update', exact: true })).toHaveClass('ct-btn');
    expect(screen.getByRole('button', { name: 'Reset', exact: true })).toHaveClass('ct-btn');
  });
});
