// @maintained-by-ai
// #1943 .save-results lane — save-result event flow for prismaticSprayHandler.js.
// SEXTET seam map lives in prismaticSprayHandler.damage-regression.test.js — READ FIRST.
// Owns: immunity-skip plumbing, disadvantage flags, save_result/addTargetResult log
// wiring, zero/null-damage guards, ability_use entries, per-target save-outcome flow.
// Does NOT pin: 12d6 fix sites (damage-regression lane), ray-table payloads / status
// writes (#1942 rays), dispatch counts (#1940 handle), summary prose (#1944).
//
// DECISION on #1939 handoff rec (canned computeDamageAfterSave stubs): REBUILT, not shed.
// The old 'applies half/full damage on save' pins stubbed computeDamageAfterSave to
// canned totals whose ARGS were ignored — a wrong `succeeded` argument at either
// applyRayDamage call site was uncatchable here. Both pins are replaced by ONE
// mixed-outcome flow test running the REAL computeDamageAfterSave (importActual partial
// mock — keep-real, no re-implementation of #1939's floor pin; partial-mock feasibility
// proven by charmSpellUtils.metamagic-disadvantage.test.js on this same module).
// Unique flow value kept in THIS lane: single-cast multi-target processSpraySaves
// correlation (saveIndex ↔ saveResults ↔ promises) — Goblin SAVES while Orc FAILS, so
// per-target damage amounts, per-target save_result/addTargetResult dispatch, and the
// damage-ray condition-absence guards all diverge in one cast; #1939's single-target
// two-cast pin cannot catch target-misbinding. The zero/null not.toHaveBeenCalled
// guards are retained — they now prove the REAL floor path (saved raw 1 →
// floor(1/2)=0, failed raw 0 → 0) never reaching applyDamageToTarget.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

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

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

// Keep-real SPY computeDamageAfterSave: the real half/full/none semantics executes
// live while the spy captures args — a wrong `succeeded` argument is caught here;
// damage APPLICATION stays mocked (lane boundary).
vi.mock('../../../rules/combat/applyDamage.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    computeDamageAfterSave: vi.fn(actual.computeDamageAfterSave),
    applyDamageToTarget: vi.fn(() => Promise.resolve()),
  };
});

// ── Imports ────────────────────────────────────────────────────

import { handle } from './prismaticSprayHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestWizard';

const originalRandom = Math.random;

// Rig pickRays' Math.random consumption: floor(Math.random()*sides)+1 === dieValue
function forceRoll(dieValue, sides) {
  Math.random = () => (dieValue - 0.5) / sides;
}

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Prismatic Spray',
    automation: {
      type: 'prismatic_spray',
      saveType: 'DEX',
      saveDc: 15,
      damage: '12d6',
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
    { name: 'Orc', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
    { name: 'Dragon', type: 'monster', weaknessesAndResistivities: { immunities: ['fire'] } },
    { name: casterName, gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

function failSaveListener() {
  return {
    promptId: 'prismatic-prompt',
    promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
  };
}

function successSaveListener() {
  return {
    promptId: 'prismatic-prompt',
    promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('prismaticSprayHandler.handle - save results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  describe('immunity handling for damage rays', () => {
    it('skips save for targets immune to the damage type', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });

      forceRoll(1, 8); // Red (fire) — Dragon is immune
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Dragon should be skipped, only Goblin and Orc get save listeners
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
      const targetNames = savePrompt.createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).toEqual(['Goblin', 'Orc']);
    });

    it('includes immunity message in results summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      forceRoll(1, 8); // Red (fire)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('immune');
      expect(result.payload.description).toContain('Fire immunity');
    });

    it('handles case-insensitive immunity check', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: ['FIRE'] } },
          { name: casterName, gridX: 5, gridY: 10 },
        ],
      });
      savePrompt.buildSaveDc.mockReturnValue(15);

      forceRoll(1, 8); // Red (fire)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Goblin should be skipped
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('counts immune targets in summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });

      forceRoll(1, 8); // Red (fire)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 ray(s) immune');
    });
  });

  describe('disadvantage handling', () => {
    it('applies disadvantage when target is heightenTarget', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      forceRoll(1, 8); // Red (fire)
      await handle(
        { ...makeAction(), metaCtx: { selectedTargets: ['Goblin'], heightenTarget: 'Goblin' } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          disadvantage: true,
        }),
      );
    });

    it('does not apply disadvantage when target is not heightenTarget', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      forceRoll(1, 8); // Red (fire)
      await handle(
        { ...makeAction(), metaCtx: { selectedTargets: ['Goblin'], heightenTarget: 'Orc' } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          disadvantage: false,
        }),
      );
    });
  });

  describe('on successful save', () => {
    it('posts save_result entry with success=true', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      forceRoll(1, 8); // Red (fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const saveResultCall = logService.addEntry.mock.calls.find(
        c => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: true,
          saveDc: 15,
          saveType: 'DEX',
          rollType: 'save-prismatic-spray',
        }),
      );
    });

    it('calls addTargetResult with success', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      forceRoll(1, 8); // Red (fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          saveResult: 'success',
          roll: 14,
          total: 14,
          conditions: [],
          appliedDamage: 0,
        }),
      );
    });

    it('does not apply half damage when rollExpression returns null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue(null);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      forceRoll(1, 8); // Red (fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // The null-roll early-return happens BEFORE the damage computation.
      expect(applyDamage.computeDamageAfterSave).not.toHaveBeenCalled();
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('does not apply damage when real half of raw 1 floors to 0', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 1 });
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      forceRoll(1, 8); // Red (fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // REAL computeDamageAfterSave: floor(1/2) = 0 — the zero-on-save semantics
      // is now proven through the real function, not a canned stub.
      expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledWith(1, true, 'half');
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('does not apply conditions on successful save for damage rays', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      forceRoll(1, 8); // Red (fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.anything(),
        campaignName,
      );
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('save-outcome flow through the REAL computeDamageAfterSave (mixed cast)', () => {
    it('one cast, diverging saves: saving target pays real half (floor(35/2)=17), failing target pays full 30', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      // rollExpression fires per target in save-resolution order: Goblin, then Orc.
      diceRoller.rollExpression
        .mockReturnValueOnce({ total: 35 })
        .mockReturnValueOnce({ total: 30 });
      // Captured listeners bound BY cfg.targetName: Goblin saves, Orc fails — the
      // only shape that exercises processSpraySaves' saveIndex↔saveResults correlation.
      const savesByTarget = {
        Goblin: { success: true, roll: 14, total: 14 },
        Orc: { success: false, roll: 5, total: 5 },
      };
      savePrompt.createSaveListener.mockImplementation((campaign, cfg) => ({
        promptId: `p-${cfg.targetName}`,
        promise: Promise.resolve(savesByTarget[cfg.targetName]),
      }));

      forceRoll(1, 8); // Red (fire) for both targets; Dragon skipped (immune)
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);

      // Args are CAUGHT by the real function: a swapped `succeeded` at either
      // applyRayDamage call site routes 35→17 to the wrong target below, and a
      // mangled dcSuccess falls through the real dcSuccess==='half' gate to 0.
      expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledTimes(2);
      expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledWith(35, true, 'half');
      expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledWith(30, false, 'half');

      // Damage lands on the right creature with the right amount and options.
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(2);
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        baseCombatContext, 'Goblin', 17, ['fire'],
        { campaignName, characters: [], ignoreResistance: false, attackerName: casterName },
      );
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        baseCombatContext, 'Orc', 30, ['fire'],
        { campaignName, characters: [], ignoreResistance: false, attackerName: casterName },
      );

      // save_result entries dispatched per target, outcomes and half/full prose matched.
      const saveResults = logService.addEntry.mock.calls
        .filter(c => c[1].type === 'save_result')
        .map(c => c[1]);
      expect(saveResults).toEqual([
        {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-prismatic-spray',
          targetName: 'Goblin',
          saveDc: 15,
          saveType: 'DEX',
          success: true,
          description: 'Goblin succeeded DEX save against Red ray, taking half 12d6 fire damage.',
        },
        {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-prismatic-spray',
          targetName: 'Orc',
          saveDc: 15,
          saveType: 'DEX',
          success: false,
          description: 'Orc failed DEX save against Red ray, taking full 12d6 fire damage.',
        },
      ]);

      // Rollback ledger mirrors the same per-target save/fail split.
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(2);
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin', saveResult: 'success', roll: 14, total: 14, conditions: [], appliedDamage: 0,
      });
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Orc', saveResult: 'failure', roll: 5, total: 5, conditions: [], appliedDamage: 0,
      });

      // Damage rays NEVER write conditions or expirations — even on a FAILED save
      // (indigo/violet status writes belong to the #1942 rays lane).
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('on failed save for damage rays', () => {
    it('posts save_result entry with success=false', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      forceRoll(1, 8); // Red (fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const saveResultCall = logService.addEntry.mock.calls.find(
        c => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: false,
          saveDc: 15,
          saveType: 'DEX',
          rollType: 'save-prismatic-spray',
        }),
      );
    });

    it('does not apply damage when full damage is 0', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 0 });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      forceRoll(1, 8); // Red (fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Real function returns raw 0 on failure — the `finalDamage > 0` gate holds.
      expect(applyDamage.computeDamageAfterSave).toHaveBeenCalledWith(0, false, 'half');
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('calls addTargetResult with failure', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      forceRoll(1, 8); // Red (fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          saveResult: 'failure',
          roll: 5,
          total: 5,
        }),
      );
    });
  });

  describe('ability_use log entries', () => {
    it('posts ability_use entry for each target on each ray', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      forceRoll(3, 8); // Yellow (lightning) for all targets — damage rays
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityEntries = logService.addEntry.mock.calls.filter(
        c => c[1].type === 'ability_use',
      );
      expect(abilityEntries.length).toBe(3);
      abilityEntries.forEach(entry => {
        expect(entry[1]).toEqual(
          expect.objectContaining({
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Prismatic Spray',
          }),
        );
      });
    });

    it('includes promptId in ability_use entry', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prismatic-test-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityEntry = logService.addEntry.mock.calls.find(
        c => c[1].type === 'ability_use',
      );
      expect(abilityEntry[1].promptId).toBe('prismatic-test-prompt');
    });

    it('includes roll description in log for damage rays', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      forceRoll(1, 8); // Red
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityEntry = logService.addEntry.mock.calls.find(
        c => c[1].type === 'ability_use',
      );
      expect(abilityEntry[1].description).toContain('Red ray');
      expect(abilityEntry[1].description).toContain('rolled 1');
    });

    it('includes roll description in log for indigo ray', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      forceRoll(6, 8); // Indigo
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityEntry = logService.addEntry.mock.calls.find(
        c => c[1].type === 'ability_use',
      );
      expect(abilityEntry[1].description).toContain('Indigo ray');
      expect(abilityEntry[1].description).toContain('rolled 6');
    });

    it('includes roll description in log for violet ray', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      forceRoll(7, 8); // Violet
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityEntry = logService.addEntry.mock.calls.find(
        c => c[1].type === 'ability_use',
      );
      expect(abilityEntry[1].description).toContain('Violet ray');
      expect(abilityEntry[1].description).toContain('rolled 7');
    });
  });
});
