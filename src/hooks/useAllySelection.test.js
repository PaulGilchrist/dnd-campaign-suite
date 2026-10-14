import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllyList, setAllyList } from './useAllySelection.js';
import * as useRuntimeState from './runtime/useRuntimeState.js';

describe('useAllySelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllyList', () => {
    it('returns stored allies array when it is non-empty', () => {
      vi.spyOn(useRuntimeState, 'getRuntimeValue').mockReturnValue(['Ally1', 'Ally2']);

      const result = getAllyList('Hero');

      expect(result).toEqual(['Ally1', 'Ally2']);
    });

    it('returns [creatureName] when stored allies is a single ally', () => {
      vi.spyOn(useRuntimeState, 'getRuntimeValue').mockReturnValue(['SingleAlly']);

      const result = getAllyList('Hero');

      expect(result).toEqual(['SingleAlly']);
    });

    it('returns [creatureName] when stored allies is missing (null/undefined)', () => {
      vi.spyOn(useRuntimeState, 'getRuntimeValue').mockReturnValue(null);

      const result = getAllyList('Goblin');

      expect(result).toEqual(['Goblin']);
    });

    it('returns [creatureName] when stored allies is an empty array', () => {
      vi.spyOn(useRuntimeState, 'getRuntimeValue').mockReturnValue([]);

      const result = getAllyList('Orc');

      expect(result).toEqual(['Orc']);
    });

    it('returns [creatureName] when stored allies is a non-array value', () => {
      vi.spyOn(useRuntimeState, 'getRuntimeValue')
        .mockReturnValueOnce('not-an-array')
        .mockReturnValueOnce('')
        .mockReturnValueOnce(0);

      expect(getAllyList('Giant')).toEqual(['Giant']);
      expect(getAllyList('Wraith')).toEqual(['Wraith']);
      expect(getAllyList('Troll')).toEqual(['Troll']);
    });

    it('reads from the correct runtime key', () => {
      vi.spyOn(useRuntimeState, 'getRuntimeValue').mockReturnValue(['Ally1']);

      getAllyList('Hero');

      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Hero', 'selectedAllies');
    });
  });

  describe('setAllyList', () => {
    it('persists the ally list with all parameters', () => {
      const spy = vi.spyOn(useRuntimeState, 'setRuntimeValue').mockReturnValue(undefined);

      setAllyList('Hero', ['Ally1', 'Ally2'], 'test-campaign');

      expect(spy).toHaveBeenCalledWith('Hero', 'selectedAllies', ['Ally1', 'Ally2'], 'test-campaign');
    });

    it('persists an empty ally list', () => {
      const spy = vi.spyOn(useRuntimeState, 'setRuntimeValue').mockReturnValue(undefined);

      setAllyList('Hero', [], 'test-campaign');

      expect(spy).toHaveBeenCalledWith('Hero', 'selectedAllies', [], 'test-campaign');
    });

    it('persists without campaignName when omitted', () => {
      const spy = vi.spyOn(useRuntimeState, 'setRuntimeValue').mockReturnValue(undefined);

      setAllyList('Hero', ['Ally1']);

      expect(spy).toHaveBeenCalledWith('Hero', 'selectedAllies', ['Ally1'], undefined);
    });

    it('writes to the correct runtime key', () => {
      const spy = vi.spyOn(useRuntimeState, 'setRuntimeValue').mockReturnValue(undefined);

      setAllyList('Hero', ['Ally1'], 'campaign');

      expect(spy).toHaveBeenLastCalledWith('Hero', 'selectedAllies', ['Ally1'], 'campaign');
    });
  });
});
