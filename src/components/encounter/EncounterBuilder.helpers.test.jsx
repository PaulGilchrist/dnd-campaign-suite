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

  it('adds a new monster with qty 1', () => {
    const result = toggleMonster([], { index: 'goblin', name: 'Goblin', xp: 50 });
    expect(result).toEqual([{ index: 'goblin', name: 'Goblin', xp: 50, qty: 1 }]);
  });

  it('decrements qty when monster already selected (second toggle)', () => {
    const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 2 }];
    const result = toggleMonster(selected, { index: 'goblin', name: 'Goblin', xp: 50 });
    expect(result).toEqual([{ index: 'goblin', name: 'Goblin', xp: 50, qty: 1 }]);
  });

  it('removes monster when qty reaches 0', () => {
    const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 1 }];
    const result = toggleMonster(selected, { index: 'goblin', name: 'Goblin', xp: 50 });
    expect(result).toEqual([]);
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

  it('increases qty by delta', () => {
    const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 1 }];
    const result = updateQty(selected, 'goblin', 1);
    expect(result[0].qty).toBe(2);
  });

  it('decreases qty by delta', () => {
    const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 3 }];
    const result = updateQty(selected, 'goblin', -1);
    expect(result[0].qty).toBe(2);
  });

  it('removes monster when qty goes to 0', () => {
    const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 1 }];
    const result = updateQty(selected, 'goblin', -1);
    expect(result).toEqual([]);
  });

  it('removes monster when qty goes negative', () => {
    const selected = [{ index: 'goblin', name: 'Goblin', xp: 50, qty: 1 }];
    const result = updateQty(selected, 'goblin', -2);
    expect(result).toEqual([]);
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

  it('calculates total XP with single monster', () => {
    const result = calculateTotalMonsterXP([{ index: 'goblin', xp: 50, qty: 1 }]);
    expect(result).toBe(50);
  });

  it('calculates total XP with multiple monsters', () => {
    const result = calculateTotalMonsterXP([
      { index: 'goblin', xp: 50, qty: 2 },
      { index: 'orc', xp: 100, qty: 1 },
    ]);
    expect(result).toBe(200);
  });

  it('handles missing xp as 0', () => {
    const result = calculateTotalMonsterXP([{ index: 'goblin', qty: 1 }]);
    expect(result).toBe(0);
  });

  it('handles missing qty as 1', () => {
    const result = calculateTotalMonsterXP([{ index: 'goblin', xp: 50 }]);
    expect(result).toBe(50);
  });

  it('returns 0 for empty array', () => {
    const result = calculateTotalMonsterXP([]);
    expect(result).toBe(0);
  });
});

describe('calculateMonsterCount', () => {
  function calculateMonsterCount(selectedMonsters) {
    return selectedMonsters.reduce((sum, m) => sum + (m.qty || 1), 0);
  }

  it('counts total creatures', () => {
    const result = calculateMonsterCount([
      { index: 'goblin', qty: 2 },
      { index: 'orc', qty: 1 },
    ]);
    expect(result).toBe(3);
  });

  it('handles missing qty as 1', () => {
    const result = calculateMonsterCount([{ index: 'goblin' }]);
    expect(result).toBe(1);
  });

  it('returns 0 for empty array', () => {
    const result = calculateMonsterCount([]);
    expect(result).toBe(0);
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

  it('returns 0 (Easy) for ratio < 0.5', () => {
    expect(calculateDifficultyIndex(25, 100)).toBe(0);
    expect(calculateDifficultyIndex(49, 100)).toBe(0);
  });

  it('returns 1 (Medium) for ratio >= 0.5 and < 1', () => {
    expect(calculateDifficultyIndex(50, 100)).toBe(1);
    expect(calculateDifficultyIndex(99, 100)).toBe(1);
  });

  it('returns 2 (Hard) for ratio >= 1 and < 1.5', () => {
    expect(calculateDifficultyIndex(100, 100)).toBe(2);
    expect(calculateDifficultyIndex(149, 100)).toBe(2);
  });

  it('returns 3 (Deadly) for ratio >= 1.5', () => {
    expect(calculateDifficultyIndex(150, 100)).toBe(3);
    expect(calculateDifficultyIndex(200, 100)).toBe(3);
  });

  it('returns 0 when totalThreshold is 0', () => {
    expect(calculateDifficultyIndex(100, 0)).toBe(0);
  });

  it('returns 0 when totalThreshold is falsy', () => {
    expect(calculateDifficultyIndex(100, null)).toBe(0);
    expect(calculateDifficultyIndex(100, undefined)).toBe(0);
  });
});

describe('filterMonsters', () => {
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
        return sum + (xpThresholds[idx]?.[difficultyIndex] ?? 0);
      }
      return sum;
    }, 0);
  }

  function calculateMaxXP(playerLevels, difficultyIndex) {
    return calculateXPThreshold(playerLevels, difficultyIndex) * 1.5;
  }

  function filterMonsters(monsters, searchQuery, playerLevels, difficultyIndex, totalThreshold, environmentFilter) {
    if (!monsters) return [];
    const maxXP = calculateMaxXP(playerLevels, difficultyIndex);
    const minXP = totalThreshold * 0.15;
    return monsters.filter(m => {
      if (m.xp > maxXP) return false;
      if (m.xp < minXP) return false;
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

  it('filters by search query matching name', () => {
    const result = filterMonsters(monsters, 'goblin', [1, 1, 1], 1, 150, '');
    expect(result.map(m => m.index)).toEqual(['goblin']);
  });

  it('filters by search query matching type', () => {
    const result = filterMonsters(monsters, 'dragon', [15, 15, 15], 1, 8400, '');
    expect(result.map(m => m.index)).toContain('dragon');
  });

  it('filters by search query matching subtype', () => {
    const result = filterMonsters(monsters, 'tribe', [1, 1, 1], 1, 150, '');
    expect(result.map(m => m.index)).toEqual(['goblin']);
  });

  it('is case-insensitive for search', () => {
    const result = filterMonsters(monsters, 'GOBLIN', [1, 1, 1], 1, 150, '');
    expect(result.map(m => m.index)).toEqual(['goblin']);
  });

  it('filters by environment', () => {
    const result = filterMonsters(monsters, '', [15, 15, 15], 1, 8400, 'underdark');
    expect(result.map(m => m.index)).toEqual(['slime']);
  });

  it('excludes monsters above max XP', () => {
    const result = filterMonsters(monsters, '', [1, 1, 1], 1, 150, '');
    expect(result.map(m => m.index)).not.toContain('dragon');
  });

  it('excludes monsters below min XP threshold', () => {
    const result = filterMonsters(monsters, '', [15, 15, 15], 1, 0, '');
    expect(result.map(m => m.index)).toContain('slime');
  });

  it('returns empty array when monsters is null', () => {
    const result = filterMonsters(null, '', [1], 1, 50, '');
    expect(result).toEqual([]);
  });

  it('returns empty array when no monsters match search', () => {
    const result = filterMonsters(monsters, 'unicorn', [1, 1, 1], 1, 150, '');
    expect(result).toEqual([]);
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

  it('strips monster data to minimal fields', () => {
    const full = [
      { index: 'goblin', name: 'Goblin', xp: 50, qty: 2, challenge_rating: 0.25 },
    ];
    const result = stripMonsters(full);
    expect(result).toEqual([
      { index: 'goblin', name: 'Goblin', qty: 2 },
    ]);
  });

  it('defaults qty to 1 when missing', () => {
    const full = [{ index: 'goblin', name: 'Goblin' }];
    const result = stripMonsters(full);
    expect(result[0].qty).toBe(1);
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

  it('returns null when difficulty is not a number', () => {
    localStorage.setItem('encounterFilter-2024', JSON.stringify({ difficulty: 'hard', environment: 'forest' }));
    expect(loadSavedFilter()).toBeNull();
  });

  it('returns null when no saved data', () => {
    localStorage.removeItem('encounterFilter-2024');
    expect(loadSavedFilter()).toBeNull();
  });

  it('returns null when data is corrupt JSON', () => {
    localStorage.setItem('encounterFilter-2024', 'not json');
    expect(loadSavedFilter()).toBeNull();
  });

  it('returns null when data has no difficulty field', () => {
    localStorage.setItem('encounterFilter-2024', JSON.stringify({ environment: 'forest' }));
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
  });

  it('saves empty environment', () => {
    saveFilter({ difficulty: 0, environment: '' });
    const saved = JSON.parse(localStorage.getItem('encounterFilter-2024'));
    expect(saved).toEqual({ difficulty: 0, environment: '' });
  });
});
