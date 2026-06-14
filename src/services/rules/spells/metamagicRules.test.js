import { describe, it, expect, beforeEach } from 'vitest';
import {
  METAMAGIC_OPTIONS,
  METAMAGIC_EFFECTS,
  getMetamagicCost,
  getPreCastOptions,
  getChaModifier,
  getMaxMetamagicPerSpell,
  isPreCastOption,
} from './metamagicRules.js';
import { clearRuntimeState } from '../../hooks/useRuntimeState.js';

beforeEach(() => {
  localStorage.clear();
  Object.keys(localStorage); // no-op to ensure clean state
  clearRuntimeState('Test');
});

describe('METAMAGIC_OPTIONS', () => {
  it('has 8 options', () => {
    expect(METAMAGIC_OPTIONS).toHaveLength(8);
  });

  it('includes all expected metamagic options', () => {
    const names = METAMAGIC_OPTIONS.map(o => o.name);
    expect(names).toContain('Careful Spell');
    expect(names).toContain('Distant Spell');
    expect(names).toContain('Empowered Spell');
    expect(names).toContain('Extended Spell');
    expect(names).toContain('Heightened Spell');
    expect(names).toContain('Quickened Spell');
    expect(names).toContain('Subtle Spell');
    expect(names).toContain('Twinned Spell');
  });

  it('has correct costs', () => {
    const find = name => METAMAGIC_OPTIONS.find(o => o.name === name);
    expect(find('Careful Spell').cost).toBe(1);
    expect(find('Distant Spell').cost).toBe(1);
    expect(find('Empowered Spell').cost).toBe(1);
    expect(find('Extended Spell').cost).toBe(1);
    expect(find('Heightened Spell').cost).toBe(3);
    expect(find('Quickened Spell').cost).toBe(2);
    expect(find('Subtle Spell').cost).toBe(1);
    expect(find('Twinned Spell').cost).toBe('spell_level');
  });
});

describe('getMetamagicCost', () => {
  it('returns numeric cost as-is', () => {
    expect(getMetamagicCost({ cost: 1 }, 3)).toBe(1);
    expect(getMetamagicCost({ cost: 3 }, 3)).toBe(3);
  });

  it('resolves spell_level cost to spell level (minimum 1)', () => {
    expect(getMetamagicCost({ cost: 'spell_level' }, 3)).toBe(3);
    expect(getMetamagicCost({ cost: 'spell_level' }, 0)).toBe(1);
    expect(getMetamagicCost({ cost: 'spell_level' }, 1)).toBe(1);
  });
});

describe('getPreCastOptions', () => {
  const sorcererStats = {
    class: { name: 'Sorcerer' },
  };

  it('returns empty for non-Sorcerer', () => {
    expect(getPreCastOptions({ class: { name: 'Wizard' } }, 10, 3)).toEqual([]);
  });

  it('returns pre-cast options for Sorcerer', () => {
    const options = getPreCastOptions(sorcererStats, 10, 3);
    expect(options.length).toBe(7);
    expect(options.find(o => o.name === 'Empowered Spell')).toBeUndefined();
  });

  it('marks options affordable based on current SP', () => {
    const options = getPreCastOptions(sorcererStats, 1, 3);
    const costly = options.find(o => o.name === 'Heightened Spell');
    expect(costly.affordable).toBe(false);
    const cheap = options.find(o => o.name === 'Careful Spell');
    expect(cheap.affordable).toBe(true);
  });

  it('resolves Twinned Spell cost to spell level', () => {
    const options = getPreCastOptions(sorcererStats, 10, 5);
    const twinned = options.find(o => o.name === 'Twinned Spell');
    expect(twinned.resolvedCost).toBe(5);
  });
});

describe('getChaModifier', () => {
  it('returns Charisma bonus', () => {
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 4 }] })).toBe(4);
  });

  it('returns 0 for negative modifier', () => {
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: -1 }] })).toBe(0);
  });

  it('returns 0 when no abilities', () => {
    expect(getChaModifier({})).toBe(0);
  });
});

describe('getMaxMetamagicPerSpell', () => {
  it('returns 1 for 5e rules', () => {
    expect(getMaxMetamagicPerSpell({ rules: '5e', level: 10 }, 'Test')).toBe(1);
   });

  it('returns 1 for 2024 rules below level 6', () => {
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 5 }, 'Test')).toBe(1);
   });

  it('returns 2 for 2024 rules level 6+ with Innate Sorcery active', () => {
    localStorage.setItem('Test', JSON.stringify({ activeBuffs: [{ name: 'Innate Sorcery' }] }));
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'Test')).toBe(2);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 10 }, 'Test')).toBe(2);
   });

  it('returns 1 for 2024 rules level 6+ without Innate Sorcery active', () => {
    localStorage.setItem('Test', JSON.stringify({ activeBuffs: [] }));
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'Test')).toBe(1);
   });

  it('handles missing level', () => {
    expect(getMaxMetamagicPerSpell({ rules: '2024' }, 'Test')).toBe(1);
   });
});

describe('isPreCastOption', () => {
  it('returns true for non-Empowered options', () => {
    expect(isPreCastOption({ effect: METAMAGIC_EFFECTS.CAREFUL })).toBe(true);
    expect(isPreCastOption({ effect: METAMAGIC_EFFECTS.TWINNED })).toBe(true);
  });

  it('returns false for Empowered Spell', () => {
    expect(isPreCastOption({ effect: METAMAGIC_EFFECTS.EMPOWERED })).toBe(false);
  });
});
