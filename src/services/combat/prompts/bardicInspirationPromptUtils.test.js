import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- mocks ---

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const storeMap = new Map();
  const getStore = vi.fn((key) => {
    if (!storeMap.has(key)) {
      storeMap.set(key, new Map());
    }
    return storeMap.get(key);
  });
  return {
    getStore,
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_, propertyName) => {
      // search all stores for the property
      for (const [, store] of storeMap) {
        if (store.has(propertyName)) {
          return store.get(propertyName);
        }
      }
      return null;
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value, _campaignName) => {
      const store = getStore(characterKey);
      store.set(propertyName, value);
    }),
  };
});

// We need the real setRuntimeValue behavior to test that the data
// structure is correct. Re-import and patch it.
const realMod = await import('../../../hooks/runtime/useRuntimeState.js');

import {
  sendBardicInspirationDefensePrompt,
  sendBardicInspirationOffensePrompt,
  clearBardicInspirationPrompt,
  getBardicInspirationPrompt,
  clearBardicInspirationPromptState,
} from './bardicInspirationPromptUtils.js';

// --- helpers ---

function mockFetchResolved() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
}

// --- tests ---

describe('bardicInspirationPromptUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendBardicInspirationDefensePrompt', () => {
    it('sets the correct runtime value with mode defense', () => {
      mockFetchResolved();
      sendBardicInspirationDefensePrompt(
        'TestCampaign',
        'Ally',
        'Goblin',
        17,
        2,
        15,
        6,
        1
      );

      const { setRuntimeValue } = realMod;
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'biPrompt',
        expect.objectContaining({
          mode: 'defense',
          promptId: 1,
          targetName: 'Ally',
          attackerName: 'Goblin',
          attackRoll: 17,
          bonus: 2,
          effectiveAc: 15,
          dieSize: 6,
          fullDescription:
            'When hit by an attack roll, you can use your Reaction to roll the Bardic Inspiration die and add the number rolled to your AC against that attack, potentially causing the attack to miss.',
        }),
        'TestCampaign'
      );
    });

    it('does not propagate errors (fire-and-forget pattern via setRuntimeValue)', () => {
      // setRuntimeValue mock is a no-op for fetch, so this just verifies
      // the function completes without throwing
      expect(
        sendBardicInspirationDefensePrompt(
          'C',
          'T',
          'A',
          1,
          0,
          10,
          4,
          1
        )
      ).toBeUndefined();
    });

    it('includes all numeric fields correctly', () => {
      mockFetchResolved();
      sendBardicInspirationDefensePrompt(
        'C',
        'Target',
        'Attacker',
        20,
        5,
        18,
        8,
        42
      );

      const { setRuntimeValue } = realMod;
      const callArgs = setRuntimeValue.mock.calls[0];
      const data = callArgs[2];

      expect(data.attackRoll).toBe(20);
      expect(data.bonus).toBe(5);
      expect(data.effectiveAc).toBe(18);
      expect(data.dieSize).toBe(8);
      expect(data.promptId).toBe(42);
    });
  });

  describe('sendBardicInspirationOffensePrompt', () => {
    it('sets the correct runtime value with mode offense', () => {
      mockFetchResolved();
      sendBardicInspirationOffensePrompt(
        'TestCampaign',
        'Bard',
        'Goblin',
        6,
        2
      );

      const { setRuntimeValue } = realMod;
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'biPrompt',
        expect.objectContaining({
          mode: 'offense',
          promptId: 2,
          targetName: 'Goblin',
          attackerName: 'Bard',
          dieSize: 6,
          fullDescription:
            "Immediately after you hit a target with an attack roll, you can roll the Bardic Inspiration die and add the number rolled to the attack's damage against the target.",
        }),
        'TestCampaign'
      );
    });

    it('does not propagate errors (fire-and-forget pattern via setRuntimeValue)', () => {
      // setRuntimeValue mock is a no-op for fetch, so this just verifies
      // the function completes without throwing
      expect(
        sendBardicInspirationOffensePrompt('C', 'T', 'Target', 6, 1)
      ).toBeUndefined();
    });

    it('sets attackerName as the character key (the prompt goes to the attacker)', () => {
      mockFetchResolved();
      sendBardicInspirationOffensePrompt(
        'TestCampaign',
        'BardPlayer',
        'Goblin',
        8,
        3
      );

      const { setRuntimeValue } = realMod;
      // The attacker (BardPlayer) is the first argument after campaignName,
      // and it's used as the character key for setRuntimeValue
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'BardPlayer',
        'biPrompt',
        expect.any(Object),
        'TestCampaign'
      );
    });
  });

  describe('clearBardicInspirationPrompt', () => {
    it('deletes biPrompt and biPromptCleared from the store', () => {
      const store = new Map([
        ['biPrompt', { mode: 'defense' }],
        ['biPromptCleared', true],
        ['otherKey', 'keep'],
      ]);
      const { getStore } = realMod;
      getStore.mockImplementation((key) => {
        if (key === 'Target') return store;
        return new Map();
      });

      clearBardicInspirationPrompt('TestCampaign', 'Target');

      expect(store.has('biPrompt')).toBe(false);
      expect(store.has('biPromptCleared')).toBe(false);
      expect(store.get('otherKey')).toBe('keep');
    });

    it('creates a new store if none exists for the character', () => {
      const { getStore } = realMod;
      getStore.mockImplementation(() => new Map());

      // Should not throw
      expect(() =>
        clearBardicInspirationPrompt('TestCampaign', 'Nobody')
      ).not.toThrow();
    });

    it('does not return anything (void)', () => {
      const { getStore } = realMod;
      getStore.mockImplementation(() => new Map());

      expect(clearBardicInspirationPrompt('TestCampaign', 'Target')).toBeUndefined();
    });
  });

  describe('getBardicInspirationPrompt', () => {
    it('returns the prompt data when it exists', () => {
      const expectedPrompt = {
        mode: 'defense',
        promptId: 5,
        targetName: 'Ally',
      };
      const { getRuntimeValue } = realMod;
      getRuntimeValue.mockReturnValue(expectedPrompt);

      const result = getBardicInspirationPrompt('TestCampaign', 'Ally');

      expect(result).toEqual(expectedPrompt);
      expect(getRuntimeValue).toHaveBeenCalledWith('Ally', 'biPrompt', 'TestCampaign');
    });

    it('returns null when no prompt exists', () => {
      const { getRuntimeValue } = realMod;
      getRuntimeValue.mockReturnValue(null);

      const result = getBardicInspirationPrompt('TestCampaign', 'Nobody');

      expect(result).toBeNull();
    });

    it('passes campaignName to getRuntimeValue', () => {
      const { getRuntimeValue } = realMod;
      getRuntimeValue.mockReturnValue(null);

      getBardicInspirationPrompt('My Campaign', 'Target');

      expect(getRuntimeValue).toHaveBeenCalledWith(
        'Target',
        'biPrompt',
        'My Campaign'
      );
    });
  });

  describe('clearBardicInspirationPromptState', () => {
    it('delegates to clearBardicInspirationPrompt', () => {
      const store = new Map([['biPrompt', { mode: 'offense' }]]);
      const { getStore } = realMod;
      getStore.mockImplementation((key) => {
        if (key === 'Target') return store;
        return new Map();
      });

      clearBardicInspirationPromptState('TestCampaign', 'Target');

      expect(store.has('biPrompt')).toBe(false);
      expect(store.has('biPromptCleared')).toBe(false);
    });

    it('ignores campaignName (uses underscore placeholder)', () => {
      const store = new Map();
      const { getStore } = realMod;
      getStore.mockImplementation(() => store);

      // Should not throw regardless of campaignName value
      expect(() =>
        clearBardicInspirationPromptState('AnyCampaign', 'Target')
      ).not.toThrow();
    });
  });

  describe('data integrity', () => {
    it('defense prompt fullDescription matches the source exactly', () => {
      mockFetchResolved();
      sendBardicInspirationDefensePrompt(
        'C', 'T', 'A', 1, 0, 10, 4, 1
      );

      const { setRuntimeValue } = realMod;
      const data = setRuntimeValue.mock.calls[0][2];
      expect(data.fullDescription).toBe(
        'When hit by an attack roll, you can use your Reaction to roll the Bardic Inspiration die and add the number rolled to your AC against that attack, potentially causing the attack to miss.'
      );
    });

    it('offense prompt fullDescription matches the source exactly', () => {
      mockFetchResolved();
      sendBardicInspirationOffensePrompt('C', 'B', 'T', 4, 1);

      const { setRuntimeValue } = realMod;
      const data = setRuntimeValue.mock.calls[0][2];
      expect(data.fullDescription).toBe(
        "Immediately after you hit a target with an attack roll, you can roll the Bardic Inspiration die and add the number rolled to the attack's damage against the target."
      );
    });

    it('defense prompt has all expected fields', () => {
      mockFetchResolved();
      sendBardicInspirationDefensePrompt('C', 'Target', 'Attacker', 15, 3, 14, 6, 10);

      const { setRuntimeValue } = realMod;
      const data = setRuntimeValue.mock.calls[0][2];
      const expectedKeys = [
        'mode', 'promptId', 'targetName', 'attackerName',
        'attackRoll', 'bonus', 'effectiveAc', 'dieSize', 'fullDescription',
      ];
      for (const key of expectedKeys) {
        expect(data).toHaveProperty(key);
      }
    });

    it('offense prompt has all expected fields', () => {
      mockFetchResolved();
      sendBardicInspirationOffensePrompt('C', 'Attacker', 'Target', 6, 10);

      const { setRuntimeValue } = realMod;
      const data = setRuntimeValue.mock.calls[0][2];
      const expectedKeys = [
        'mode', 'promptId', 'targetName', 'attackerName', 'dieSize', 'fullDescription',
      ];
      for (const key of expectedKeys) {
        expect(data).toHaveProperty(key);
      }
    });
  });
});
