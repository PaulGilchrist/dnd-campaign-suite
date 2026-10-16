import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

import { handle } from './holdMonsterHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';
const orcName = 'Orc';

// Mirrors production PlayerStats shape: abilities is an ARRAY of {name, bonus}.
// NOTE(seam): the handler reads playerStats.abilities?.CON?.bonus (property access on
// an array → undefined), so concentration DC is 8 + proficiency + 0 = 12 here.
// Pinned as-is; if abilities ever becomes an object, this pin will flag the DC change.
function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }, { name: 'CON', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}, metaCtx = {}) {
  return {
    name: 'Hold Monster',
    automation: { type: 'hold_monster', saveType: 'WIS', saveDc: 15, ...automation },
    metaCtx,
  };
}

const baseCombatContext = {
  creatures: [
    { name: targetName, type: 'monster', currentHp: 5, maxHp: 7 },
    { name: orcName, type: 'monster', currentHp: 15, maxHp: 22 },
    { name: casterName, gridX: 5, gridY: 10, senses: [] },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

// ─── handle ───

describe('holdMonsterHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish deterministic defaults after clear (clearAllMocks keeps prior
    // implementations, which would leak DCs/save results across tests).
    getCombatContext.mockResolvedValue(baseCombatContext);
    buildSaveDc.mockImplementation(auto => auto?.saveDc ?? 15);
    resolveTarget.mockResolvedValue(null);
    getRuntimeValue.mockImplementation((_entity, key) =>
      key === 'activeConditions' ? [] : {},
    );
    createSaveListener.mockImplementation((_campaign, opts) => ({
      promptId: `hold-${opts.targetName}`,
      promise: Promise.resolve({ success: false }),
    }));
    addEntry.mockResolvedValue();
  });

  describe('combat context validation', () => {
    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Hold Monster',
        description: 'No creatures in combat. Hold Monster has no effect.',
      });
      expect(createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('target selection', () => {
    it('falls back to resolveTarget when metaCtx targets are missing or empty', async () => {
      resolveTarget.mockResolvedValue({ target: { name: targetName } });

      await handle(makeAction(), makePlayerStats(), campaignName, null);
      await handle(makeAction({}, { holdMonsterTargets: [] }), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledTimes(2);
      expect(resolveTarget).toHaveBeenNthCalledWith(1, campaignName, casterName);
      expect(resolveTarget).toHaveBeenNthCalledWith(2, campaignName, casterName);
    });

    it('returns popup when resolveTarget returns no target', async () => {
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No target selected. Hold Monster has no effect.');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('uses holdMonsterTargets from metaCtx without consulting resolveTarget', async () => {
      await handle(makeAction({}, { holdMonsterTargets: [targetName] }), makePlayerStats(), campaignName, null);

      expect(resolveTarget).not.toHaveBeenCalled();
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('uses holdPersonTargets from metaCtx without consulting resolveTarget', async () => {
      await handle(makeAction({}, { holdPersonTargets: [targetName] }), makePlayerStats(), campaignName, null);

      expect(resolveTarget).not.toHaveBeenCalled();
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });
  });

  describe('single target - failed save', () => {
    function handleFailedSave(automation = {}, metaCtx = { holdMonsterTargets: [targetName] }) {
      return handle(makeAction(automation, metaCtx), makePlayerStats(), campaignName, null);
    }

    it('replaces any existing paralyzed with an exact [paralyzed] write and summarizes', async () => {
      getRuntimeValue.mockImplementation((_entity, key) =>
        key === 'activeConditions' ? ['paralyzed', 'poisoned'] : {},
      );

      const result = await handleFailedSave();

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        ['poisoned', 'paralyzed'],
        campaignName,
      );
      expect(result.type).toBe('popup');
      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Hold Monster',
        description: '1 creature(s) paralyzed: Goblin. 0 creature(s) saved: .',
      });
    });

    it('appends paralyzed to existing non-paralyzed conditions', async () => {
      getRuntimeValue.mockImplementation((_entity, key) =>
        key === 'activeConditions' ? ['Frightened'] : {},
      );

      await handleFailedSave();

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        ['Frightened', 'paralyzed'],
        campaignName,
      );
    });

    it('merges repeat-save meta with exact DC and lowercased WIS ability', async () => {
      await handleFailedSave();

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditionMeta',
        { paralyzed: { dc: 15, ability: 'wis' } },
        campaignName,
      );
    });

    it('preserves unrelated and existing paralyzed meta when merging', async () => {
      getRuntimeValue.mockImplementation((_entity, key) => {
        if (key === 'activeConditions') return [];
        if (key === 'activeConditionMeta') {
          return { stunned: { dc: 12, ability: 'con' }, paralyzed: { dc: 8, ability: 'con', source: 'earlier' } };
        }
        return {};
      });

      await handleFailedSave();

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditionMeta',
        {
          stunned: { dc: 12, ability: 'con' },
          paralyzed: { dc: 15, ability: 'wis', source: 'earlier' },
        },
        campaignName,
      );
    });

    it('Hold Person repeat-save meta uses WIS ability (SP-066)', async () => {
      const action = {
        name: 'Hold Person',
        automation: { type: 'hold_monster', saveType: 'WIS', saveDc: 19 },
        metaCtx: { holdPersonTargets: [targetName] },
      };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditionMeta',
        { paralyzed: { dc: 19, ability: 'wis' } },
        campaignName,
      );
    });

    it('falls back to WIS when automation saveType is missing', async () => {
      await handleFailedSave({ saveType: undefined });

      const metaCall = setRuntimeValue.mock.calls.find(
        c => c[0] === targetName && c[1] === 'activeConditionMeta',
      );
      expect(metaCall[2].paralyzed).toEqual({ dc: 15, ability: 'wis' });
    });

    it('registers concentration on the caster with computed DC', async () => {
      await handleFailedSave();

      // 8 + proficiency(4) + abilities.CON.bonus (array shape → 0, see fixture note)
      expect(addConcentration).toHaveBeenCalledWith(baseCombatContext, casterName, 'Hold Monster', 12);
    });

    it('records lastAttack stamp, failed target result, expiration and log entries', async () => {
      await handleFailedSave();

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName,
        spellName: 'Hold Monster',
        saveType: 'WIS',
        saveDc: 15,
        attackScope: 'single',
      });
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['paralyzed'],
        appliedDamage: 0,
      });
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: casterName,
        targetName,
        effects: [{ type: 'condition', condition: 'paralyzed' }],
        campaignName,
      });
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          rollType: 'save-hold-monster',
          targetName,
          saveDc: 15,
          success: false,
          description: 'Goblin failed WIS save against Hold Monster and is Paralyzed.',
        }),
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: targetName,
          condition: 'Paralyzed',
          reason: 'Hold Monster',
          note: 'Goblin is Paralyzed by Hold Monster.',
        }),
      );
    });
  });

  describe('single target - successful save', () => {
    function setupSuccessfulSave() {
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt-success',
        promise: Promise.resolve({ success: true }),
      });
    }

    it('returns no-paralysis summary and registers no concentration', async () => {
      setupSuccessfulSave();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No creatures paralyzed. 1 creature(s) saved: Goblin.');
      expect(addConcentration).not.toHaveBeenCalled();
    });

    it('does not write conditions or condition meta on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(targetName, 'activeConditions', expect.anything(), campaignName);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(targetName, 'activeConditionMeta', expect.anything(), campaignName);
    });

    it('records a success target result with empty conditions', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('multi-target', () => {
    function setupMultiTarget(goblinSave, orcSave) {
      let callIndex = 0;
      createSaveListener.mockImplementation((_camp, _opts) => {
        const idx = callIndex++;
        const success = [goblinSave, orcSave][idx] ?? true;
        return {
          promptId: `hold-multi-${idx}`,
          promise: Promise.resolve({ success }),
        };
      });
    }

    it('paralyzes every failed target and summarizes both names', async () => {
      setupMultiTarget(false, false);

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'activeConditions', ['paralyzed'], campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith(orcName, 'activeConditions', ['paralyzed'], campaignName);
      expect(result.payload.description).toBe('2 creature(s) paralyzed: Goblin, Orc. 0 creature(s) saved: .');
    });

    it('handles mixed save results', async () => {
      setupMultiTarget(false, true);

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toBe('1 creature(s) paralyzed: Goblin. 1 creature(s) saved: Orc.');
      expect(setRuntimeValue).not.toHaveBeenCalledWith(orcName, 'activeConditions', expect.anything(), campaignName);
    });

    it('registers concentration once per paralyzed target', async () => {
      setupMultiTarget(false, false);

      await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(addConcentration).toHaveBeenCalledTimes(2);
      expect(addConcentration).toHaveBeenCalledWith(baseCombatContext, casterName, 'Hold Monster', 12);
    });

    it('counts unknown targets as saved (not found) without a save prompt', async () => {
      setupMultiTarget(false, false);

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, 'NonExistent'] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toBe('1 creature(s) paralyzed: Goblin. 1 creature(s) saved: NonExistent (not found).');
      expect(createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('skips targets immune to Paralyzed', async () => {
      getCombatContext.mockResolvedValue({
        ...baseCombatContext,
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, immunities: ['Paralyzed'] },
          { name: orcName, type: 'monster', currentHp: 15, maxHp: 22 },
          { name: casterName, gridX: 5, gridY: 10, senses: [] },
        ],
      });

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toBe('1 creature(s) paralyzed: Orc. 1 creature(s) saved: Goblin (immune).');
      expect(setRuntimeValue).not.toHaveBeenCalledWith(targetName, 'activeConditions', expect.anything(), campaignName);
      expect(createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('skips invisible targets when caster cannot see', async () => {
      getRuntimeValue.mockImplementation((_entity, key) => {
        if (key !== 'activeConditions') return {};
        return _entity === targetName ? ['invisible'] : [];
      });

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toBe('1 creature(s) paralyzed: Orc. 1 creature(s) saved: Goblin (invisible).');
      expect(setRuntimeValue).not.toHaveBeenCalledWith(targetName, 'activeConditions', expect.anything(), campaignName);
      expect(createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('allows invisible target when caster has Truesight', async () => {
      getCombatContext.mockResolvedValue({
        ...baseCombatContext,
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7 },
          { name: orcName, type: 'monster', currentHp: 15, maxHp: 22 },
          { name: casterName, gridX: 5, gridY: 10, senses: [{ name: 'Truesight', value: '60 ft.' }] },
        ],
      });
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_entity, key) =>
        key === 'activeConditions' ? ['invisible'] : {},
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('1 creature(s) paralyzed: Goblin. 0 creature(s) saved: .');
      expect(createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('allows invisible target when caster has Blindsight', async () => {
      getCombatContext.mockResolvedValue({
        ...baseCombatContext,
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7 },
          { name: orcName, type: 'monster', currentHp: 15, maxHp: 22 },
          { name: casterName, gridX: 5, gridY: 10, senses: [{ name: 'Blindsight', value: '30 ft' }] },
        ],
      });
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_entity, key) =>
        key === 'activeConditions' ? ['invisible'] : {},
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('1 creature(s) paralyzed: Goblin. 0 creature(s) saved: .');
      expect(createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('reports no creatures paralyzed when every target saves', async () => {
      setupMultiTarget(true, true);

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toBe('No creatures paralyzed. 2 creature(s) saved: Goblin, Orc.');
      expect(addConcentration).not.toHaveBeenCalled();
    });
  });

  describe('error resilience', () => {
    it('log rejection does not break the automation', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      addEntry.mockRejectedValueOnce(new Error('log down'));

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('1 creature(s) paralyzed');
      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith('[holdMonster] Error:', expect.any(Error));
      });
      errorSpy.mockRestore();
    });
  });
});
