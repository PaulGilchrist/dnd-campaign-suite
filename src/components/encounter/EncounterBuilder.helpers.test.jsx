import { describe, it, expect } from 'vitest';

describe('toggleMonster', () => {
  function toggleMonster(selected, monster) {
    const existing = selected.find(m => m.index === monster.index);
    if (existing) {
      return selected.map(m =>
        m.index === monster.index ? { ...m, qty: (m.qty || 1) - 1 } : m
      ).filter(m => m.qty > 0);
    }
    return [...selected, { ...monster, qty: 1 }];
  }

  it('adds a new monster with qty 1, decrements qty on re-toggle, and removes when qty reaches 0', () => {
    const monster = { index: 'goblin', name: 'Goblin', xp: 50 };

    // add
    expect(toggleMonster([], monster)).toEqual([{ index: 'goblin', name: 'Goblin', xp: 50, qty: 1 }]);
    // decrement
    expect(toggleMonster([{ ...monster, qty: 2 }], monster)).toEqual([{ ...monster, qty: 1 }]);
    // remove
    expect(toggleMonster([{ ...monster, qty: 1 }], monster)).toEqual([]);
  });

  it('preserves other monsters when toggling one with qty > 1', () => {
    const selected = [
      { index: 'goblin', name: 'Goblin', xp: 50, qty: 2 },
      { index: 'orc', name: 'Orc', xp: 100, qty: 1 },
    ];
    const result = toggleMonster(selected, { index: 'goblin', name: 'Goblin', xp: 50 });
    expect(result).toHaveLength(2);
    expect(result.find(m => m.index === 'orc')).toEqual({ index: 'orc', name: 'Orc', xp: 100, qty: 1 });
    expect(result.find(m => m.index === 'goblin').qty).toBe(1);
  });
});

describe('updateQty', () => {
  function updateQty(selected, index, delta) {
    return selected.map(m =>
      m.index === index ? { ...m, qty: (m.qty || 1) + delta } : m
    ).filter(m => m.qty > 0);
  }

  it('increases or decreases qty by delta', () => {
    const base = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 2 }];
    expect(updateQty(base, 'goblin', 1)[0].qty).toBe(3);
    expect(updateQty(base, 'goblin', -1)[0].qty).toBe(1);
  });

  it('removes monster when qty goes to 0 or negative', () => {
    const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 1 }];
    expect(updateQty(selected, 'goblin', -1)).toEqual([]);
    expect(updateQty(selected, 'goblin', -2)).toEqual([]);
  });

  it('does not affect other monsters', () => {
    const selected = [
      { index: 'goblin', name: 'Goblin', xp: 50, qty: 1 },
      { index: 'orc', name: 'Orc', xp: 100, qty: 2 },
    ];
    const result = updateQty(selected, 'goblin', 1);
    expect(result).toHaveLength(2);
    expect(result.find(m => m.index === 'orc').qty).toBe(2);
  });
});

describe('calculateTotalMonsterXP', () => {
  function calculateTotalMonsterXP(selectedMonsters) {
    return selectedMonsters.reduce((sum, m) => sum + (m.xp || 0) * (m.qty || 1), 0);
  }

  it('calculates total XP with single and multiple monsters', () => {
    expect(calculateTotalMonsterXP([{ index: 'goblin', xp: 50, qty: 1 }])).toBe(50);
    expect(calculateTotalMonsterXP([
      { index: 'goblin', xp: 50, qty: 2 },
      { index: 'orc', xp: 100, qty: 1 },
    ])).toBe(200);
  });

  it('handles missing xp as 0, missing qty as 1, and empty array', () => {
    expect(calculateTotalMonsterXP([{ index: 'goblin', qty: 1 }])).toBe(0);
    expect(calculateTotalMonsterXP([{ index: 'goblin', xp: 50 }])).toBe(50);
    expect(calculateTotalMonsterXP([])).toBe(0);
  });
});

describe('calculateMonsterCount', () => {
  function calculateMonsterCount(selectedMonsters) {
    return selectedMonsters.reduce((sum, m) => sum + (m.qty || 1), 0);
  }

  it('counts total creatures and handles missing qty as 1', () => {
    expect(calculateMonsterCount([
      { index: 'goblin', qty: 2 },
      { index: 'orc', qty: 1 },
    ])).toBe(3);
    expect(calculateMonsterCount([{ index: 'goblin' }])).toBe(1);
  });

  it('returns 0 for empty array', () => {
    expect(calculateMonsterCount([])).toBe(0);
  });
});

describe('calculateDifficultyIndex', () => {
  function calculateDifficultyIndex(effectiveXP, totalThreshold) {
    if (!totalThreshold) return 0;
    const ratio = effectiveXP / totalThreshold;
    if (ratio < 0.5) return 0;
    if (ratio < 1) return 1;
    if (ratio < 1.5) return 2;
    return 3;
  }

  it('returns 0 (Easy) for ratio < 0.5, 1 (Medium) for >= 0.5 and < 1, 2 (Hard) for >= 1 and < 1.5, and 3 (Deadly) for >= 1.5', () => {
    expect(calculateDifficultyIndex(49, 100)).toBe(0);
    expect(calculateDifficultyIndex(50, 100)).toBe(1);
    expect(calculateDifficultyIndex(99, 100)).toBe(1);
    expect(calculateDifficultyIndex(100, 100)).toBe(2);
    expect(calculateDifficultyIndex(149, 100)).toBe(2);
    expect(calculateDifficultyIndex(150, 100)).toBe(3);
    expect(calculateDifficultyIndex(200, 100)).toBe(3);
  });

  it('returns 0 when totalThreshold is falsy', () => {
    expect(calculateDifficultyIndex(100, 0)).toBe(0);
    expect(calculateDifficultyIndex(100, null)).toBe(0);
    expect(calculateDifficultyIndex(100, undefined)).toBe(0);
  });
});

describe('filterMonsters', () => {
  function filterMonsters(monsters, searchQuery, playerLevels, difficultyIndex, totalThreshold, environmentFilter) {
    if (!monsters) return [];
    return monsters.filter(m => {
      if (environmentFilter && m.environments && !m.environments.includes(environmentFilter)) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return m.name.toLowerCase().includes(q)
        || (m.type && m.type.toLowerCase().includes(q))
        || (m.subtype && m.subtype.toLowerCase().includes(q));
    });
  }

  const monsters = [
    { index: 'goblin', name: 'Goblin', xp: 50, type: 'humanoid', subtype: 'tribe', environments: ['forest'] },
    { index: 'orc', name: 'Orc', xp: 100, type: 'humanoid', subtype: 'warrior', environments: ['hill', 'mountain'] },
    { index: 'dragon', name: 'Young Dragon', xp: 5900, type: 'dragon', environments: ['underground'] },
    { index: 'slime', name: 'Green Slime', xp: 2000, type: 'ooze', environments: ['underdark', 'cave'] },
  ];

  it('filters by search query matching name, type, or subtype (case-insensitive)', () => {
    expect(filterMonsters(monsters, 'goblin', [1, 1, 1], 1, 150, '').map(m => m.index)).toEqual(['goblin']);
    expect(filterMonsters(monsters, 'dragon', [15, 15, 15], 1, 8400, '').map(m => m.index)).toContain('dragon');
    expect(filterMonsters(monsters, 'tribe', [1, 1, 1], 1, 150, '').map(m => m.index)).toEqual(['goblin']);
    expect(filterMonsters(monsters, 'GOBLIN', [1, 1, 1], 1, 150, '').map(m => m.index)).toEqual(['goblin']);
  });

  it('filters by environment only', () => {
    expect(filterMonsters(monsters, '', [15, 15, 15], 1, 8400, 'underdark').map(m => m.index)).toEqual(['slime']);
    expect(filterMonsters(monsters, '', [1, 1, 1], 1, 150, '').map(m => m.index)).toEqual(['goblin', 'orc', 'dragon', 'slime']);
    expect(filterMonsters(monsters, '', [15, 15, 15], 1, 0, '').map(m => m.index)).toEqual(['goblin', 'orc', 'dragon', 'slime']);
  });

  it('returns empty array when monsters is null or no monsters match', () => {
    expect(filterMonsters(null, '', [1], 1, 50, '')).toEqual([]);
    expect(filterMonsters(monsters, 'unicorn', [1, 1, 1], 1, 150, '')).toEqual([]);
  });
});

describe('stripMonsters', () => {
  function stripMonsters(monsters) {
    return monsters.map(m => ({
      index: m.index,
      name: m.name,
      qty: m.qty || 1,
    }));
  }

  it('strips monster data to minimal fields and defaults qty to 1', () => {
    expect(stripMonsters([
      { index: 'goblin', name: 'Goblin', xp: 50, qty: 2, challenge_rating: 0.25 },
    ])).toEqual([{ index: 'goblin', name: 'Goblin', qty: 2 }]);

    expect(stripMonsters([{ index: 'goblin', name: 'Goblin' }])).toEqual([
      { index: 'goblin', name: 'Goblin', qty: 1 },
    ]);
  });

  it('handles empty array', () => {
    expect(stripMonsters([])).toEqual([]);
  });
});

describe('loadSavedFilter', () => {
  function loadSavedFilter() {
    try {
      const key = 'encounterFilter-2024';
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

  it('returns saved filter with difficulty number', () => {
    localStorage.setItem('encounterFilter-2024', JSON.stringify({ difficulty: 2, environment: 'forest' }));
    expect(loadSavedFilter()).toEqual({ difficulty: 2, environment: 'forest' });
  });

  it('returns null when difficulty is not a number, data is missing, corrupt, or absent', () => {
    localStorage.setItem('encounterFilter-2024', JSON.stringify({ difficulty: 'hard', environment: 'forest' }));
    expect(loadSavedFilter()).toBeNull();

    localStorage.setItem('encounterFilter-2024', JSON.stringify({ environment: 'forest' }));
    expect(loadSavedFilter()).toBeNull();

    localStorage.setItem('encounterFilter-2024', 'not json');
    expect(loadSavedFilter()).toBeNull();

    localStorage.removeItem('encounterFilter-2024');
    expect(loadSavedFilter()).toBeNull();
  });
});

describe('saveFilter', () => {
  function saveFilter(filter) {
    try {
      const key = 'encounterFilter-2024';
      localStorage.setItem(key, JSON.stringify({ difficulty: filter.difficulty, environment: filter.environment }));
    } catch { /* storage full, ignore */ }
  }

  it('saves difficulty and environment to localStorage', () => {
    saveFilter({ difficulty: 2, environment: 'mountain' });
    const saved = JSON.parse(localStorage.getItem('encounterFilter-2024'));
    expect(saved).toEqual({ difficulty: 2, environment: 'mountain' });

    saveFilter({ difficulty: 0, environment: '' });
    const savedEmpty = JSON.parse(localStorage.getItem('encounterFilter-2024'));
    expect(savedEmpty).toEqual({ difficulty: 0, environment: '' });
  });
});

// @cleaned-by-ai
