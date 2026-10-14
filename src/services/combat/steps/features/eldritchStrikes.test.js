import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(async () => ({ creatures: [] })),
  getTargetFromAttacker: vi.fn(() => ({ name: 'Zombie 1' })),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ──────────────────────────────────────────────────────

import { eldritchStrikes } from './eldritchStrikes.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ──────────────────────────────────────────────────────

const RIDER = {
  name: 'Eldritch Strike',
  type: 'attack_rider',
  trigger: 'weapon_attack_hit',
  oncePerTurn: true,
  options: [{ name: 'Eldritch Strike', effect: 'disadvantage_on_next_save' }],
};

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: {
      name: 'EvasiveFighter',
      automation: { actions: [RIDER], passives: [] },
    },
    ...overrides,
  };
}

function targetEffectsWrites() {
  return setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects');
}

// ── Tests ────────────────────────────────────────────────────────

describe('eldritchStrikes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCombatRound.mockReturnValue(1);
    getRuntimeValue.mockReturnValue(null);
  });

  it('returns null when no attack_rider present', async () => {
    const ctx = makeCtx({ playerStats: { name: 'EvasiveFighter', automation: { actions: [], passives: [] } } });
    expect(await eldritchStrikes.handler(ctx, {})).toBeNull();
  });

  describe('CLA-109 round gate', () => {
    it('reads the current round WITH campaignName so the gate can advance', async () => {
      await eldritchStrikes.handler(makeCtx(), {});
      expect(getCurrentCombatRound).toHaveBeenCalledWith('test-campaign');
    });

    it('fires on the first hit of round R: writes te, marks usedRound R, logs ability_use', async () => {
      getCurrentCombatRound.mockReturnValue(1);

      const result = await eldritchStrikes.handler(makeCtx(), { prev: true });

      expect(result).toEqual({ data: { prev: true } });
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [expect.objectContaining({
          target: 'Zombie 1',
          source: 'Eldritch Strike',
          effect: 'disadvantage_on_next_save',
          duration: 'until_start_of_next_turn',
        })],
        'test-campaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_Eldritch_Strike_usedRound', 1, 'test-campaign');
      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'ability_use',
        characterName: 'EvasiveFighter',
        abilityName: 'Eldritch Strike',
        targetName: 'Zombie 1',
      }));
    });

    it('does NOT re-fire on a second hit in the same round', async () => {
      getCurrentCombatRound.mockReturnValue(1);
      getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'EvasiveFighter' && prop === '_Eldritch_Strike_usedRound') return 1;
        return null;
      });

      const prevData = { prev: true };
      const result = await eldritchStrikes.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
      expect(targetEffectsWrites()).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('RE-ARMS and fires again on a later hit in round R+1 (CLA-109 regression)', async () => {
      // Round 1: first hit fires and marks usedRound = 1
      getCurrentCombatRound.mockReturnValue(1);
      await eldritchStrikes.handler(makeCtx(), {});
      expect(targetEffectsWrites()).toHaveLength(1);

      // Round 2: summary round advanced, stored usedRound still 1
      getCurrentCombatRound.mockReturnValue(2);
      getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'EvasiveFighter' && prop === '_Eldritch_Strike_usedRound') return 1;
        return null;
      });

      await eldritchStrikes.handler(makeCtx(), {});

      expect(targetEffectsWrites()).toHaveLength(2);
      expect(setRuntimeValue).toHaveBeenLastCalledWith('EvasiveFighter', '_Eldritch_Strike_usedRound', 2, 'test-campaign');
      expect(addEntry).toHaveBeenCalledTimes(2);
    });

    it('fires again on every new round across three rounds', async () => {
      let lastWritten = null;
      getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'EvasiveFighter' && prop === '_Eldritch_Strike_usedRound') return lastWritten;
        return null;
      });
      setRuntimeValue.mockImplementation((key, prop, value) => {
        if (key === 'EvasiveFighter' && prop === '_Eldritch_Strike_usedRound') lastWritten = value;
      });

      for (const round of [1, 2, 3]) {
        getCurrentCombatRound.mockReturnValue(round);
        await eldritchStrikes.handler(makeCtx(), {});
        expect(lastWritten).toBe(round);
      }
      expect(targetEffectsWrites()).toHaveLength(3);
      expect(addEntry).toHaveBeenCalledTimes(3);
    });

    it('skips Stalker\'s Flurry riders and damageExpression riders', async () => {
      const ctx = makeCtx({
        playerStats: {
          name: 'EvasiveFighter',
          automation: {
            actions: [
              { ...RIDER, name: "Stalker's Flurry" },
              { ...RIDER, name: 'Brutal Strike', damageExpression: '1d10' },
            ],
            passives: [],
          },
        },
      });

      expect(await eldritchStrikes.handler(ctx, {})).toBeNull();
      expect(targetEffectsWrites()).toHaveLength(0);
    });
  });
});
