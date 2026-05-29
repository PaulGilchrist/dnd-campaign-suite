import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterBuilder from './EncounterBuilder.jsx';

let monstersDataState = { monsters: [], loading: false };

vi.mock('../../hooks/useMonstersData.js', () => ({
  useMonstersData: () => monstersDataState,
}));

vi.mock('../../hooks/useEncounterManagement.js', () => ({
  default: () => ({
    modalOpen: false,
    modalMode: 'save',
    encounters: [],
    loading: false,
    loadEncounterList: vi.fn(),
    openSaveModal: vi.fn(),
    openLoadModal: vi.fn(),
    closeModal: vi.fn(),
    saveEncounter: vi.fn(),
    updateEncounter: vi.fn(),
    loadEncounterData: vi.fn(),
    deleteEncounterAction: vi.fn(),
    renameEncounterAction: vi.fn(),
  }),
}));

vi.mock('./EncounterFilterPanel.jsx', () => ({
  default: () => <div data-testid="filter-panel" />,
}));
vi.mock('./EncounterSummaryPanel.jsx', () => ({
  default: () => <div data-testid="summary-panel" />,
}));
vi.mock('./EncounterMonsterTable.jsx', () => ({
  default: () => <div data-testid="monster-table" />,
}));
vi.mock('./EncounterSelectedMonsters.jsx', () => ({
  default: () => <div data-testid="selected-monsters" />,
}));
vi.mock('./EncounterModal.jsx', () => ({
  default: () => <div data-testid="encounter-modal" />,
}));
vi.mock('./EncounterGeneratorModal.jsx', () => ({
  default: () => <div data-testid="generator-modal" />,
}));
vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea
        data-testid={`field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

const defaultProps = {
  characters: [
    { name: 'Aragorn', level: 5, rules: '5e' },
    { name: 'Gandalf', level: 10, rules: '5e' },
  ],
  campaignName: 'test-campaign',
};

const xpThresholds = [
  [15, 25, 40, 50], [25, 50, 75, 100], [50, 100, 150, 200],
  [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100],
  [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100],
  [550, 1100, 1600, 2400], [600, 1200, 1900, 2800], [800, 1600, 2400, 3600],
  [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700],
  [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800],
  [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700],
];

function calculateXPThreshold(playerLevels, difficultyIndex) {
  return playerLevels.reduce((sum, level) => {
    const idx = parseInt(level, 10);
    if (!isNaN(idx) && idx >= 0 && idx <= 20) {
      return sum + (xpThresholds[idx][difficultyIndex] || 0);
    }
    return sum;
  }, 0);
}

function calculateMaxXP(playerLevels, difficultyIndex) {
  return calculateXPThreshold(playerLevels, difficultyIndex) * 2;
}

function calculateDifficultyMultiplier(monsterCount) {
  if (monsterCount <= 1) return 1;
  if (monsterCount === 2) return 1.5;
  if (monsterCount <= 6) return 2;
  if (monsterCount <= 10) return 2.5;
  if (monsterCount <= 14) return 3;
  return 4;
}

function calculateDifficultyIndex(effectiveXP, totalThreshold) {
  if (!totalThreshold) return 0;
  const ratio = effectiveXP / totalThreshold;
  if (ratio < 0.5) return 0;
  if (ratio < 1) return 1;
  if (ratio < 1.5) return 2;
  return 3;
}

function calculateTotalMonsterXP(selectedMonsters) {
  return selectedMonsters.reduce((sum, m) => sum + (m.xp || 0) * (m.qty || 1), 0);
}

function calculateMonsterCount(selectedMonsters) {
  return selectedMonsters.reduce((sum, m) => sum + (m.qty || 1), 0);
}

function filterMonsters(monsters, searchQuery, playerLevels, difficultyIndex, totalThreshold) {
  if (!monsters) return [];
  const maxXP = calculateMaxXP(playerLevels, difficultyIndex);
  const avgLevel = playerLevels.reduce((sum, l) => sum + l, 0) / playerLevels.length;
  const minCRMultipliers = [0.25, 0.35, 0.45, 0.55];
  const minCR = avgLevel * (minCRMultipliers[difficultyIndex] ?? 0.25);
  const minXP = totalThreshold * 0.2;
  return monsters.filter(m => {
    if (m.xp > maxXP) return false;
    if (m.xp < minXP) return false;
    if ((m.challenge_rating ?? 0) < minCR) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.name.toLowerCase().includes(q)
      || (m.type && m.type.toLowerCase().includes(q))
      || (m.subtype && m.subtype.toLowerCase().includes(q));
  });
}

function toggleMonster(selected, monster) {
  const existing = selected.find(m => m.index === monster.index);
  if (existing) {
    return selected.map(m =>
      m.index === monster.index ? { ...m, qty: (m.qty || 1) - 1 } : m
    ).filter(m => m.qty > 0);
  }
  return [...selected, { ...monster, qty: 1 }];
}

function updateQty(selected, index, delta) {
  return selected.map(m =>
    m.index === index ? { ...m, qty: (m.qty || 1) + delta } : m
  ).filter(m => m.qty > 0);
}

function inferRuleset(characters) {
  if (!characters || characters.length === 0) return '5e';
  const counts = { '5e': 0, '2024': 0 };
  characters.forEach(c => {
    if (c.rules === '2024') counts['2024']++;
    else counts['5e']++;
  });
  return counts['2024'] > counts['5e'] ? '2024' : '5e';
}

function loadSavedFilter(rulesVersion) {
  try {
    const key = `encounterFilter-${rulesVersion}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.difficulty === 'number') {
        return parsed;
      }
    }
  } catch { /* ignore corrupt data */ }
  return null;
}

function saveFilter(filter, rulesVersion) {
  try {
    const key = `encounterFilter-${rulesVersion}`;
    localStorage.setItem(key, JSON.stringify({ difficulty: filter.difficulty }));
  } catch { /* storage full, ignore */ }
}

function stripMonsters(monsters) {
  return monsters.map(m => ({
    index: m.index,
    name: m.name,
    qty: m.qty || 1,
  }));
}

describe('EncounterBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    window.localStorage.clear();
    monstersDataState = { monsters: [], loading: false };
  });

  describe('loading state', () => {
    it('should render loading content when monsters are loading', () => {
      monstersDataState = { monsters: [], loading: true };

      render(<EncounterBuilder {...defaultProps} />);

      expect(screen.getByText(/Loading monsters/)).toBeInTheDocument();
      expect(screen.queryByTestId('filter-panel')).not.toBeInTheDocument();

      monstersDataState = { monsters: [], loading: false };
    });
  });

  describe('default render', () => {
    it('should render the encounter title', () => {
      render(<EncounterBuilder {...defaultProps} />);
      expect(screen.getByText('Encounter Builder')).toBeInTheDocument();
    });

    it('should render party summary with character names and levels', () => {
      render(<EncounterBuilder {...defaultProps} />);
      expect(screen.getByText(/Aragorn/)).toBeInTheDocument();
      expect(screen.getByText(/Gandalf/)).toBeInTheDocument();
      expect(screen.getByText(/Lv5/)).toBeInTheDocument();
      expect(screen.getByText(/Lv10/)).toBeInTheDocument();
    });

    it('should render all action buttons', () => {
      render(<EncounterBuilder {...defaultProps} />);
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Load')).toBeInTheDocument();
      expect(screen.getByText('Generate')).toBeInTheDocument();
    });

    it('should render filter panel, summary panel, monster table, and selected monsters', () => {
      render(<EncounterBuilder {...defaultProps} />);
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
      expect(screen.getByTestId('summary-panel')).toBeInTheDocument();
      expect(screen.getByTestId('monster-table')).toBeInTheDocument();
      expect(screen.getByTestId('selected-monsters')).toBeInTheDocument();
    });

    it('should render description field', () => {
      render(<EncounterBuilder {...defaultProps} />);
      expect(screen.getByTestId('field-encounter-description')).toBeInTheDocument();
    });
  });

  describe('empty characters', () => {
    it('should show no characters message when characters is empty', () => {
      render(<EncounterBuilder characters={[]} campaignName="test" />);
      expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    });

    it('should show no characters message when characters is null', () => {
      render(<EncounterBuilder characters={null} campaignName="test" />);
      expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    });

    it('should show no characters message when characters is undefined', () => {
      render(<EncounterBuilder campaignName="test" />);
      expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    });
  });

  describe('reset button visibility', () => {
    it('should not show reset button initially', () => {
      render(<EncounterBuilder {...defaultProps} />);
      expect(screen.queryByText('Reset')).not.toBeInTheDocument();
    });
  });

  describe('party member tags', () => {
    it('should show party member tags with correct levels', () => {
      render(<EncounterBuilder {...defaultProps} />);
      const partyLabel = screen.getByText(/Party/);
      const partySummary = partyLabel.parentElement || partyLabel;
      expect(partySummary.textContent).toContain('Aragorn');
      expect(partySummary.textContent).toContain('Gandalf');
    });

    it('should show level 1 for characters without level', () => {
      render(
        <EncounterBuilder
          characters={[{ name: 'Frodo', rules: '5e' }]}
          campaignName="test"
        />
      );
      expect(screen.getByText(/Lv1/)).toBeInTheDocument();
    });
  });

  describe('description editing', () => {
    it('should update description when text is entered', () => {
      render(<EncounterBuilder {...defaultProps} />);
      const textarea = screen.getByTestId('field-encounter-description');
      fireEvent.change(textarea, { target: { value: 'A dark cave encounter' } });
      expect(textarea.value).toBe('A dark cave encounter');
    });
  });
});

describe('Pure functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  describe('calculateXPThreshold', () => {
    it('should sum thresholds for given levels and difficulty', () => {
      expect(calculateXPThreshold([5, 10], 2)).toBe(750 + 1900);
    });

    it('should return 0 for empty levels', () => {
      expect(calculateXPThreshold([], 0)).toBe(0);
    });

    it('should handle level 0', () => {
      expect(calculateXPThreshold([0], 0)).toBe(15);
      expect(calculateXPThreshold([0], 3)).toBe(50);
    });

    it('should handle level 20', () => {
      expect(calculateXPThreshold([20], 0)).toBe(2800);
      expect(calculateXPThreshold([20], 3)).toBe(12700);
    });

    it('should ignore invalid levels (negative)', () => {
      expect(calculateXPThreshold([-1], 0)).toBe(0);
    });

    it('should ignore invalid levels (above 20)', () => {
      expect(calculateXPThreshold([21], 0)).toBe(0);
    });

    it('should ignore non-numeric levels', () => {
      expect(calculateXPThreshold(['abc'], 0)).toBe(0);
    });

    it('should handle string numeric levels', () => {
      expect(calculateXPThreshold(['5'], 2)).toBe(750);
    });

    it('should handle all difficulty indices', () => {
      expect(calculateXPThreshold([1], 0)).toBe(25);
      expect(calculateXPThreshold([1], 1)).toBe(50);
      expect(calculateXPThreshold([1], 2)).toBe(75);
      expect(calculateXPThreshold([1], 3)).toBe(100);
    });

    it('should handle mixed valid and invalid levels', () => {
      expect(calculateXPThreshold([5, -1, 10, 21], 2)).toBe(750 + 1900);
    });
  });

  describe('calculateMaxXP', () => {
    it('should return 2x the threshold', () => {
      expect(calculateMaxXP([5, 10], 2)).toBe((750 + 1900) * 2);
    });

    it('should return 0 for empty levels', () => {
      expect(calculateMaxXP([], 0)).toBe(0);
    });

    it('should handle single player', () => {
      expect(calculateMaxXP([1], 0)).toBe(25 * 2);
    });

    it('should handle Deadly difficulty', () => {
      expect(calculateMaxXP([5], 3)).toBe(1100 * 2);
    });
  });

  describe('calculateDifficultyMultiplier', () => {
    it('should return 1 for 0 monsters', () => {
      expect(calculateDifficultyMultiplier(0)).toBe(1);
    });

    it('should return 1 for 1 monster', () => {
      expect(calculateDifficultyMultiplier(1)).toBe(1);
    });

    it('should return 1.5 for 2 monsters', () => {
      expect(calculateDifficultyMultiplier(2)).toBe(1.5);
    });

    it('should return 2 for 3 monsters', () => {
      expect(calculateDifficultyMultiplier(3)).toBe(2);
    });

    it('should return 2 for 6 monsters', () => {
      expect(calculateDifficultyMultiplier(6)).toBe(2);
    });

    it('should return 2.5 for 7 monsters', () => {
      expect(calculateDifficultyMultiplier(7)).toBe(2.5);
    });

    it('should return 2.5 for 10 monsters', () => {
      expect(calculateDifficultyMultiplier(10)).toBe(2.5);
    });

    it('should return 3 for 11 monsters', () => {
      expect(calculateDifficultyMultiplier(11)).toBe(3);
    });

    it('should return 3 for 14 monsters', () => {
      expect(calculateDifficultyMultiplier(14)).toBe(3);
    });

    it('should return 4 for 15 monsters', () => {
      expect(calculateDifficultyMultiplier(15)).toBe(4);
    });

    it('should return 4 for 20 monsters', () => {
      expect(calculateDifficultyMultiplier(20)).toBe(4);
    });
  });

  describe('calculateDifficultyIndex', () => {
    it('should return 0 for ratio below 0.5', () => {
      expect(calculateDifficultyIndex(49, 100)).toBe(0);
    });

    it('should return 0 for ratio exactly 0', () => {
      expect(calculateDifficultyIndex(0, 100)).toBe(0);
    });

    it('should return 1 for ratio 0.5', () => {
      expect(calculateDifficultyIndex(50, 100)).toBe(1);
    });

    it('should return 1 for ratio below 1', () => {
      expect(calculateDifficultyIndex(99, 100)).toBe(1);
    });

    it('should return 2 for ratio 1', () => {
      expect(calculateDifficultyIndex(100, 100)).toBe(2);
    });

    it('should return 2 for ratio below 1.5', () => {
      expect(calculateDifficultyIndex(149, 100)).toBe(2);
    });

    it('should return 3 for ratio 1.5', () => {
      expect(calculateDifficultyIndex(150, 100)).toBe(3);
    });

    it('should return 3 for ratio above 1.5', () => {
      expect(calculateDifficultyIndex(200, 100)).toBe(3);
    });

    it('should return 0 when totalThreshold is 0', () => {
      expect(calculateDifficultyIndex(100, 0)).toBe(0);
    });

    it('should return 0 when totalThreshold is falsy', () => {
      expect(calculateDifficultyIndex(100, null)).toBe(0);
      expect(calculateDifficultyIndex(100, undefined)).toBe(0);
    });
  });

  describe('calculateTotalMonsterXP', () => {
    it('should sum xp*qty for selected monsters', () => {
      const selected = [
        { xp: 200, qty: 2 },
        { xp: 450, qty: 1 },
      ];
      expect(calculateTotalMonsterXP(selected)).toBe(850);
    });

    it('should return 0 for empty selection', () => {
      expect(calculateTotalMonsterXP([])).toBe(0);
    });

    it('should default qty to 1 when missing', () => {
      const selected = [{ xp: 100 }];
      expect(calculateTotalMonsterXP(selected)).toBe(100);
    });

    it('should default xp to 0 when missing', () => {
      const selected = [{ qty: 3 }];
      expect(calculateTotalMonsterXP(selected)).toBe(0);
    });

    it('should handle monsters with both xp and qty missing', () => {
      const selected = [{}];
      expect(calculateTotalMonsterXP(selected)).toBe(0);
    });

    it('should handle single monster', () => {
      const selected = [{ xp: 800, qty: 5 }];
      expect(calculateTotalMonsterXP(selected)).toBe(4000);
    });
  });

  describe('calculateMonsterCount', () => {
    it('should sum qty for selected monsters', () => {
      const selected = [
        { qty: 2 },
        { qty: 3 },
        { qty: 1 },
      ];
      expect(calculateMonsterCount(selected)).toBe(6);
    });

    it('should return 0 for empty selection', () => {
      expect(calculateMonsterCount([])).toBe(0);
    });

    it('should default qty to 1 when missing', () => {
      const selected = [{}, { qty: 2 }];
      expect(calculateMonsterCount(selected)).toBe(3);
    });
  });

  describe('filterMonsters', () => {
    const monsters = [
      { name: 'Goblin', xp: 500, challenge_rating: 4, type: 'humanoid', subtype: 'goblinoid' },
      { name: 'Ancient Dragon', xp: 18000, challenge_rating: 17, type: 'dragon', subtype: '' },
      { name: 'Orc', xp: 700, challenge_rating: 6, type: 'humanoid', subtype: '' },
      { name: 'Skeleton Warrior', xp: 450, challenge_rating: 3, type: 'undead', subtype: '' },
      { name: 'Troll', xp: 1800, challenge_rating: 5, type: 'giant', subtype: '' },
    ];

    it('should return empty array for null monsters', () => {
      expect(filterMonsters(null, '', [5], 2, 1000)).toEqual([]);
    });

    it('should return empty array for undefined monsters', () => {
      expect(filterMonsters(undefined, '', [5], 2, 1000)).toEqual([]);
    });

    it('should filter by maxXP', () => {
      const result = filterMonsters(monsters, '', [5], 2, 1000);
      const names = result.map(m => m.name);
      expect(names).not.toContain('Ancient Dragon');
    });

    it('should filter by minXP', () => {
      const result = filterMonsters(monsters, '', [5], 2, 10000);
      const names = result.map(m => m.name);
      expect(names).not.toContain('Goblin');
      expect(names).not.toContain('Orc');
      expect(names).not.toContain('Skeleton Warrior');
    });

    it('should filter by search query matching name', () => {
      const result = filterMonsters(monsters, 'gob', [5], 2, 1000);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Goblin');
    });

    it('should filter by search query matching type', () => {
      const result = filterMonsters(monsters, 'undead', [5], 2, 1000);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Skeleton Warrior');
    });

    it('should filter by search query matching subtype', () => {
      const result = filterMonsters(monsters, 'goblinoid', [5], 2, 1000);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Goblin');
    });

    it('should be case insensitive for search', () => {
      const result = filterMonsters(monsters, 'GOB', [5], 2, 1000);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Goblin');
    });

    it('should return all monsters when search query is empty', () => {
      const standardMonsters = [
        { name: 'Young Dragon', xp: 5000, challenge_rating: 12, type: 'dragon' },
        { name: 'Orc Warlord', xp: 7000, challenge_rating: 14, type: 'humanoid' },
        { name: 'Lich', xp: 4500, challenge_rating: 11, type: 'undead' },
        { name: 'Storm Giant', xp: 1800, challenge_rating: 13, type: 'giant' },
        { name: 'Beholder', xp: 9000, challenge_rating: 15, type: 'aberration' },
      ];
      const result = filterMonsters(standardMonsters, '', [20], 3, 0);
      expect(result.length).toBe(5);
    });

    it('should filter by minCR based on difficulty', () => {
      const lowLevelMonsters = [
        { name: 'Rat', xp: 10, challenge_rating: 0, type: 'beast' },
        { name: 'Wolf', xp: 200, challenge_rating: 0.25, type: 'beast' },
      ];
      const result = filterMonsters(lowLevelMonsters, '', [1], 0, 1000);
      const names = result.map(m => m.name);
      expect(names).not.toContain('Rat');
    });

    it('should handle monsters with null subtype', () => {
      const monstersWithNullSubtype = [
        { name: 'Zombie', xp: 500, challenge_rating: 4, type: 'undead', subtype: null },
      ];
      const result = filterMonsters(monstersWithNullSubtype, 'zombie', [5], 2, 1000);
      expect(result.length).toBe(1);
    });

    it('should handle monsters with undefined type', () => {
      const monstersNoType = [
        { name: 'Ghost', xp: 500, challenge_rating: 4 },
      ];
      const result = filterMonsters(monstersNoType, 'ghost', [5], 2, 1000);
      expect(result.length).toBe(1);
    });
  });

  describe('toggleMonster', () => {
    it('should add monster if not selected', () => {
      const selected = [];
      const monster = { index: 'goblin', name: 'Goblin', xp: 50 };
      const result = toggleMonster(selected, monster);
      expect(result).toHaveLength(1);
      expect(result[0].index).toBe('goblin');
      expect(result[0].qty).toBe(1);
    });

    it('should decrement qty if monster already selected', () => {
      const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 3 }];
      const monster = { index: 'goblin', name: 'Goblin', xp: 50 };
      const result = toggleMonster(selected, monster);
      expect(result).toHaveLength(1);
      expect(result[0].qty).toBe(2);
    });

    it('should remove monster when qty reaches 0', () => {
      const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 1 }];
      const monster = { index: 'goblin', name: 'Goblin', xp: 50 };
      const result = toggleMonster(selected, monster);
      expect(result).toHaveLength(0);
    });

    it('should not affect other monsters in selection', () => {
      const selected = [
        { index: 'goblin', name: 'Goblin', xp: 50, qty: 2 },
        { index: 'orc', name: 'Orc', xp: 100, qty: 1 },
      ];
      const monster = { index: 'goblin', name: 'Goblin', xp: 50 };
      const result = toggleMonster(selected, monster);
      expect(result).toHaveLength(2);
      expect(result[0].qty).toBe(1);
      expect(result[1].qty).toBe(1);
    });

    it('should default qty to 1 when missing on existing monster', () => {
      const selected = [{ index: 'goblin', name: 'Goblin', xp: 50 }];
      const monster = { index: 'goblin', name: 'Goblin', xp: 50 };
      const result = toggleMonster(selected, monster);
      expect(result).toHaveLength(0);
    });
  });

  describe('updateQty', () => {
    it('should increment qty', () => {
      const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 2 }];
      const result = updateQty(selected, 'goblin', 1);
      expect(result[0].qty).toBe(3);
    });

    it('should decrement qty', () => {
      const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 3 }];
      const result = updateQty(selected, 'goblin', -1);
      expect(result[0].qty).toBe(2);
    });

    it('should remove monster when qty reaches 0', () => {
      const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 1 }];
      const result = updateQty(selected, 'goblin', -1);
      expect(result).toHaveLength(0);
    });

    it('should not affect other monsters', () => {
      const selected = [
        { index: 'goblin', name: 'Goblin', xp: 50, qty: 2 },
        { index: 'orc', name: 'Orc', xp: 100, qty: 1 },
      ];
      const result = updateQty(selected, 'goblin', 1);
      expect(result).toHaveLength(2);
      expect(result[1].qty).toBe(1);
    });

    it('should default qty to 1 when missing', () => {
      const selected = [{ index: 'goblin', name: 'Goblin', xp: 50 }];
      const result = updateQty(selected, 'goblin', 1);
      expect(result[0].qty).toBe(2);
    });

    it('should handle large delta', () => {
      const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 5 }];
      const result = updateQty(selected, 'goblin', 10);
      expect(result[0].qty).toBe(15);
    });
  });

  describe('inferRuleset', () => {
    it('should return 5e when majority is 5e', () => {
      const characters = [
        { name: 'A', rules: '5e' },
        { name: 'B', rules: '5e' },
        { name: 'C', rules: '2024' },
      ];
      expect(inferRuleset(characters)).toBe('5e');
    });

    it('should return 2024 when majority is 2024', () => {
      const characters = [
        { name: 'A', rules: '2024' },
        { name: 'B', rules: '2024' },
        { name: 'C', rules: '5e' },
      ];
      expect(inferRuleset(characters)).toBe('2024');
    });

    it('should return 5e for empty array', () => {
      expect(inferRuleset([])).toBe('5e');
    });

    it('should return 5e for null', () => {
      expect(inferRuleset(null)).toBe('5e');
    });

    it('should return 5e for undefined', () => {
      expect(inferRuleset(undefined)).toBe('5e');
    });

    it('should return 5e when tied', () => {
      const characters = [
        { name: 'A', rules: '5e' },
        { name: 'B', rules: '2024' },
      ];
      expect(inferRuleset(characters)).toBe('5e');
    });

    it('should treat unknown rules as 5e', () => {
      const characters = [
        { name: 'A', rules: '3.5e' },
        { name: 'B', rules: '2024' },
      ];
      expect(inferRuleset(characters)).toBe('5e');
    });

    it('should handle all 2024', () => {
      const characters = [
        { name: 'A', rules: '2024' },
        { name: 'B', rules: '2024' },
      ];
      expect(inferRuleset(characters)).toBe('2024');
    });

    it('should handle single character', () => {
      expect(inferRuleset([{ name: 'A', rules: '2024' }])).toBe('2024');
      expect(inferRuleset([{ name: 'A', rules: '5e' }])).toBe('5e');
    });
  });

  describe('loadSavedFilter', () => {
    it('should return null when no saved filter', () => {
      expect(loadSavedFilter('5e')).toBeNull();
    });

    it('should load saved filter from localStorage', () => {
      const saved = { difficulty: 2 };
      window.localStorage.setItem('encounterFilter-5e', JSON.stringify(saved));
      expect(loadSavedFilter('5e')).toEqual(saved);
    });

    it('should return null for corrupt JSON data', () => {
      window.localStorage.setItem('encounterFilter-5e', 'not-valid-json{{{');
      expect(loadSavedFilter('5e')).toBeNull();
    });

    it('should return null when difficulty is missing', () => {
      window.localStorage.setItem('encounterFilter-5e', JSON.stringify({ search: 'goblin' }));
      expect(loadSavedFilter('5e')).toBeNull();
    });

    it('should return null when parsed value is null', () => {
      window.localStorage.setItem('encounterFilter-5e', JSON.stringify(null));
      expect(loadSavedFilter('5e')).toBeNull();
    });

    it('should load 2024 filter separately from 5e', () => {
      window.localStorage.setItem('encounterFilter-5e', JSON.stringify({ difficulty: 1 }));
      window.localStorage.setItem('encounterFilter-2024', JSON.stringify({ difficulty: 3 }));
      expect(loadSavedFilter('5e')).toEqual({ difficulty: 1 });
      expect(loadSavedFilter('2024')).toEqual({ difficulty: 3 });
    });
  });

  describe('saveFilter', () => {
    it('should save difficulty to localStorage', () => {
      saveFilter({ difficulty: 2 }, '5e');
      const stored = JSON.parse(window.localStorage.getItem('encounterFilter-5e'));
      expect(stored).toEqual({ difficulty: 2 });
    });

    it('should save to separate keys per rules version', () => {
      saveFilter({ difficulty: 1 }, '5e');
      saveFilter({ difficulty: 3 }, '2024');
      expect(JSON.parse(window.localStorage.getItem('encounterFilter-5e'))).toEqual({ difficulty: 1 });
      expect(JSON.parse(window.localStorage.getItem('encounterFilter-2024'))).toEqual({ difficulty: 3 });
    });

    it('should overwrite previous saved filter', () => {
      saveFilter({ difficulty: 0 }, '5e');
      saveFilter({ difficulty: 3 }, '5e');
      const stored = JSON.parse(window.localStorage.getItem('encounterFilter-5e'));
      expect(stored).toEqual({ difficulty: 3 });
    });

    it('should only save difficulty, not other filter properties', () => {
      saveFilter({ difficulty: 2, playerLevels: [5, 10], search: 'goblin' }, '5e');
      const stored = JSON.parse(window.localStorage.getItem('encounterFilter-5e'));
      expect(stored).toEqual({ difficulty: 2 });
      expect(stored.playerLevels).toBeUndefined();
      expect(stored.search).toBeUndefined();
    });
  });

  describe('stripMonsters', () => {
    it('should return only index, name, qty', () => {
      const monsters = [
        { index: 'goblin', name: 'Goblin', xp: 50, qty: 3, challenge_rating: 0.25, type: 'humanoid' },
      ];
      const result = stripMonsters(monsters);
      expect(result).toEqual([{ index: 'goblin', name: 'Goblin', qty: 3 }]);
    });

    it('should default qty to 1 when missing', () => {
      const monsters = [
        { index: 'goblin', name: 'Goblin', xp: 50 },
      ];
      const result = stripMonsters(monsters);
      expect(result[0].qty).toBe(1);
    });

    it('should handle empty array', () => {
      expect(stripMonsters([])).toEqual([]);
    });

    it('should handle multiple monsters', () => {
      const monsters = [
        { index: 'goblin', name: 'Goblin', xp: 50, qty: 2 },
        { index: 'orc', name: 'Orc', xp: 100, qty: 1 },
      ];
      const result = stripMonsters(monsters);
      expect(result).toEqual([
        { index: 'goblin', name: 'Goblin', qty: 2 },
        { index: 'orc', name: 'Orc', qty: 1 },
      ]);
    });

    it('should not include extra properties', () => {
      const monsters = [
        { index: 'goblin', name: 'Goblin', xp: 50, qty: 1, environment: 'forest', alignment: 'CE' },
      ];
      const result = stripMonsters(monsters);
      expect(Object.keys(result[0])).toEqual(['index', 'name', 'qty']);
    });
  });
});
