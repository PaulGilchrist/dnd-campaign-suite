// @maintained-by-ai
// Salvaged from the deprecated gameplay-flows tombstone: the XP recomputation
// chain (select → increase qty → deselect drives Total XP, Monster Count,
// Multiplier, and Effective XP). The remaining.test.jsx citations in the old
// tombstone no longer exist there (interactions.test.jsx is itself a
// placeholder), so this is the sole coverage for that behavior. Runs the REAL
// EncounterBuilder with REAL child panels/table and the REAL encounterGenerator
// multiplier math (party of Thorin 5 + Elara 3, partySize 2: 1 goblin qty 1
// → ratio 0.5 → ×1 → eff 50; qty 2 → ratio 1 → ×1.5 → eff 150).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', () => ({
  default: vi.fn(),
}));

// Keep the real filter/summary/table/selected panels; stub the heavy modals
// (all closed in this test — the builder renders them with null state).
vi.mock('./EncounterModal.jsx', () => ({ default: () => null }));
vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));
vi.mock('../common/PreviewToggle.jsx', () => ({ default: () => null }));

// Sever server persistence — the XP chain under test is purely local state.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  const store = new Map();
  return {
    getStore: vi.fn(() => store),
    setRuntimeValue: vi.fn(),
    listeners: new Map(),
  };
});
vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import useEncounterManagement from '../../hooks/management/useEncounterManagement.js';

const sampleMonsters = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] },
  { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, type: 'humanoid', environments: ['hill'] },
];

const characters = [
  { name: 'Thorin', level: 5 },
  { name: 'Elara', level: 3 },
];

function summaryValue(label) {
  return screen.getByText(label).closest('.summary-item').querySelector('.summary-value').textContent;
}

describe('EncounterBuilder XP recomputation (salvaged)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useMonstersData.mockReturnValue({ monsters: sampleMonsters, loading: false });
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
      loadEncounterData: vi.fn(),
      deleteEncounterAction: vi.fn(),
      renameEncounterAction: vi.fn(),
    });
  });

  it('recomputes Total XP, Monster Count, Multiplier, and Effective XP as monsters are selected, increased, and deselected', () => {
    render(<EncounterBuilder campaignName="test-campaign" characters={characters} onJoinEncounter={vi.fn()} />);

    // Fresh builder: everything at zero, multiplier ×1.
    expect(summaryValue('Total XP')).toBe('0');
    expect(summaryValue('Monster Count')).toBe('0');
    expect(summaryValue('Multiplier')).toBe('\u00d71');
    expect(summaryValue('Effective XP')).toBe('0');

    // Select 1 Goblin: total 50, count 1, ratio 0.5 of party of 2 → ×1 → eff 50.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    expect(summaryValue('Total XP')).toBe('50');
    expect(summaryValue('Monster Count')).toBe('1');
    expect(summaryValue('Multiplier')).toBe('\u00d71');
    expect(summaryValue('Effective XP')).toBe('50');

    // Increase qty to 2: total 100, count 2, ratio 1 → ×1.5 → eff 150.
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Goblin' }));
    expect(summaryValue('Total XP')).toBe('100');
    expect(summaryValue('Monster Count')).toBe('2');
    expect(summaryValue('Multiplier')).toBe('\u00d71.5');
    expect(summaryValue('Effective XP')).toBe('150');

    // Decrease back to qty 1: total 50, multiplier ×1 again.
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity of Goblin' }));
    expect(summaryValue('Total XP')).toBe('50');
    expect(summaryValue('Monster Count')).toBe('1');
    expect(summaryValue('Multiplier')).toBe('\u00d71');
    expect(summaryValue('Effective XP')).toBe('50');

    // Deselect (checkbox click decrements qty 1 → 0 → removed): clean zero summary.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    expect(summaryValue('Total XP')).toBe('0');
    expect(summaryValue('Monster Count')).toBe('0');
    expect(summaryValue('Effective XP')).toBe('0');
  });
});
