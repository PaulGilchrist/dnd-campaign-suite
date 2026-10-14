import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn((auto) => auto.saveDc || 15),
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

import { handle } from './holdMonsterHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';
const orcName = 'Orc';

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
  });

  describe('combat context validation', () => {
    it('returns popup when combat context is missing creatures', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target resolution', () => {
    it('uses resolveTarget when no metaCtx targets provided', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, casterName);
    });

    it('returns summary when resolveTarget returns no target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('uses holdMonsterTargets from metaCtx', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-meta',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction({}, { holdMonsterTargets: [targetName] }), makePlayerStats(), campaignName, null);

      expect(resolveTarget).not.toHaveBeenCalled();
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName }));
    });

    it('uses holdPersonTargets from metaCtx', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-person-meta',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction({}, { holdPersonTargets: [targetName] }), makePlayerStats(), campaignName, null);

      expect(resolveTarget).not.toHaveBeenCalled();
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName }));
    });
  });

  describe('single target - failed save', () => {
    function setupFailedSave(existingConditions = []) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return existingConditions;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('applies Paralyzed condition on failed save', async () => {
      setupFailedSave();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.arrayContaining(['paralyzed']),
        campaignName,
      );
      expect(result.payload.description).toContain('paralyzed');
    });

    it('appends paralyzed to existing conditions', async () => {
      setupFailedSave(['Frightened']);
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.arrayContaining(['Frightened', 'paralyzed']),
        campaignName,
      );
    });

    it('stores condition metadata with DC and WIS ability for repeat saves', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditionMeta',
        expect.objectContaining({
          paralyzed: expect.objectContaining({ dc: 15, ability: 'wis' }),
        }),
        campaignName,
      );
    });

    it('Hold Person repeat-save meta uses WIS ability (SP-066)', async () => {
      setupFailedSave();
      buildSaveDc.mockReturnValue(19);
      const action = {
        name: 'Hold Person',
        automation: { type: 'hold_monster', saveType: 'WIS', saveDc: 19 },
        metaCtx: { holdPersonTargets: [targetName] },
      };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditionMeta',
        expect.objectContaining({
          paralyzed: expect.objectContaining({ dc: 19, ability: 'wis' }),
        }),
        campaignName,
      );
    });

    it('falls back to WIS ability when automation saveType is missing', async () => {
      setupFailedSave();
      const action = {
        name: 'Hold Monster',
        automation: { type: 'hold_monster' },
        metaCtx: { holdMonsterTargets: [targetName] },
      };
      await handle(action, makePlayerStats(), campaignName, null);

      const metaCall = setRuntimeValue.mock.calls.find(
        c => c[0] === targetName && c[1] === 'activeConditionMeta',
      );
      expect(metaCall[2].paralyzed.ability).toBe('wis');
    });

    it('registers concentration on the caster', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        baseCombatContext,
        casterName,
        'Hold Monster',
        expect.any(Number),
      );
    });

    it('returns summary popup with paralyzed count', async () => {
      setupFailedSave();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('1 creature(s) paralyzed');
    });
  });

  describe('single target - successful save', () => {
    function setupSuccessfulSave() {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt-success',
        promise: Promise.resolve({ success: true }),
      });
    }

    it('returns popup when target succeeds save', async () => {
      setupSuccessfulSave();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });

    it('does not apply any conditions on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('does not register concentration on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).not.toHaveBeenCalled();
    });
  });

  describe('multi-target', () => {
    function setupMultiTarget(goblinSave, orcSave) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        return [];
      });
      let callIndex = 0;
      createSaveListener.mockImplementation((_camp, _opts) => {
        const idx = callIndex++;
        const saveResult = [goblinSave, orcSave][idx];
        return {
          promptId: `hold-multi-${idx}`,
          promise: Promise.resolve({ success: saveResult }),
        };
      });
    }

    it('processes all targets and returns summary', async () => {
      setupMultiTarget(false, false);

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('2 creature(s) paralyzed');
      expect(result.payload.description).toContain(targetName);
      expect(result.payload.description).toContain(orcName);
    });

    it('handles mixed save results', async () => {
      setupMultiTarget(false, true);

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('1 creature(s) paralyzed');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });

    it('only registers concentration once (first failed save)', async () => {
      setupMultiTarget(false, false);

      await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(addConcentration).toHaveBeenCalledTimes(2);
    });

    it('applies paralyzed to all failed targets', async () => {
      setupMultiTarget(false, false);

      await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'activeConditions', expect.arrayContaining(['paralyzed']), campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith(orcName, 'activeConditions', expect.arrayContaining(['paralyzed']), campaignName);
    });

    it('skips targets not found in combat', async () => {
      setupMultiTarget(false, false);

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, 'NonExistent'] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('1 creature(s) paralyzed');
      expect(result.payload.description).toContain('1 creature(s) saved');
      expect(result.payload.description).toContain('not found');
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
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hold-immune',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('1 creature(s) paralyzed');
      expect(result.payload.description).toContain('1 creature(s) saved');
      expect(result.payload.description).toContain('immune');
      expect(createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('skips invisible targets when caster cannot see', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') {
          return _entity === targetName ? ['invisible'] : [];
        }
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-invisible',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('1 creature(s) paralyzed');
      expect(result.payload.description).toContain('1 creature(s) saved');
      expect(result.payload.description).toContain('invisible');
      expect(createSaveListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('target validation (resolveTarget path)', () => {
    it('handles target not found when using resolveTarget', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: orcName, type: 'monster', currentHp: 15, maxHp: 22 },
          { name: casterName, gridX: 5, gridY: 10, senses: [] },
        ],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'NonExistent' } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not found');
    });

    it('allows spell when target is invisible but caster has Truesight', async () => {
      getCombatContext.mockResolvedValue({
        ...baseCombatContext,
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7 },
          { name: orcName, type: 'monster', currentHp: 15, maxHp: 22 },
          { name: casterName, gridX: 5, gridY: 10, senses: [{ name: 'Truesight', value: '60 ft.' }] },
        ],
      });
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return ['invisible'];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-truesight',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s) paralyzed');
      expect(createSaveListener).toHaveBeenCalled();
    });

    it('allows spell when target is invisible but caster has Blindsight', async () => {
      getCombatContext.mockResolvedValue({
        ...baseCombatContext,
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7 },
          { name: orcName, type: 'monster', currentHp: 15, maxHp: 22 },
          { name: casterName, gridX: 5, gridY: 10, senses: [{ name: 'Blindsight', value: '30 ft' }] },
        ],
      });
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return ['invisible'];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-blindsight',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s) paralyzed');
      expect(createSaveListener).toHaveBeenCalled();
    });
  });

  describe('empty multi-target', () => {
    it('uses resolveTarget when holdMonsterTargets is empty array', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-empty',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction({}, { holdMonsterTargets: [] }), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalled();
    });
  });

  describe('no targets paralyzed', () => {
    it('returns summary with 0 paralyzed when all targets save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-all-save',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(
        makeAction({}, { holdMonsterTargets: [targetName, orcName] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('No creatures paralyzed');
      expect(result.payload.description).toContain('2 creature(s) saved');
      expect(addConcentration).not.toHaveBeenCalled();
    });
  });
});
