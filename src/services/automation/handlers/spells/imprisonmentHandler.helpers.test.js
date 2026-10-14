import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import {
  isCreatureTrappedInImprisonment,
  isImprisonmentBlocked,
} from './imprisonmentHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

describe('imprisonmentHandler helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getImprisonmentEffects (indirect via isCreatureTrappedInImprisonment)', () => {
    it('handles null targetEffects gracefully', () => {
      getRuntimeValue.mockReturnValue(null);

      const result = isCreatureTrappedInImprisonment('Goblin');

      expect(result).toBe(false);
    });

    it('handles empty targetEffects array', () => {
      getRuntimeValue.mockReturnValue([]);

      const result = isCreatureTrappedInImprisonment('Goblin');

      expect(result).toBe(false);
    });

    it('filters correctly when imprisonment effects exist among others', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'sanctuary', target: 'Goblin', source: 'Cleric' },
        { effect: 'imprisonment', target: 'Orc', source: 'Wizard' },
        { effect: 'hex', target: 'Goblin', source: 'Warlock' },
        { effect: 'imprisonment', target: 'Ogre', source: 'Wizard' },
      ]);

      expect(isCreatureTrappedInImprisonment('Orc')).toBe(true);
      expect(isCreatureTrappedInImprisonment('Ogre')).toBe(true);
      expect(isCreatureTrappedInImprisonment('Goblin')).toBe(false);
    });
  });

  describe('isCreatureTrappedInImprisonment', () => {
    it('returns false when creatureName is null', () => {
      getRuntimeValue.mockReturnValue([]);

      const result = isCreatureTrappedInImprisonment(null);

      expect(result).toBe(false);
    });

    it('returns false when creatureName is undefined', () => {
      getRuntimeValue.mockReturnValue([]);

      const result = isCreatureTrappedInImprisonment(undefined);

      expect(result).toBe(false);
    });

    it('returns false when creatureName is empty string', () => {
      getRuntimeValue.mockReturnValue([]);

      const result = isCreatureTrappedInImprisonment('');

      expect(result).toBe(false);
    });

    it('returns false when no targetEffects exist', () => {
      getRuntimeValue.mockReturnValue([]);

      const result = isCreatureTrappedInImprisonment('Goblin');

      expect(result).toBe(false);
    });

    it('returns false when creature is not imprisoned', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Orc', source: 'Wizard' },
      ]);

      const result = isCreatureTrappedInImprisonment('Goblin');

      expect(result).toBe(false);
    });

    it('returns true when creature is imprisoned', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Goblin', source: 'Wizard' },
      ]);

      const result = isCreatureTrappedInImprisonment('Goblin');

      expect(result).toBe(true);
    });

    it('returns true among multiple imprisonment effects', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'sanctuary', target: 'Goblin', source: 'Cleric' },
        { effect: 'imprisonment', target: 'Ogre', source: 'Wizard' },
        { effect: 'imprisonment', target: 'Goblin', source: 'Wizard', prisonType: 'Slumber' },
      ]);

      const result = isCreatureTrappedInImprisonment('Goblin');

      expect(result).toBe(true);
    });
  });

  describe('isImprisonmentBlocked', () => {
    it('returns false when attackerName is null', () => {
      getRuntimeValue.mockReturnValue([]);

      const result = isImprisonmentBlocked(null, 'Goblin', 'test-campaign');

      expect(result).toBe(false);
    });

    it('returns false when targetName is null', () => {
      getRuntimeValue.mockReturnValue([]);

      const result = isImprisonmentBlocked('Wizard', null, 'test-campaign');

      expect(result).toBe(false);
    });

    it('returns false when both names are empty', () => {
      getRuntimeValue.mockReturnValue([]);

      const result = isImprisonmentBlocked('', '', 'test-campaign');

      expect(result).toBe(false);
    });

    it('returns false when no imprisonment effects exist', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'sanctuary', target: 'Goblin', source: 'Cleric' },
      ]);

      const result = isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign');

      expect(result).toBe(false);
    });

    it('returns false when neither attacker nor target is imprisoned', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Ogre', source: 'Wizard' },
      ]);

      const result = isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign');

      expect(result).toBe(false);
    });

    it('returns true when only attacker is imprisoned (different caster)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'Archmage' },
      ]);

      const result = isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign');

      expect(result).toBe(true);
    });

    it('returns true when only target is imprisoned (different caster)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Goblin', source: 'Archmage' },
      ]);

      const result = isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign');

      expect(result).toBe(true);
    });

    it('returns true when both are imprisoned by different casters', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'Archmage' },
        { effect: 'imprisonment', target: 'Goblin', source: 'Cleric' },
      ]);

      const result = isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign');

      expect(result).toBe(true);
    });

    it('returns false when both are imprisoned by the same caster', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'Archmage' },
        { effect: 'imprisonment', target: 'Goblin', source: 'Archmage' },
      ]);

      const result = isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign');

      expect(result).toBe(false);
    });

    it('returns false when attacker and target share same imprisonment source', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'CasterA', prisonType: 'Slumber' },
        { effect: 'imprisonment', target: 'Goblin', source: 'CasterA', prisonType: 'Burial' },
        { effect: 'imprisonment', target: 'Ogre', source: 'CasterB' },
      ]);

      const result = isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign');

      expect(result).toBe(false);
    });

    it('returns true when one has multiple imprisonment effects from different sources', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'CasterA' },
        { effect: 'imprisonment', target: 'Wizard', source: 'CasterB' },
        { effect: 'imprisonment', target: 'Goblin', source: 'CasterC' },
      ]);

      const result = isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign');

      expect(result).toBe(true);
    });

    it('returns false when target has imprisonment from same source as attacker', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'CasterA' },
        { effect: 'imprisonment', target: 'Wizard', source: 'CasterB' },
        { effect: 'imprisonment', target: 'Goblin', source: 'CasterA' },
      ]);

      const result = isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign');

      expect(result).toBe(false);
    });

    it('returns true when neither is imprisoned but other effects exist', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Ogre', source: 'CasterA' },
        { effect: 'sanctuary', target: 'Wizard', source: 'Cleric' },
      ]);

      const result = isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign');

      expect(result).toBe(false);
    });
  });
});
