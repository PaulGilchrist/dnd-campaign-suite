import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ──────────────────────────────────────────────────────

import { superiorHuntersPrey } from './superiorHuntersPrey.js';

import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Ranger1', level: 1, class: { name: 'Ranger' } },
    targetName: 'Orc1',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('superiorHuntersPrey — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handler — modal with targets (with map)', () => {
    it('filters targets by range when mapName exists', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Orc1' } },
          { name: 'Orc1' },
          { name: 'Goblin1' },
          { name: 'Skeleton1' },
        ],
      });
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);
      isWithinRange.mockImplementation(async (source, target) => {
        if (source === "Orc1" && target === 'Goblin1') return true;
        if (source === "Orc1" && target === 'Skeleton1') return false;
        return false;
      });

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({
          setSecondaryTargetModal,
          playerStats: { name: 'Ranger1', level: 1, class: { name: 'Ranger' }, mapName: 'Dungeon1' },
        }),
        prevData,
      );

      expect(isWithinRange).toHaveBeenCalledWith("Orc1", 'Goblin1', 30);
      expect(isWithinRange).toHaveBeenCalledWith("Orc1", 'Skeleton1', 30);

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      expect(modalArgs.targets).toHaveLength(1);
      expect(modalArgs.targets[0].name).toBe('Goblin1');
    });

    it('includes all creatures in range when map is present', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Orc1' } },
          { name: 'Orc1' },
          { name: 'Goblin1' },
          { name: 'Skeleton1' },
          { name: 'Troll1' },
        ],
      });
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);
      isWithinRange.mockImplementation(async () => true);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({
          setSecondaryTargetModal,
          playerStats: { name: 'Ranger1', level: 1, class: { name: 'Ranger' }, mapName: 'Dungeon1' },
        }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      expect(modalArgs.targets).toHaveLength(3);
      const targetNames = modalArgs.targets.map(t => t.name);
      expect(targetNames).toEqual(expect.arrayContaining(['Goblin1', 'Skeleton1', 'Troll1']));
    });

    it('returns prevData when no creatures are in range with map', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Orc1' } },
          { name: 'Orc1' },
          { name: 'Goblin1' },
        ],
      });
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);
      isWithinRange.mockImplementation(async () => false);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      const result = await superiorHuntersPrey.handler(
        makeCtx({
          setSecondaryTargetModal,
          playerStats: { name: 'Ranger1', level: 1, class: { name: 'Ranger' }, mapName: 'Dungeon1' },
        }),
        prevData,
      );

      expect(result).toEqual({ data: prevData });
      expect(setSecondaryTargetModal).not.toHaveBeenCalled();
    });
  });

  describe('handler — resolveHp integration', () => {
    it('includes resolved HP in modal targets (non-player creatures)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Orc1' } },
          { name: 'Orc1' },
          { name: 'Goblin1', currentHp: 5, maxHp: 10 },
        ],
      });
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      const goblin = modalArgs.targets.find(t => t.name === 'Goblin1');
      expect(goblin.currentHp).toBe(5);
      expect(goblin.maxHp).toBe(10);
    });

    it('uses runtime values for player-type creatures in modal targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Orc1' } },
          { name: 'Orc1' },
          { name: 'Ally1', type: 'player' },
        ],
      });
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'hitPoints') return 25;
        if (prop === 'currentHitPoints') return 18;
        return null;
      });
      getCurrentCombatRound.mockReturnValue(1);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      const ally = modalArgs.targets.find(t => t.name === 'Ally1');
      expect(ally.currentHp).toBe(18);
      expect(ally.maxHp).toBe(25);
    });

    it('defaults to 0 for player-type creature with no runtime HP values', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Orc1' } },
          { name: 'Orc1' },
          { name: 'Ally1', type: 'player' },
        ],
      });
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      const ally = modalArgs.targets.find(t => t.name === 'Ally1');
      expect(ally.currentHp).toBe(0);
      expect(ally.maxHp).toBe(0);
    });
  });
});
