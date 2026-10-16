/**
 * hypnoticPatternHandler.test.js — cast-resolution lane (FIRST of the hypnoticPattern pair).
 *
 * PAIR SEAM MAP:
 * - THIS FILE — hypnoticPatternHandler.js handle(): the WIS AoE save-prompt contract
 *   (createSaveListener per non-caster target), the charmed+incapacitated+speed_zero
 *   trio write to activeConditions (we are the trio producer), addExpiration stamps,
 *   concentration registration (addConcentration + storage.set + combat-summary-updated
 *   event), the aoe lastAttack rollback feed (real damageRollback over the mocked
 *   runtime store), and popup summary composition.
 * - SIBLING #1926 — hypnoticPatternShake.js (SEPARATE module, registered as
 *   hypnotic_pattern_shake / hypnotic_pattern_shake_confirm): owns the "shake it free"
 *   action — handle() eligible-target picking, modalName 'hypnoticPatternShake',
 *   and handleConfirm() trio removal. Not re-tested here.
 * - hypnoticPatternService.js — distinct module, already covered by its own suite
 *   (hypnoticPatternService.test.js, applyDamage.hypnotic-break.test.js,
 *   createCreatureHandlers.sp069.test.js): triggerHypnoticPattern dispatch and
 *   wake-on-damage breakHypnoticPatternOnDamage. Not re-tested here.
 * - Related, distinct modules (no exact-name dupes): confusionHandler.js (charms
 *   without incapacitated — its own repeat-save lane), charm pair (charmPerson/
 *   charmMonster), holdMonsterHandler.js (#1924).
 *
 * #1924 holdMonster PROD BUG pattern (abilities ARRAY access): audited here — ABSENT.
 * handle() never reads playerStats.abilities; buildSaveDc() consumes abilities via
 * getAbilityModifier()'s canonical ARRAY shape (.find by name), which matches the
 * fixture below. Pin kept honest accordingly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.spyOn(window, 'dispatchEvent').mockImplementation(() => {});

import { handle } from './hypnoticPatternHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';

const campaignName = 'test-campaign';

// abilities is the canonical ARRAY shape consumed by getAbilityModifier() (.find by
// name) via buildSaveDc — kept in production shape per the #1924 holdMonster audit.
function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

// makeAction MERGES overrides onto the defaults (intentional — lane convention).
function makeAction(automation = {}) {
  return {
    name: 'Hypnotic Pattern',
    automation: { type: 'hypnotic_pattern', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

// Key-scoped fake for the runtime store so BOTH lanes that read getRuntimeValue work:
// applyHypnoticPatternCharm ('activeConditions') and the real damageRollback
// addTargetResult ('campaign'/'lastAttack'). A flat mockReturnValue previously made
// addTargetResult silently early-return (rollType guard), rendering the rollback
// assertions vacuous.
function useFakeRuntimeStore(initialConditions = {}) {
  const store = {};
  setRuntimeValue.mockImplementation((characterKey, key, value) => {
    store[`${characterKey}::${key}`] = value;
  });
  getRuntimeValue.mockImplementation((characterKey, key) => {
    const stored = store[`${characterKey}::${key}`];
    if (stored !== undefined) return stored;
    if (key === 'activeConditions') return initialConditions[characterKey] ?? [];
    return null;
  });
  return store;
}

function lastAttackWrites() {
  return setRuntimeValue.mock.calls.filter(
    ([characterKey, key]) => characterKey === 'campaign' && key === 'lastAttack',
  );
}

describe('hypnoticPatternHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(null);
  });

  describe('combat context validation', () => {
    it('returns the no-effect popup with zero side effects when context is missing or empty', async () => {
      getCombatContext.mockResolvedValue(null);
      let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Hypnotic Pattern',
          description: 'No creatures in combat. Hypnotic Pattern has no effect.',
        },
      });

      getCombatContext.mockResolvedValue({ creatures: [] });
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toBe('No creatures in combat. Hypnotic Pattern has no effect.');

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addConcentration).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('target processing', () => {
    it('skips the caster and issues the exact WIS save-prompt contract to each other creature', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-config',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(createSaveListener).toHaveBeenNthCalledWith(1, campaignName, {
        targetName: 'Goblin', saveType: 'WIS', saveDc: 15,
        dcSuccess: 'none', disadvantage: false, condition: 'charmed',
      });
      expect(createSaveListener).toHaveBeenNthCalledWith(2, campaignName, {
        targetName: 'Orc', saveType: 'WIS', saveDc: 15,
        dcSuccess: 'none', disadvantage: false, condition: 'charmed',
      });

      // ability_use log per prompt (no timestamp field on this entry)
      expect(addEntry).toHaveBeenCalledTimes(4); // 2 ability_use + 2 condition applied
      expect(addEntry).toHaveBeenNthCalledWith(1, campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Hypnotic Pattern',
        description: 'TestCaster casts Hypnotic Pattern! Goblin must make a WIS save (DC 15) or become Charmed, Incapacitated, and have Speed 0.',
        promptId: 'hypno-config',
      });
    });

    it('imposes disadvantage only on the metaCtx.heightenTarget', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      const actionWithHeighten = {
        name: 'Hypnotic Pattern',
        automation: { type: 'hypnotic_pattern', saveType: 'WIS', saveDc: 15 },
        metaCtx: { heightenTarget: 'Goblin' },
      };
      createSaveListener.mockReturnValue({
        promptId: 'hypno-disadv',
        promise: Promise.resolve({ success: false }),
      });

      await handle(actionWithHeighten, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenNthCalledWith(1, campaignName, expect.objectContaining({
        targetName: 'Goblin', disadvantage: true,
      }));
      expect(createSaveListener).toHaveBeenNthCalledWith(2, campaignName, expect.objectContaining({
        targetName: 'Orc', disadvantage: false,
      }));
    });

    it('composes full popup summaries for single, all-saved, and mixed outcomes', async () => {
      // Single target, fails save
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      buildSaveDc.mockReturnValue(14);
      useFakeRuntimeStore();
      createSaveListener.mockReturnValue({
        promptId: 'hypno-single',
        promise: Promise.resolve({ success: false }),
      });
      let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toBe(
        'Hypnotic Pattern affects 1 creature(s). Goblin is Charmed, Incapacitated, and has Speed 0. 0 creature(s) saved. Affected creatures are Charmed, Incapacitated, and have Speed 0. The spell ends for an affected creature if it takes damage or someone uses an action to shake it free.',
      );

      // All save successfully
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-all-success',
        promise: Promise.resolve({ success: true }),
      });
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toBe('No creatures affected by Hypnotic Pattern. 2 creature(s) saved.');

      // Mixed: Goblin (1st) fails, Orc (2nd) saves
      buildSaveDc.mockReturnValue(14);
      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        const success = callCount !== 1;
        return { promptId: `hypno-prompt-${callCount}`, promise: Promise.resolve({ success }) };
      });
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toBe(
        'Hypnotic Pattern affects 1 creature(s). Goblin is Charmed, Incapacitated, and has Speed 0. 1 creature(s) saved. Affected creatures are Charmed, Incapacitated, and have Speed 0. The spell ends for an affected creature if it takes damage or someone uses an action to shake it free.',
      );

      // Success lane logs its own exact save_result entry
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-hypnotic-pattern',
        targetName: 'Orc',
        saveDc: 14,
        saveType: 'WIS',
        success: true,
        description: 'Orc succeeded on WIS save against Hypnotic Pattern.',
      });
    });
  });

  describe('failed save handling (trio producer lane)', () => {
    it('writes the hypno trio, exact condition log note, and exact expiration stamps', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      const store = useFakeRuntimeStore({ Goblin: ['Stunned'] });
      createSaveListener.mockReturnValue({
        promptId: 'hypno-cond',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions',
        ['Stunned', 'charmed', 'incapacitated', 'speed_zero'],
        campaignName,
      );
      expect(store['Goblin::activeConditions']).toEqual(['Stunned', 'charmed', 'incapacitated', 'speed_zero']);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed, Incapacitated, Speed 0',
        reason: 'Hypnotic Pattern spell',
        note: 'Goblin is Charmed, Incapacitated, and has Speed 0. The spell ends if the creature takes damage or someone uses an action to shake it free.',
        timestamp: expect.any(Number),
      });

      expect(addExpiration).toHaveBeenCalledTimes(2); // Goblin + Orc
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [
          { type: 'charmed', condition: 'charmed' },
          { type: 'incapacitated', condition: 'incapacitated' },
          { type: 'speed_zero', condition: 'speed_zero' },
        ],
        campaignName,
      });
    });

    it('filters out charmed, incapacitated, and speed_zero from existing conditions before re-adding', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      useFakeRuntimeStore({ Goblin: ['charmed', 'Stunned', 'speed_zero', 'incapacitated'] });
      createSaveListener.mockReturnValue({
        promptId: 'hypno-dedup',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions',
        ['Stunned', 'charmed', 'incapacitated', 'speed_zero'],
        campaignName,
      );
    });

    it('handles non-array activeConditions value gracefully', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      useFakeRuntimeStore({ Goblin: 'charmed' });
      createSaveListener.mockReturnValue({
        promptId: 'hypno-nonarray',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions',
        ['charmed', 'incapacitated', 'speed_zero'],
        campaignName,
      );
    });
  });

  describe('concentration registration', () => {
    it('registers concentration on combat summary with computed DC and broadcasts the summary', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      const summary = { creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }] };
      getCombatSummary.mockReturnValue(summary);
      buildSaveDc.mockReturnValue(15);
      useFakeRuntimeStore();
      createSaveListener.mockReturnValue({
        promptId: 'hypno-conc',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // DC = 8 + proficiency (4) when spellAbilities.saveDc is absent
      expect(addConcentration).toHaveBeenCalledWith(summary, 'TestCaster', 'Hypnotic Pattern', 12);
      expect(storage.set).toHaveBeenCalledWith('combatSummary', summary, campaignName);
      expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'combat-summary-updated',
      }));
    });

    it('uses spellAbilities.saveDc when available instead of computing from proficiency', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      const summary = { creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }] };
      getCombatSummary.mockReturnValue(summary);
      buildSaveDc.mockReturnValue(15);
      useFakeRuntimeStore();
      createSaveListener.mockReturnValue({
        promptId: 'hypno-spell-dc',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats({ spellAbilities: { saveDc: 17 } }), campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(summary, 'TestCaster', 'Hypnotic Pattern', 17);
    });

    it('does not register concentration when there is no combat summary', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getCombatSummary.mockReturnValue(null);
      buildSaveDc.mockReturnValue(15);
      useFakeRuntimeStore();
      createSaveListener.mockReturnValue({
        promptId: 'hypno-no-conc',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(window.dispatchEvent).not.toHaveBeenCalled();
    });
  });

  describe('popup payload and edge cases', () => {
    it('all-caster area: no prompts, exact no-affected summary', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('No creatures affected by Hypnotic Pattern. 0 creature(s) saved.');
    });

    it('empty automation, zero-proficiency stats, and custom action name flow through the contract', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      useFakeRuntimeStore();
      createSaveListener.mockReturnValue({
        promptId: 'hypno-empty-auto',
        promise: Promise.resolve({ success: false }),
      });

      // Empty automation — raw {} handed to buildSaveDc, popup keeps action name
      let result = await handle({ name: 'Hypnotic Pattern', automation: {} }, makePlayerStats(), campaignName, null);
      expect(buildSaveDc).toHaveBeenCalledWith({}, expect.objectContaining({ name: 'TestCaster' }));
      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Hypnotic Pattern');

      // No proficiency — buildSaveDc receives the raw automation + stats, handler defaults DC itself
      const ps = makePlayerStats({ proficiency: 0, abilities: [] });
      const action = makeAction();
      result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenLastCalledWith(action.automation, ps);

      // Custom action name — abilityName follows action.name; description hardcodes the spell
      const customAction = { name: 'My Hypno', automation: { type: 'hypnotic_pattern', saveType: 'WIS', saveDc: 15 } };
      await handle(customAction, makePlayerStats(), campaignName, null);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'My Hypno',
        description: 'TestCaster casts Hypnotic Pattern! Goblin must make a WIS save (DC 10) or become Charmed, Incapacitated, and have Speed 0.',
        promptId: 'hypno-empty-auto',
      });
    });
  });

  describe('lastAttack rollback feed (real damageRollback over fake store)', () => {
    it('stores the exact aoe header, then per-target results in cast order with roll/total defaults', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      useFakeRuntimeStore();
      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        // No roll/total fields — pins the ?? 0 defaults in the rollback entries.
        const success = callCount !== 1; // Goblin fails, Orc saves
        return { promptId: `hypno-la-${callCount}`, promise: Promise.resolve({ success }) };
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // 1 header (storeSpellLastAttack) + 2 aggregate writes (addTargetResult)
      const writes = lastAttackWrites();
      expect(writes).toHaveLength(3);
      expect(writes.every(([, key, , campaign]) => key === 'lastAttack' && campaign === campaignName)).toBe(true);

      // Exact header written before the target loop
      expect(writes[0][2]).toEqual({
        attackerName: 'TestCaster',
        attackName: 'Hypnotic Pattern',
        rollType: 'spell-save',
        spellSchool: null,
        saveType: 'WIS',
        saveDc: 15,
        attackScope: 'aoe',
        damageFormula: null,
        damageType: null,
        damageOnSuccess: 0,
        damageOnFailure: 0,
        targetResults: [],
        affectedTargets: [],
        statusEffects: [],
        rawDamage: 0,
        primaryDamage: 0,
        actualDamage: 0,
        damageApplied: false,
        timestamp: expect.any(Number),
      });

      // Final aggregate after both targets resolved
      expect(writes[2][2]).toEqual({
        ...writes[0][2],
        targetResults: [
          { targetName: 'Goblin', saveResult: 'failure', roll: 0, total: 0, conditions: ['charmed', 'incapacitated', 'speed_zero'], appliedDamage: 0 },
          { targetName: 'Orc', saveResult: 'success', roll: 0, total: 0, conditions: [], appliedDamage: 0 },
        ],
        affectedTargets: ['Goblin', 'Orc'],
        statusEffects: ['charmed', 'incapacitated', 'speed_zero'],
        rawDamage: 0,
        primaryDamage: 0,
        actualDamage: 0,
        damageApplied: false,
      });
    });
  });

  // Kept last: addEntry rejects for the remainder of this file's run (mockClear in
  // beforeEach does not restore the default resolve implementation).
  describe('save result logging with addEntry rejection', () => {
    it('completes the cast when the log service rejects — every lane still lands, no unhandled rejections', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      const store = useFakeRuntimeStore();
      addEntry.mockImplementation(() => Promise.reject(new Error('log failure')));
      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        const success = callCount !== 1;
        return {
          promptId: `hypno-reject-${callCount}`,
          promise: Promise.resolve({ success, roll: success ? 18 : 5, total: success ? 22 : 7 }),
        };
      });

      // All 4 addEntry sites (2 ability_use, 1 save_result, 1 condition) reject and
      // each is .caught by the handler — the cast must still resolve fully.
      await expect(handle(makeAction(), makePlayerStats(), campaignName, null)).resolves.toBeDefined();

      expect(addEntry).toHaveBeenCalledTimes(4);
      expect(store['Goblin::activeConditions']).toEqual(['charmed', 'incapacitated', 'speed_zero']);
      expect(lastAttackWrites()).toHaveLength(3);
      expect(lastAttackWrites()[2][2].targetResults).toHaveLength(2);
    });
  });
});
