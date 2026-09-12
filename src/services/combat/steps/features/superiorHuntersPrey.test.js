// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { addEntry } from '../../../ui/logService.js';

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

describe('superiorHuntersPrey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('condition', () => {
    it('returns true when player has superior_hunter_prey passive', () => {
      const ctx = makeCtx({
        playerStats: {
          name: 'Ranger1',
          automation: {
            passives: [{ type: 'superior_hunter_prey' }],
          },
        },
      });

      expect(superiorHuntersPrey.condition(ctx)).toBe(true);
    });

    it('returns false when passives array is missing', () => {
      const ctx = makeCtx({
        playerStats: {
          name: 'Ranger1',
          automation: {},
        },
      });

      expect(superiorHuntersPrey.condition(ctx)).toBe(false);
    });

    it('returns false when passives array is empty', () => {
      const ctx = makeCtx({
        playerStats: {
          name: 'Ranger1',
          automation: { passives: [] },
        },
      });

      expect(superiorHuntersPrey.condition(ctx)).toBe(false);
    });

    it('returns false when passives has other types', () => {
      const ctx = makeCtx({
        playerStats: {
          name: 'Ranger1',
          automation: { passives: [{ type: 'hex' }, { type: 'divine_favor' }] },
        },
      });

      expect(superiorHuntersPrey.condition(ctx)).toBe(false);
    });

    it('returns false when automation is missing', () => {
      const ctx = makeCtx({
        playerStats: { name: 'Ranger1' },
      });

      expect(superiorHuntersPrey.condition(ctx)).toBe(false);
    });

    it('returns false when automation.passives is null', () => {
      const ctx = makeCtx({
        playerStats: {
          name: 'Ranger1',
          automation: { passives: null },
        },
      });

      expect(superiorHuntersPrey.condition(ctx)).toBe(false);
    });
  });

  describe('handler — early returns', () => {
    it('returns prevData when getCombatContext returns null', async () => {
      getCombatContext.mockResolvedValue(null);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });

    it('returns prevData when attacker not found in creatures', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'OtherCreature' }],
      });

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });

    it('returns prevData when creatures is undefined', async () => {
      getCombatContext.mockResolvedValue({});

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });

    it('returns prevData when creatures is null', async () => {
      getCombatContext.mockResolvedValue({ creatures: null });

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });

    it('returns prevData when concentration is null', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Ranger1', concentration: null }],
      });

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });

    it('returns prevData when concentration spell is not Hunter\'s Mark', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{
          name: 'Ranger1',
          concentration: { spell: 'Concentration Spell' },
        }],
      });

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });

    it('returns prevData when concentration target differs from ctx.targetName', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{
          name: 'Ranger1',
          concentration: { spell: "Hunter's Mark", target: 'OtherTarget' },
        }],
      });

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });

    it('returns prevData when concentration has no target (unrestricted)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{
          name: 'Ranger1',
          concentration: { spell: "Hunter's Mark" },
        }],
      });

      // When concentration.target is undefined/null, the condition
      // `atk.concentration.target && atk.concentration.target !== ctx.targetName`
      // evaluates to false, so it does NOT return early.
      // It proceeds to find the marked target.
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      // Should NOT return early — it will try to find a marked target
      // Since there's no marked target in creatures, it returns early
      expect(result).toEqual({ data: prevData });
    });
  });

  describe('handler — already used this round', () => {
    it('returns prevData when already used in current round', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{
          name: 'Ranger1',
          concentration: { spell: "Hunter's Mark", target: 'Orc1' },
        }],
      });
      getCurrentCombatRound.mockReturnValue(3);
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === '_Superior_Hunters_Prey_UsedRound') return 3;
        return null;
      });

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
      expect(isWithinRange).not.toHaveBeenCalled();
      expect(rollExpression).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns prevData when round is 0 and already used in round 0', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{
          name: 'Ranger1',
          concentration: { spell: "Hunter's Mark", target: 'Orc1' },
        }],
      });
      getCurrentCombatRound.mockReturnValue(0);
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === '_Superior_Hunters_Prey_UsedRound') return 0;
        return null;
      });

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });
  });

  describe('handler — marked target not found', () => {
    it('returns prevData when marked target not in creatures', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{
          name: 'Ranger1',
          concentration: { spell: "Hunter's Mark", target: 'NonexistentTarget' },
        }],
      });
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });
  });

  describe('handler — no targets available', () => {
    it('returns prevData when only player and marked target exist', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Orc1' } },
          { name: 'Orc1' },
        ],
      });
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });

    it('returns prevData when creatures array has only the player', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{
          name: 'Ranger1',
          concentration: { spell: "Hunter's Mark", target: 'Orc1' },
        }],
      });
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const result = await superiorHuntersPrey.handler(makeCtx(), prevData);

      expect(result).toEqual({ data: prevData });
    });
  });

  describe('handler — modal with targets (no map)', () => {
    function setupBaseModalMocks() {
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
    }

    it('opens modal with correct targets when no map positions', async () => {
      setupBaseModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      const result = await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      expect(result).toEqual({ data: prevData });
      expect(setSecondaryTargetModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Superior Hunter's Prey — Choose Second Target",
          confirmLabel: 'Deal Damage',
          featureDescription: expect.stringContaining('1d6 Force'),
        }),
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      expect(modalArgs.targets).toHaveLength(2);
      expect(modalArgs.targets.map(t => t.name)).toEqual(expect.arrayContaining(['Goblin1', 'Skeleton1']));
    });

    it('uses 1d6 die for non-20th level ranger', async () => {
      setupBaseModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      expect(modalArgs.featureDescription).toContain('1d6 Force');
    });

    it('uses 1d10 die for 20th level ranger (Foe Slayer)', async () => {
      setupBaseModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({
          setSecondaryTargetModal,
          playerStats: { name: 'Ranger1', level: 20, class: { name: 'Ranger' } },
        }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      expect(modalArgs.featureDescription).toContain('1d10 Force');
    });

    it('uses 1d6 die for non-ranger class even at level 20', async () => {
      setupBaseModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({
          setSecondaryTargetModal,
          playerStats: { name: 'Ranger1', level: 20, class: { name: 'Fighter' } },
        }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      expect(modalArgs.featureDescription).toContain('1d6 Force');
    });

    it('excludes player and marked target from modal targets', async () => {
      setupBaseModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      const targetNames = modalArgs.targets.map(t => t.name);
      expect(targetNames).not.toContain('Ranger1');
      expect(targetNames).not.toContain('Orc1');
    });

    it('calls onSkip to close modal without damage', async () => {
      setupBaseModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      modalArgs.onSkip();

      expect(setSecondaryTargetModal).toHaveBeenCalledWith(null);
      expect(rollExpression).not.toHaveBeenCalled();
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early without closing modal when onTargetSelected is called with null', async () => {
      setupBaseModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      modalArgs.onTargetSelected(null);

      // The handler returns early without calling setSecondaryTargetModal(null)
      // because there is no explicit close-on-null behavior in the code
      expect(setSecondaryTargetModal).not.toHaveBeenCalledWith(null);
      expect(rollExpression).not.toHaveBeenCalled();
      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('returns early without closing modal when onTargetSelected is called with empty string', async () => {
      setupBaseModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      modalArgs.onTargetSelected('');

      expect(setSecondaryTargetModal).not.toHaveBeenCalledWith(null);
      expect(rollExpression).not.toHaveBeenCalled();
    });
  });

  describe('handler — onTargetSelected with damage application', () => {
    function setupDamageModalMocks() {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Orc1' } },
          { name: 'Orc1' },
          { name: 'Goblin1', currentHp: 5, maxHp: 10 },
        ],
      });
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);
      rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0, formula: '1d6' });
      applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 1 });
      loadCombatSummary.mockResolvedValue({ creatures: [] });
      addEntry.mockResolvedValue(undefined);
    }

    it('rolls damage and applies it when a target is selected', async () => {
      setupDamageModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      const setPopupHtml = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal, setPopupHtml }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      await modalArgs.onTargetSelected('Goblin1');

      expect(rollExpression).toHaveBeenCalledWith('1d6');
      expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin1', 4, ['Force'], 'test-campaign', [], { ignoreResistance: false, attackerName: 'Ranger1' },);
    });

    it('logs a damage entry when target is selected', async () => {
      setupDamageModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      await modalArgs.onTargetSelected('Goblin1');

      expect(addEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({
          type: 'roll',
          characterName: 'Ranger1',
          rollType: 'damage',
          name: "Superior Hunter's Prey",
          formula: '1d6 [Superior Hunters Prey]',
          total: 4,
          damageType: 'Force',
          targetName: 'Goblin1',
        }),
      );
    });

    it('sets the used round flag after damage application', async () => {
      setupDamageModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      await modalArgs.onTargetSelected('Goblin1');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ranger1',
        '_Superior_Hunters_Prey_UsedRound',
        1,
        'test-campaign',
      );
    });

    it('closes the modal after damage application', async () => {
      setupDamageModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      await modalArgs.onTargetSelected('Goblin1');

      expect(setSecondaryTargetModal).toHaveBeenCalledWith(null);
    });

    it('rolls 1d10 for 20th level ranger (Foe Slayer)', async () => {
      setupDamageModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({
          setSecondaryTargetModal,
          playerStats: { name: 'Ranger1', level: 20, class: { name: 'Ranger' } },
        }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      await modalArgs.onTargetSelected('Goblin1');

      expect(rollExpression).toHaveBeenCalledWith('1d10');
    });

    it('updates popup with spread damage info', async () => {
      setupDamageModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      const setPopupHtml = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal, setPopupHtml }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      await modalArgs.onTargetSelected('Goblin1');

      expect(setPopupHtml).toHaveBeenCalledWith(
        expect.any(Function),
      );

      // Verify the function passed to setPopupHtml
      const popupFn = setPopupHtml.mock.calls[0][0];
      const result = popupFn(null);
      expect(result.spreadTargetName).toBe('Goblin1');
      expect(result.spreadFinalDamage).toBe(4);
      expect(result.spreadTargetCurrentHp).toBe(1);
      expect(result.spreadTargetMaxHp).toBe(10);
    });

    it('does not update popup when setPopupHtml is not provided', async () => {
      setupDamageModalMocks();

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      await modalArgs.onTargetSelected('Goblin1');

      expect(addEntry).toHaveBeenCalled();
      expect(setRuntimeValue).toHaveBeenCalled();
    });

    it('handles null combat summary from loadCombatSummary', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ranger1', concentration: { spell: "Hunter's Mark", target: 'Orc1' } },
          { name: 'Orc1' },
          { name: 'Goblin1', currentHp: 5, maxHp: 10 },
        ],
      });
      getRuntimeValue.mockReturnValue(null);
      getCurrentCombatRound.mockReturnValue(1);
      rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0, formula: '1d6' });
      loadCombatSummary.mockResolvedValue(null);
      addEntry.mockResolvedValue(undefined);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      await modalArgs.onTargetSelected('Goblin1');

      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({
          targetName: 'Goblin1',
          finalDamage: undefined,
        }),
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ranger1',
        '_Superior_Hunters_Prey_UsedRound',
        1,
        'test-campaign',
      );
    });

    it('handles rollExpression returning null (closes modal)', async () => {
      setupDamageModalMocks();
      rollExpression.mockReturnValue(null);

      const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
      const setSecondaryTargetModal = vi.fn();
      await superiorHuntersPrey.handler(
        makeCtx({ setSecondaryTargetModal }),
        prevData,
      );

      const modalArgs = setSecondaryTargetModal.mock.calls[0][0];
      await modalArgs.onTargetSelected('Goblin1');

      expect(setSecondaryTargetModal).toHaveBeenCalledWith(null);
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
