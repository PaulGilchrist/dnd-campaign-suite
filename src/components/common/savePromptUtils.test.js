import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHolyAuraSaveAdvantage, getSaveDisadvantage } from './savePromptUtils.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

describe('getHolyAuraSaveAdvantage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
  });

  it('returns true when a holy_aura targetEffect targets the roller', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'targetEffects') return [{ target: 'testTarget', effect: 'holy_aura', source: 'Cleric' }];
      return null;
    });
    expect(getHolyAuraSaveAdvantage({ targetName: 'testTarget', saveType: 'WIS' }, 'test-campaign')).toBe(true);
  });

  it('returns false when the holy_aura targetEffect targets another creature', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'targetEffects') return [{ target: 'OtherAlly', effect: 'holy_aura', source: 'Cleric' }];
      return null;
    });
    expect(getHolyAuraSaveAdvantage({ targetName: 'testTarget', saveType: 'WIS' }, 'test-campaign')).toBe(false);
  });

  it('returns false for any save ability when the target is warded (all saves covered)', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'targetEffects') return [{ target: 'testTarget', effect: 'holy_aura', source: 'Cleric' }];
      return null;
    });
    expect(getHolyAuraSaveAdvantage({ targetName: 'testTarget', saveType: 'DEX' }, 'test-campaign')).toBe(true);
    expect(getHolyAuraSaveAdvantage({ targetName: 'testTarget', saveType: 'CON' }, 'test-campaign')).toBe(true);
  });

  it('returns false when there are no targetEffects', () => {
    getRuntimeValue.mockImplementation((name, key) => (key === 'targetEffects' ? [] : null));
    expect(getHolyAuraSaveAdvantage({ targetName: 'testTarget', saveType: 'WIS' }, 'test-campaign')).toBe(false);
  });

  it('returns false without a current prompt', () => {
    expect(getHolyAuraSaveAdvantage(null, 'test-campaign')).toBe(false);
  });
});

describe('getSaveDisadvantage — SP-109 Slow DEX save enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
  });

  it('returns true for a DEX save on a slowed NPC via dex_save_disadvantage te', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'targetEffects') return [{ target: 'Thug 1', effect: 'dex_save_disadvantage', source: 'DivinationWizard' }];
      if (key === 'activeConditions') return [];
      return null;
    });
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'DEX' }, 'test-campaign')).toBe(true);
  });

  it('returns true for a DEX save while the slow condition is active even without te', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['slow'];
      if (key === 'targetEffects') return [];
      return null;
    });
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'DEX' }, 'test-campaign')).toBe(true);
  });

  it('does not apply slow to non-DEX saves', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['slow'];
      if (key === 'targetEffects') return [{ target: 'Thug 1', effect: 'dex_save_disadvantage', source: 'DivinationWizard' }];
      return null;
    });
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'WIS' }, 'test-campaign')).toBe(false);
  });

  it('returns false for a non-slowed creature', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['poisoned'];
      if (key === 'targetEffects') return [];
      return null;
    });
    expect(getSaveDisadvantage({ targetName: 'Zombie 1', saveType: 'DEX' }, 'test-campaign')).toBe(false);
  });
});

describe('MA-1352 getSaveDisadvantage — ability-scoped ability_save_disadvantage te', () => {
  const teInt = [{ target: 'Thug 1', effect: 'ability_save_disadvantage', ability: 'int', source: 'Psychic Gray Ooze 1', duration: 'until_start_of_next_turn' }];

  beforeEach(() => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'targetEffects') return teInt;
      return null;
    });
  });

  it('true on INT saves (full word or abbreviation)', () => {
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'Intelligence' }, 'test-campaign')).toBe(true);
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'INT' }, 'test-campaign')).toBe(true);
  });

  it('false on every other save type', () => {
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'DEX' }, 'test-campaign')).toBe(false);
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'WIS' }, 'test-campaign')).toBe(false);
  });

  it('false for a different target and byte-inert without the te', () => {
    expect(getSaveDisadvantage({ targetName: 'Other 1', saveType: 'INT' }, 'test-campaign')).toBe(false);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'targetEffects') return [];
      return null;
    });
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'INT' }, 'test-campaign')).toBe(false);
  });
});
