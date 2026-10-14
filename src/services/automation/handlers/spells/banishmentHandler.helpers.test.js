import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

import { isCreatureTrappedInBanishment, isBanishmentBlocked } from './banishmentHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

describe('banishmentHandler helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isCreatureTrappedInBanishment', () => {
    it('returns false when creatureName is null', () => {
      expect(isCreatureTrappedInBanishment(null)).toBe(false);
    });

    it('returns false when creatureName is undefined', () => {
      expect(isCreatureTrappedInBanishment(undefined)).toBe(false);
    });

    it('returns false when creatureName is empty string', () => {
      expect(isCreatureTrappedInBanishment('')).toBe(false);
    });

    it('returns false when no banishment effects exist', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([]);

      expect(isCreatureTrappedInBanishment('Goblin')).toBe(false);
    });

    it('returns false when banishment effects exist but not for this creature', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'banishment', target: 'Orc', source: 'Caster' },
      ]);

      expect(isCreatureTrappedInBanishment('Goblin')).toBe(false);
    });

    it('returns true when creature is banished', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'banishment', target: 'Goblin', source: 'Caster' },
        { effect: 'slowed', target: 'Goblin', source: 'Caster' },
      ]);

      expect(isCreatureTrappedInBanishment('Goblin')).toBe(true);
    });

    it('returns false when creature has non-banishment target effects', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'slowed', target: 'Goblin', source: 'Caster' },
        { effect: 'blinded', target: 'Goblin', source: 'Caster' },
      ]);

      expect(isCreatureTrappedInBanishment('Goblin')).toBe(false);
    });

    it('returns true when creature is banished among multiple effects', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'banishment', target: 'Goblin', source: 'Caster' },
        { effect: 'banishment', target: 'Orc', source: 'Caster' },
        { effect: 'slowed', target: 'Wizard', source: 'Caster' },
      ]);

      expect(isCreatureTrappedInBanishment('Orc')).toBe(true);
    });
  });

  describe('isBanishmentBlocked', () => {
    it('returns false when attackerName is null', () => {
      expect(isBanishmentBlocked(null, 'Goblin')).toBe(false);
    });

    it('returns false when attackerName is undefined', () => {
      expect(isBanishmentBlocked(undefined, 'Goblin')).toBe(false);
    });

    it('returns false when attackerName is empty string', () => {
      expect(isBanishmentBlocked('', 'Goblin')).toBe(false);
    });

    it('returns false when targetName is null', () => {
      expect(isBanishmentBlocked('Wizard', null)).toBe(false);
    });

    it('returns false when targetName is undefined', () => {
      expect(isBanishmentBlocked('Wizard', undefined)).toBe(false);
    });

    it('returns false when targetName is empty string', () => {
      expect(isBanishmentBlocked('Wizard', '')).toBe(false);
    });

    it('returns false when no banishment effects exist', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([]);

      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(false);
    });

    it('returns false when neither attacker nor target is banished', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'slowed', target: 'Goblin', source: 'Other' },
      ]);

      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(false);
    });

    it('returns true when only attacker is banished', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'banishment', target: 'Wizard', source: 'Caster' },
      ]);

      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(true);
    });

    it('returns true when only target is banished', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'banishment', target: 'Goblin', source: 'Caster' },
      ]);

      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(true);
    });

    it('returns false when both are banished by the same source', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'banishment', target: 'Wizard', source: 'Caster' },
        { effect: 'banishment', target: 'Goblin', source: 'Caster' },
      ]);

      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(false);
    });

    it('returns true when both are banished by different sources', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'banishment', target: 'Wizard', source: 'Caster1' },
        { effect: 'banishment', target: 'Goblin', source: 'Caster2' },
      ]);

      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(true);
    });

    it('returns false when both are banished by same source among multiple effects', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'banishment', target: 'Wizard', source: 'Caster' },
        { effect: 'banishment', target: 'Goblin', source: 'Caster' },
        { effect: 'banishment', target: 'Orc', source: 'Other' },
        { effect: 'slowed', target: 'Wizard', source: 'Other' },
      ]);

      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(false);
    });

    it('returns true when attacker has multiple banishments but none share source with target', () => {
      vi.mocked(getRuntimeValue).mockReturnValue([
        { effect: 'banishment', target: 'Wizard', source: 'Caster1' },
        { effect: 'banishment', target: 'Wizard', source: 'Caster2' },
        { effect: 'banishment', target: 'Goblin', source: 'Caster3' },
      ]);

      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(true);
    });
  });
});
