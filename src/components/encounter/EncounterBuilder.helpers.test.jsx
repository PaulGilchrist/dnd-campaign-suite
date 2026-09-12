// @improved-by-ai
// @cleaned-by-ai
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
  });
});

describe('filterMonsters', () => {
  function crToNumber(cr) {
    if (cr === null || cr === undefined || cr === '' || cr === 'None') return NaN;
    const str = String(cr).trim().toLowerCase();
    if (str === 'any') return 999;
    const match = str.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (match) return parseInt(match[1], 10) / parseInt(match[2], 10);
    const num = parseFloat(str);
    return isNaN(num) ? NaN : num;
  }

  function matchesCrRange(m, crMinNum, crMaxNum) {
    if (crMinNum === null && crMaxNum === null) return true;
    const cr = crToNumber(m.challenge_rating);
    if (isNaN(cr)) return false;
    if (crMinNum !== null && cr < crMinNum) return false;
    if (crMaxNum !== null && cr > crMaxNum) return false;
    return true;
  }

  function matchesSearchQuery(m, q) {
    return m.name.toLowerCase().includes(q)
      || (m.type && m.type.toLowerCase().includes(q))
      || (m.subtype && m.subtype.toLowerCase().includes(q));
  }

  function filterMonsters(monsters, filter = {}) {
    if (!monsters) return [];
    const { searchQuery = '', environmentFilter = '', typeFilter = '', sizeFilter = '', crMin = '', crMax = '' } = filter;
    const crMinNum = !crMin ? null : parseFloat(crMin);
    const crMaxNum = !crMax ? null : parseFloat(crMax);
    const q = searchQuery ? searchQuery.toLowerCase() : '';
    return monsters.filter(m => {
      if (environmentFilter && m.environments && !m.environments.includes(environmentFilter)) return false;
      if (typeFilter && m.type && m.type.toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (sizeFilter && m.size && m.size.toLowerCase() !== sizeFilter.toLowerCase()) return false;
      if (!matchesCrRange(m, crMinNum, crMaxNum)) return false;
      if (!q) return true;
      return matchesSearchQuery(m, q);
    });
  }

  const monsters = [
    { index: 'goblin', name: 'Goblin', xp: 50, type: 'humanoid', subtype: 'tribe', environments: ['forest'], challenge_rating: 0.25 },
    { index: 'orc', name: 'Orc', xp: 100, type: 'humanoid', subtype: 'warrior', environments: ['hill', 'mountain'], challenge_rating: 0.5 },
    { index: 'dragon', name: 'Young Dragon', xp: 5900, type: 'dragon', environments: ['underground'], challenge_rating: 2 },
    { index: 'slime', name: 'Green Slime', xp: 2000, type: 'ooze', environments: ['underdark', 'cave'], challenge_rating: 1 },
    { index: 'tiger', name: 'Tiger', xp: 200, type: 'beast', environments: ['grassland', 'forest'], challenge_rating: 1 },
    { index: 'flaming-sphere', name: 'Flaming Sphere', xp: 200, type: 'construct', environments: ['desert'], challenge_rating: 1 },
    { index: 'shadow', name: 'Shadow', xp: 235, type: 'undead', environments: ['underdark'], challenge_rating: 0.5 },
  ];

  it('filters by search query matching name, type, or subtype (case-insensitive)', () => {
    expect(filterMonsters(monsters, { searchQuery: 'goblin' }).map(m => m.index)).toEqual(['goblin']);
    expect(filterMonsters(monsters, { searchQuery: 'dragon' }).map(m => m.index)).toContain('dragon');
    expect(filterMonsters(monsters, { searchQuery: 'tribe' }).map(m => m.index)).toEqual(['goblin']);
    expect(filterMonsters(monsters, { searchQuery: 'GOBLIN' }).map(m => m.index)).toEqual(['goblin']);
  });

  it('filters by environment only', () => {
    expect(filterMonsters(monsters, { environmentFilter: 'underdark' }).map(m => m.index)).toEqual(['slime', 'shadow']);
    expect(filterMonsters(monsters, {}).map(m => m.index)).toEqual(['goblin', 'orc', 'dragon', 'slime', 'tiger', 'flaming-sphere', 'shadow']);
    expect(filterMonsters(monsters, {}).map(m => m.index)).toEqual(['goblin', 'orc', 'dragon', 'slime', 'tiger', 'flaming-sphere', 'shadow']);
  });

  it('filters by type', () => {
    expect(filterMonsters(monsters, { typeFilter: 'humanoid' }).map(m => m.index)).toEqual(['goblin', 'orc']);
    expect(filterMonsters(monsters, { typeFilter: 'dragon' }).map(m => m.index)).toEqual(['dragon']);
    expect(filterMonsters(monsters, { typeFilter: 'beast' }).map(m => m.index)).toEqual(['tiger']);
  });

  it('filters by size', () => {
    const sizedMonsters = [
      { index: 'goblin', name: 'Goblin', type: 'humanoid', size: 'small', environments: ['forest'], challenge_rating: 0.25 },
      { index: 'orc', name: 'Orc', type: 'humanoid', size: 'medium', environments: ['hill'], challenge_rating: 0.5 },
      { index: 'ogre', name: 'Ogre', type: 'giant', size: 'huge', environments: ['hill'], challenge_rating: 3 },
    ];
    expect(filterMonsters(sizedMonsters, { sizeFilter: 'medium' }).map(m => m.index)).toEqual(['orc']);
    expect(filterMonsters(sizedMonsters, { sizeFilter: 'huge' }).map(m => m.index)).toEqual(['ogre']);
    expect(filterMonsters(sizedMonsters, { sizeFilter: 'small' }).map(m => m.index)).toEqual(['goblin']);
  });

  it('filters by CR range', () => {
    expect(filterMonsters(monsters, { crMin: 0, crMax: 0.5 }).map(m => m.index)).toEqual(['goblin', 'orc', 'shadow']);
    expect(filterMonsters(monsters, { crMin: 1, crMax: 2 }).map(m => m.index)).toContain('dragon');
    expect(filterMonsters(monsters, { crMax: 0.5 }).map(m => m.index)).toEqual(['goblin', 'orc', 'shadow']);
    expect(filterMonsters(monsters, { crMin: 2 }).map(m => m.index)).toEqual(['dragon']);
  });

  it('filters by CR range with fraction notation', () => {
    const fractionMonsters = [
      { index: 'mold', name: 'Mold', type: 'plant', size: 'medium', environments: ['forest'], challenge_rating: '1/8' },
      { index: 'rat', name: 'Rat', type: 'beast', size: 'tiny', environments: ['forest'], challenge_rating: '1/4' },
      { index: 'wolf', name: 'Wolf', type: 'beast', size: 'medium', environments: ['forest'], challenge_rating: '1/4' },
    ];
    expect(filterMonsters(fractionMonsters, { crMin: 0.125, crMax: 0.25 }).map(m => m.index)).toEqual(['mold', 'rat', 'wolf']);
  });

  it('excludes monsters with no CR when CR range is specified', () => {
    const noCRMonsters = [
      { index: 'cloud', name: 'Cloud', type: 'elemental', size: 'large', environments: ['sky'], challenge_rating: 'None' },
      { index: 'goblin', name: 'Goblin', type: 'humanoid', size: 'small', environments: ['forest'], challenge_rating: 0.25 },
    ];
    expect(filterMonsters(noCRMonsters, { crMin: 0, crMax: 1 }).map(m => m.index)).toEqual(['goblin']);
  });

  it('combines type and size filters', () => {
    const combinedMonsters = [
      { index: 'goblin', name: 'Goblin', type: 'humanoid', size: 'small', environments: ['forest'], challenge_rating: 0.25 },
      { index: 'orc', name: 'Orc', type: 'humanoid', size: 'medium', environments: ['hill'], challenge_rating: 0.5 },
      { index: 'ogre', name: 'Ogre', type: 'giant', size: 'huge', environments: ['hill'], challenge_rating: 3 },
    ];
    expect(filterMonsters(combinedMonsters, { typeFilter: 'humanoid', sizeFilter: 'small' }).map(m => m.index)).toEqual(['goblin']);
  });

  it('combines type, size, and CR filters', () => {
    const combinedMonsters = [
      { index: 'goblin', name: 'Goblin', type: 'humanoid', size: 'small', environments: ['forest'], challenge_rating: 0.25 },
      { index: 'orc', name: 'Orc', type: 'humanoid', size: 'medium', environments: ['hill'], challenge_rating: 0.5 },
      { index: 'ogre', name: 'Ogre', type: 'giant', size: 'huge', environments: ['hill'], challenge_rating: 3 },
    ];
    expect(filterMonsters(combinedMonsters, { typeFilter: 'humanoid', crMin: 0, crMax: 0.5 }).map(m => m.index)).toEqual(['goblin', 'orc']);
    expect(filterMonsters(combinedMonsters, { sizeFilter: 'medium', crMin: 0, crMax: 1 }).map(m => m.index)).toEqual(['orc']);
  });

  it('returns empty array when monsters is null or no monsters match', () => {
    expect(filterMonsters(null, {})).toEqual([]);
    expect(filterMonsters(monsters, { searchQuery: 'unicorn' })).toEqual([]);
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
      localStorage.setItem(key, JSON.stringify({
        difficulty: filter.difficulty,
        environment: filter.environment,
        type: filter.type,
        size: filter.size,
        crMin: filter.crMin,
        crMax: filter.crMax,
      }));
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
