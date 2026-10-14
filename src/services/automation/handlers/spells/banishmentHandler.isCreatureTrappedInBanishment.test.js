import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { isCreatureTrappedInBanishment } from './banishmentHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

describe('banishmentHandler.isCreatureTrappedInBanishment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when creatureName is falsy', () => {
    expect(isCreatureTrappedInBanishment(null)).toBe(false);
    expect(isCreatureTrappedInBanishment(undefined)).toBe(false);
    expect(isCreatureTrappedInBanishment('')).toBe(false);
  });

  it('returns false when creature is not banished', () => {
    getRuntimeValue.mockReturnValue([]);
    expect(isCreatureTrappedInBanishment('Goblin')).toBe(false);
  });

  it('returns true when creature is banished', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Goblin', source: 'Caster' },
    ]);
    expect(isCreatureTrappedInBanishment('Goblin')).toBe(true);
  });

  it('returns false when creature is not in banishment effects', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Orc', source: 'Caster' },
      { effect: 'banishment', target: 'Goblin', source: 'OtherCaster' },
    ]);
    expect(isCreatureTrappedInBanishment('Goblin')).toBe(true);
  });
});
