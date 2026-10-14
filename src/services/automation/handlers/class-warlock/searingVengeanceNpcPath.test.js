import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
}));

import { handle } from './searingVengeanceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWarlock',
    level: 14,
    hitPoints: { max: 70 },
    currentHitPoints: 50,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Searing Vengeance',
    automation: {
      healExpression: 'floor(target_max_hp / 2)',
      damageExpression: '2d8 + CHA modifier',
      damageType: 'Radiant',
      range: '30_ft',
      condition: 'blinded',
      conditionDuration: 'until_end_of_current_turn',
      uses: 1,
      usesMax: 1,
      recharge: 'long_rest',
      casting_time: '1 reaction',
      trigger: 'death_save_by_ally_or_self',
      allyRange: '60_ft',
      ...automation,
    },
  };
}

describe('searingVengeanceHandler.handle - NPC path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('creature targets exclusion', () => {
    it('excludes the NPC target from creature targets', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_subject, key, _campaign) => {
        if (key === 'searingvengeanceUses') return 1;
        if (key === 'currentHitPoints') return null;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally', type: 'npc', currentHp: 0, maxHp: 50 },
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targetName).toBe('Ally');
      expect(result.payload.creatureTargets).not.toContainEqual(
        expect.objectContaining({ name: 'Ally' })
      );
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
      ]);
    });
  });
});
