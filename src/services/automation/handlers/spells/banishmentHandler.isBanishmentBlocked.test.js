import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { isBanishmentBlocked } from './banishmentHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

describe('banishmentHandler.isBanishmentBlocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when attackerName is falsy', () => {
    expect(isBanishmentBlocked(null, 'Goblin')).toBe(false);
    expect(isBanishmentBlocked(undefined, 'Goblin')).toBe(false);
  });

  it('returns false when targetName is falsy', () => {
    expect(isBanishmentBlocked('Caster', null)).toBe(false);
    expect(isBanishmentBlocked('Caster', undefined)).toBe(false);
  });

  it('returns false when no banishment effects exist', () => {
    getRuntimeValue.mockReturnValue([]);
    expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(false);
  });

  it('returns false when neither creature is banished', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Orc', source: 'Caster' },
    ]);
    expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(false);
  });

  it('returns false when both creatures are banished by the same caster', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Caster', source: 'Caster' },
      { effect: 'banishment', target: 'Goblin', source: 'Caster' },
    ]);
    expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(false);
  });

  it('returns true when attacker is banished but target is not', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Caster', source: 'Caster' },
    ]);
    expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(true);
  });

  it('returns true when target is banished but attacker is not', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Goblin', source: 'Caster' },
    ]);
    expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(true);
  });

  it('returns true when both are banished by different casters', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Caster', source: 'Caster' },
      { effect: 'banishment', target: 'Goblin', source: 'OtherCaster' },
    ]);
    expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(true);
  });

  it('returns false when both are banished and attacker has a shared source with target', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Caster', source: 'Caster' },
      { effect: 'banishment', target: 'Caster', source: 'OtherCaster' },
      { effect: 'banishment', target: 'Goblin', source: 'Caster' },
    ]);
    expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(false);
  });

  it('returns true when both are banished and attacker has no shared source with target', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Caster', source: 'OtherCaster' },
      { effect: 'banishment', target: 'Goblin', source: 'Caster' },
    ]);
    expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(true);
  });
});
