import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './tashasLaughterHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

// damageRollback.js is REAL (unmocked) over the mocked useRuntimeState store:
// pins THIS lane's storeSpellLastAttack stamp + addTargetResult inputs; the
// ledger aggregation itself is canonical (see damageRollback.test.js).

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: "Tasha's Hideous Laughter",
    automation: { type: 'tashas_laughter', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

/**
 * Back the mocked runtime store with a Map so the REAL damageRollback
 * (storeSpellLastAttack → addTargetResult) round-trips coherently.
 * `seed` keys are 'playerName|key'.
 */
function mockRuntimeStore(seed = {}) {
  const store = new Map(Object.entries(seed));
  runtimeState.getRuntimeValue.mockImplementation((playerName, key) =>
    store.has(`${playerName}|${key}`) ? store.get(`${playerName}|${key}`) : null);
  runtimeState.setRuntimeValue.mockImplementation((playerName, key, value) => {
    store.set(`${playerName}|${key}`, value);
  });
  return store;
}

/** All setRuntimeValue calls for a runtime key (optionally one owner). */
function writesFor(key, playerName) {
  return runtimeState.setRuntimeValue.mock.calls.filter(
    ([player, k]) => k === key && (playerName == null || player === playerName));
}

function failListener(promptId, roll = 5) {
  const payload = { promptId, promise: Promise.resolve({ success: false, roll, total: roll + 1 }) };
  savePrompt.createSaveListener.mockReturnValue(payload);
}

function succeedListener(promptId, roll = 15) {
  const payload = { promptId, promise: Promise.resolve({ success: true, roll, total: roll + 4 }) };
  savePrompt.createSaveListener.mockReturnValue(payload);
}

const failResult = (promptId, roll = 5) => ({ promptId, promise: Promise.resolve({ success: false, roll, total: roll + 1 }) });
const successResult = (promptId, roll = 15) => ({ promptId, promise: Promise.resolve({ success: true, roll, total: roll + 4 }) });

// ── handle ───────────────────────────────────────────────────────

describe('tashasLaughterHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('should return popup when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('target processing', () => {
    it('should skip the caster and prompt each monster with the exact save shape', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      succeedListener('laughter-caster-skip');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
      expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(1, campaignName, {
        targetName: 'Goblin', saveType: 'WIS', saveDc: 14, dcSuccess: 'none', disadvantage: false,
      });
      expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(2, campaignName, {
        targetName: 'Orc', saveType: 'WIS', saveDc: 14, dcSuccess: 'none', disadvantage: false,
      });
    });

    it('should mark the heightenTarget save with disadvantage', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      succeedListener('laughter-heighten');

      const action = {
        ...makeAction(),
        metaCtx: { targets: ['Goblin', 'Orc'], heightenTarget: 'Goblin' },
      };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(1, campaignName,
        expect.objectContaining({ targetName: 'Goblin', disadvantage: true }));
      expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(2, campaignName,
        expect.objectContaining({ targetName: 'Orc', disadvantage: false }));
    });

    it('should return early when all creatures are the caster', async () => {
      const onlyPlayerCombat = {
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(onlyPlayerCombat);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toBe("No valid targets selected. Tasha's Hideous Laughter has no effect.");
      expect(result.payload.name).toBe("Tasha's Hideous Laughter");
    });

    it('should log one ability_use row per target with the exact cast description', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      succeedListener('laughter-ability-use');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: "Tasha's Hideous Laughter",
        description: "TestCaster casts Tasha's Hideous Laughter! Goblin must make a WIS save (DC 15) or become Prone and Incapacitated.",
        promptId: 'laughter-ability-use',
      }));
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        description: "TestCaster casts Tasha's Hideous Laughter! Orc must make a WIS save (DC 15) or become Prone and Incapacitated.",
      }));
    });

    it('should summarize the all-saved branch verbatim', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(20);
      succeedListener('laughter-success');

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe("No creatures affected by Tasha's Hideous Laughter. 2 creature(s) saved.");
    });

    it('should summarize a mixed affected/saved outcome verbatim', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      let callCount = 0;
      savePrompt.createSaveListener.mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? failResult('laughter-prompt-1')
          : successResult('laughter-prompt-2');
      });
      mockRuntimeStore();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        "Tasha's Hideous Laughter affects 1 creature(s). Goblin is Prone and Incapacitated. 1 creature(s) saved. Affected creatures are Prone and Incapacitated."
      );
    });

    it('should filter targets when metaCtx.targets is provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      failListener('laughter-selected');

      const action = { ...makeAction(), metaCtx: { targets: ['Goblin'] } };
      await handle(action, makePlayerStats(), campaignName, null);

      // Only Goblin should get a save listener, not Orc
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });

    it('should return early when selected targets are empty after filtering', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);

      const action = { ...makeAction(), metaCtx: { targets: [] } };
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toBe("No valid targets selected. Tasha's Hideous Laughter has no effect.");
    });

    it('should exclude caster from selected targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      succeedListener('laughter-caster-filtered');

      const action = { ...makeAction(), metaCtx: { targets: ['TestCaster', 'Goblin'] } };
      await handle(action, makePlayerStats(), campaignName, null);

      // Only Goblin should get a save listener; TestCaster is excluded
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });
  });

  describe('failed save handling', () => {
    function setupFailedSaveMock(seed = {}) {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      failListener('laughter-fail');
      return mockRuntimeStore({
        'Goblin|activeConditions': [],
        'Orc|activeConditions': [],
        'campaign|targetEffects': [],
        ...seed,
      });
    }

    it('should apply Prone and Incapacitated to every failing target', async () => {
      setupFailedSaveMock();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      for (const target of ['Goblin', 'Orc']) {
        const condWrite = writesFor('activeConditions', target).at(-1);
        expect(condWrite).toBeDefined();
        expect(condWrite[2]).toEqual(['prone', 'incapacitated']);
      }
      expect(result.payload.description).toContain('Prone and Incapacitated');
    });

    it('should preserve existing conditions and dedupe case-insensitively', async () => {
      setupFailedSaveMock({
        'Goblin|activeConditions': ['frightened', 'PRONE', 'Incapacitated'],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const goblinWrite = writesFor('activeConditions', 'Goblin').at(-1);
      expect(goblinWrite[2]).toEqual(['frightened', 'prone', 'incapacitated']);
    });

    it('should stamp activeConditionMeta with the recurring WIS save DC on both conditions', async () => {
      setupFailedSaveMock({
        'Goblin|activeConditionMeta': { frightened: { dc: 10, ability: 'wis' } },
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(writesFor('activeConditionMeta', 'Goblin').at(-1)[2]).toEqual({
        frightened: { dc: 10, ability: 'wis' },
        prone: { dc: 15, ability: 'wis' },
        incapacitated: { dc: 15, ability: 'wis' },
      });
    });

    it('should add expiration for concentration', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [
          { type: 'condition', condition: 'prone' },
          { type: 'condition', condition: 'incapacitated' },
          { type: 'tashas_laughter_expiration' },
        ],
        campaignName,
      });
    });

    it('should register tashas_hideous_laughter targetEffects for all failed targets', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const effectWrite = writesFor('targetEffects', 'campaign').at(-1);
      expect(effectWrite[2]).toEqual([
        { target: 'Goblin', effect: 'tashas_hideous_laughter', source: 'TestCaster', dc: 15, duration: 'concentration', conditions: ['prone', 'incapacitated'] },
        { target: 'Orc', effect: 'tashas_hideous_laughter', source: 'TestCaster', dc: 15, duration: 'concentration', conditions: ['prone', 'incapacitated'] },
      ]);
    });

    it('should update the existing same-source targetEffect in place without duplicating', async () => {
      const decoy = { target: 'Goblin', effect: 'bless', source: 'Cleric', dc: 12 };
      setupFailedSaveMock({
        'campaign|targetEffects': [
          decoy,
          { target: 'Goblin', effect: 'tashas_hideous_laughter', source: 'TestCaster', dc: 14, duration: 'concentration', conditions: ['prone', 'incapacitated'] },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const goblinLaughter = writesFor('targetEffects', 'campaign').at(-1)[2]
        .filter(te => te.target === 'Goblin' && te.effect === 'tashas_hideous_laughter');
      expect(goblinLaughter).toEqual([
        { target: 'Goblin', effect: 'tashas_hideous_laughter', source: 'TestCaster', dc: 15, duration: 'concentration', conditions: ['prone', 'incapacitated'] },
      ]);
      // Unrelated effects survive the recast untouched
      expect(writesFor('targetEffects', 'campaign').at(-1)[2]).toContainEqual(decoy);
    });

    it('should log exact condition and save_result failure rows', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Prone, Incapacitated',
        reason: "Tasha's Hideous Laughter spell",
        note: "Goblin is Prone and Incapacitated by Tasha's Hideous Laughter. The target can't end the Prone condition on itself.",
      }));
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-tashas-laughter',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'WIS',
        success: false,
        description: "Goblin failed WIS save against Tasha's Hideous Laughter and is Prone and Incapacitated.",
      }));
    });
  });

  describe('lastAttack ledger (own writes; aggregation canonical in damageRollback)', () => {
    it('should stamp a zero-damage single-target spell-save lastAttack before the loop', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      succeedListener('laughter-ledger');
      const store = mockRuntimeStore();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const stamp = writesFor('lastAttack', 'campaign')[0][2];
      expect(store.get('campaign|lastAttack')).toBeTruthy();
      expect({
        attackerName: stamp.attackerName,
        attackName: stamp.attackName,
        rollType: stamp.rollType,
        saveType: stamp.saveType,
        saveDc: stamp.saveDc,
        attackScope: stamp.attackScope,
        damageFormula: stamp.damageFormula,
        damageType: stamp.damageType,
        damageOnFailure: stamp.damageOnFailure,
        spellSchool: stamp.spellSchool,
      }).toEqual({
        attackerName: 'TestCaster',
        attackName: "Tasha's Hideous Laughter",
        rollType: 'spell-save',
        saveType: 'WIS',
        saveDc: 15,
        attackScope: 'single',
        damageFormula: null,
        damageType: null,
        damageOnFailure: 0,
        spellSchool: null,
      });
    });

    it('should record per-target save outcomes in the ledger', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      let callCount = 0;
      savePrompt.createSaveListener.mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? failResult('ledger-fail', 6)
          : successResult('ledger-save', 17);
      });
      const store = mockRuntimeStore();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const finalLedger = writesFor('lastAttack', 'campaign').at(-1)[2];
      expect(finalLedger).toBe(store.get('campaign|lastAttack'));
      expect(finalLedger.targetResults).toEqual([
        { targetName: 'Goblin', saveResult: 'failure', roll: 6, total: 7, conditions: ['prone', 'incapacitated'], appliedDamage: 0 },
        { targetName: 'Orc', saveResult: 'success', roll: 17, total: 21, conditions: [], appliedDamage: 0 },
      ]);
      // Condition-only spell: damage flags stay inert
      expect(finalLedger.damageApplied).toBe(false);
      expect(finalLedger.actualDamage).toBe(0);
    });
  });

  describe('successful save handling', () => {
    it('should not apply conditions, badge, or expiration when saves succeed', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(20);
      succeedListener('laughter-success-save');
      mockRuntimeStore();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(writesFor('activeConditions')).toHaveLength(0);
      expect(writesFor('targetEffects')).toHaveLength(0);
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        saveType: 'WIS',
        success: true,
        description: "Goblin succeeded on WIS save against Tasha's Hideous Laughter.",
      }));
    });
  });

  describe('error handling', () => {
    it('should survive total logging failure with every state write still landed', async () => {
      const logErr = new Error('log write failed');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      failListener('laughter-catch-all');
      mockRuntimeStore({
        'Goblin|activeConditions': [],
        'Orc|activeConditions': [],
        'campaign|targetEffects': [],
      });
      addEntry.mockImplementation(() => Promise.reject(logErr));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Prone and Incapacitated');
      // State writes landed despite all four log categories rejecting:
      // ability_use ×2 + condition ×2 + save_result-failure ×2 (rolls awaited after writes)
      for (const target of ['Goblin', 'Orc']) {
        expect(writesFor('activeConditions', target)).toHaveLength(1);
        expect(writesFor('activeConditionMeta', target)).toHaveLength(1);
      }
      expect(expirations.addExpiration).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith('[tashasLaughter] Error:', logErr);
      expect(spy).toHaveBeenCalledTimes(6);
    });

    it('should treat a missing automation object as empty config', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      succeedListener('laughter-no-automation');

      const stats = makePlayerStats();
      const action = { name: "Tasha's Hideous Laughter" };
      const result = await handle(action, stats, campaignName, null);

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith({}, stats);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe("No creatures affected by Tasha's Hideous Laughter. 2 creature(s) saved.");
    });

    it('should treat non-array activeConditions as empty and still apply conditions', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      failListener('laughter-non-array-conditions');
      mockRuntimeStore({
        'Goblin|activeConditions': 'not-an-array',
        'Orc|activeConditions': [],
        'campaign|targetEffects': [],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Prone and Incapacitated');
      expect(writesFor('activeConditions', 'Goblin').at(-1)[2]).toEqual(['prone', 'incapacitated']);
    });
  });
});
