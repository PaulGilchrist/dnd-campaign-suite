// @maintained-by-ai
// Helpers lane, salvaged: EncounterBuilder's calc/filter/persistence helpers are
// module-private, so the previous inline copies tested here could never fail when the
// REAL source broke — they were pure re-implementations. This file now drives the
// REAL builder (real filter panel, summary panel, monster table) and owns only the
// behaviors asserted nowhere else:
//   • localStorage filter persistence ('encounterFilter-2024'): restore on mount,
//     corrupt/invalid fallback, and the full saveFilter payload written on change
//   • filterMonsters narrowing via the UI: name/subtype search (case-insensitive),
//     fractional CR parsing ('1/8'), 'None' CR exclusion, inclusive CR bounds
//   • calculateDifficultyIndex band mapping shown as the summary Difficulty label
// Coverage kept elsewhere (not restated): toggleMonster/updateQty select/decrement and
// XP/count math — gameplay-flows #400 + panel-interactions; save payload (stripMonsters),
// sort, Join — additional-interactions #399; selected-monster preservation + Clear All —
// remaining.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', () => ({
  default: vi.fn(),
}));

// Keep the real filter/summary/table panels; stub the heavy modals (all closed here).
vi.mock('./EncounterModal.jsx', () => ({ default: () => null }));
vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));
vi.mock('../common/PreviewToggle.jsx', () => ({ default: () => null }));

// Sever server persistence — filter persistence and filtering are purely local here.
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

const FILTER_KEY = 'encounterFilter-2024';

const MONSTERS = [
  { index: 'cloud', name: 'Cloud', xp: 0, type: 'elemental', challenge_rating: 'None', environments: ['sky'] },
  { index: 'goblin', name: 'Goblin', xp: 50, type: 'humanoid', subtype: 'tribe', challenge_rating: 0.25, environments: ['forest'] },
  { index: 'kobold', name: 'Kobold', xp: 250, type: 'humanoid', challenge_rating: 0.25, environments: ['underdark'] },
  { index: 'kobold-captain', name: 'Kobold Captain', xp: 250, type: 'humanoid', challenge_rating: 0.5, environments: ['underdark'] },
  { index: 'orc', name: 'Orc', xp: 100, type: 'humanoid', challenge_rating: 0.5, environments: ['hill'] },
  { index: 'rat', name: 'Rat', xp: 25, type: 'beast', challenge_rating: '1/8', environments: ['forest'] },
  { index: 'shadow', name: 'Shadow', xp: 235, type: 'undead', challenge_rating: 0.5, environments: ['underdark'] },
  { index: 'young-dragon', name: 'Young Dragon', xp: 450, type: 'dragon', challenge_rating: 2, environments: ['mountain'] },
];

function mountBuilder({ monsters = [], characters }) {
  useMonstersData.mockReturnValue({ monsters, loading: false });
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
  return render(
    <EncounterBuilder campaignName="test-campaign" characters={characters} onJoinEncounter={vi.fn()} />
  );
}

const thorinLv5 = [{ name: 'Thorin', level: 5 }];

const rowNames = (container) =>
  Array.from(container.querySelectorAll('tbody tr td.col-name')).map(td => td.textContent);

const thresholdText = (container) =>
  container.querySelector('.threshold-display strong').textContent;

// 'Difficulty' text exists on both the filter-panel dropdown label and the summary tile;
// scope to the summary panel tile.
const summaryDifficulty = () => {
  const item = screen.getAllByText('Difficulty')
    .map(el => el.closest('.summary-item'))
    .find(Boolean);
  return item.querySelector('.summary-value').textContent;
};

const savedFilter = () => JSON.parse(localStorage.getItem(FILTER_KEY));

beforeEach(() => {
  localStorage.clear();
});

describe('filter persistence (localStorage key encounterFilter-2024)', () => {
  it('restores saved difficulty and environment filter on mount', () => {
    localStorage.setItem(FILTER_KEY, JSON.stringify({
      difficulty: 3, environment: 'forest', type: '', size: '', crMin: '', crMax: '',
    }));
    const { container } = mountBuilder({
      monsters: MONSTERS,
      characters: thorinLv5,
    });

    // Difficulty 3 (Deadly) restored: dropdown shows it and the target threshold
    // uses it (Lv5 Deadly = 1,100 XP per config.xpThresholds[5][3]).
    expect(screen.getByLabelText('Difficulty')).toHaveValue('3');
    expect(thresholdText(container)).toBe('1,100 XP');
    expect(container.querySelector('.threshold-display').textContent).toContain('(Deadly)');

    // Saved environment 'forest' narrows the table to forest dwellers.
    expect(rowNames(container)).toEqual(['Goblin', 'Rat']);
  });

  it('writes the full six-field filter payload to localStorage on mount and on difficulty change', () => {
    const { container } = mountBuilder({ monsters: [], characters: thorinLv5 });

    // Fresh mount persists the default filter (ENCOUNTER_CONFIG.defaultDifficulty = 1).
    expect(savedFilter()).toEqual({
      difficulty: 1, environment: '', type: '', size: '', crMin: '', crMax: '',
    });

    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '2' } });

    expect(savedFilter()).toEqual({
      difficulty: 2, environment: '', type: '', size: '', crMin: '', crMax: '',
    });
    expect(thresholdText(container)).toBe('750 XP'); // Lv5 Hard threshold (config.xpThresholds[5][2])
  });

  describe.each([
    ['a saved filter without a numeric difficulty', JSON.stringify({ difficulty: 'hard', environment: 'forest' })],
    ['saved data missing difficulty entirely', JSON.stringify({ environment: 'forest' })],
    ['corrupt JSON', '{not valid json'],
  ])('with %s', (_desc, raw) => {
    it('falls back to default Medium with no filters applied', () => {
      localStorage.setItem(FILTER_KEY, raw);
      const { container } = mountBuilder({
        monsters: MONSTERS.filter(m => ['goblin', 'orc'].includes(m.index)),
        characters: thorinLv5,
      });

      expect(screen.getByLabelText('Difficulty')).toHaveValue('1');
      expect(thresholdText(container)).toBe('500 XP'); // Lv5 Medium threshold (config.xpThresholds[5][1])
      // The saved environment filter is NOT applied because the save was rejected.
      expect(rowNames(container)).toEqual(['Goblin', 'Orc']);
    });
  });
});

describe('monster table filtering', () => {
  it('narrows rows by search text on name, subtype, and type, case-insensitively', () => {
    const { container } = mountBuilder({ monsters: MONSTERS, characters: thorinLv5 });
    expect(rowNames(container)).toEqual([
      'Cloud', 'Goblin', 'Kobold', 'Kobold Captain', 'Orc', 'Rat', 'Shadow', 'Young Dragon',
    ]);

    const search = screen.getByLabelText('Search monsters');

    fireEvent.change(search, { target: { value: 'orc' } });
    expect(rowNames(container)).toEqual(['Orc']);

    // 'tribe' matches only Goblin's subtype, not any name.
    fireEvent.change(search, { target: { value: 'tribe' } });
    expect(rowNames(container)).toEqual(['Goblin']);

    // Case-insensitive name match.
    fireEvent.change(search, { target: { value: 'DRAGON' } });
    expect(rowNames(container)).toEqual(['Young Dragon']);
  });

  it('applies CR bounds inclusively, parsing fractional CRs and excluding CR None', () => {
    const { container } = mountBuilder({ monsters: MONSTERS, characters: thorinLv5 });

    // CR min 0.25: Rat's fractional '1/8' (0.125) drops out; Cloud ('None') is excluded.
    fireEvent.change(screen.getByLabelText('CR Min'), { target: { value: '0.25' } });
    expect(rowNames(container)).toEqual([
      'Goblin', 'Kobold', 'Kobold Captain', 'Orc', 'Shadow', 'Young Dragon',
    ]);

    // CR max 0.125 keeps Rat at the inclusive upper bound and nothing else.
    fireEvent.change(screen.getByLabelText('CR Min'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('CR Max'), { target: { value: '0.125' } });
    expect(rowNames(container)).toEqual(['Rat']);
  });
});

describe('actual difficulty label bands', () => {
  it('maps effective XP onto Easy/Medium/Hard/Deadly thresholds, independently of the dropdown', () => {
    // Party Lv7 solo: Medium threshold 750 XP (config.xpThresholds[7][1]).
    // Band edges: Easy <375, Medium 375..749, Hard 750..1124, Deadly >=1125.
    mountBuilder({
      monsters: MONSTERS.filter(m => ['kobold', 'kobold-captain'].includes(m.index)),
      characters: [{ name: 'Thorin', level: 7 }],
    });

    expect(summaryDifficulty()).toBe('Easy'); // 0 XP selected

    // 250 XP x1.5 multiplier = 375 — exactly 0.5x threshold, so Medium (inclusive edge).
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Kobold' }));
    expect(summaryDifficulty()).toBe('Medium');

    // 500 XP x2 = 1,000 — >= 1x and < 1.5x threshold → Hard.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Kobold Captain' }));
    expect(summaryDifficulty()).toBe('Hard');

    // 750 XP x2.5 = 1,875 — >= 1.5x threshold → Deadly.
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Kobold' }));
    expect(summaryDifficulty()).toBe('Deadly');

    // The dropdown still reads Medium — actual difficulty is independent of it.
    expect(screen.getByLabelText('Difficulty')).toHaveValue('1');
  });
});
