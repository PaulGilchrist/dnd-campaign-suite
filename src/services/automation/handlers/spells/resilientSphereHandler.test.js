import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Liveness verification (2026-10-16) ─────────────────────────────
// handle: LIVE — public/data/spells.json (:8239, 5e "Resilient Sphere") and
//   public/data/2024/spells.json (:9698, "Otiluke's Resilient Sphere") both
//   declare automation.type "resilient_sphere" → HANDLER_MAP
//   (automation/index.js:579) → executeHandler (:699) on cast.
//
// Handler findings reported for owner follow-up (current defective behavior
// is pinned as-is below where relevant, marked DEFECT):
// 1. Arity-error class (cf. removeCurse): getRuntimeValue is 2-arg
//    (characterKey, propertyName) — handler calls it with a 3rd campaignName
//    arg at :34, :192, :212, :216, :223, :229. The extra arg is silently
//    ignored (store is characterKey-scoped), so behavior is correct today.
// 2. Toggle-off recast removes the activeBuff but ALWAYS re-adds a
//    targetEffect (:34-41, no filter-first like sanctuary/compelledDuel) and
//    still logs condition "applied" — automationPassives.isResilientSphereActive
//    checks targetEffects too, so the barrier never opens on a toggle-off.
//    Repeat casts also accumulate duplicate targetEffect entries.
// 3. Name identity split (cf. antimagicField Q1): 5e data names the spell
//    "Resilient Sphere", 2024 data "Otiluke's Resilient Sphere". The buff
//    toggle keys on action.name, and the condition log hardcodes
//    'Resilient Sphere' regardless of action.name.
//
// The handler's isResilientSphereActive/getResilientSphereSource exports
// (:210-231) are DEAD verbatim duplicates of automationPassives.js:362/:374.
// Every production consumer (CreatureCard.jsx:21, useLoggedDiceRollAttack.js:16,
// contextBuilder-sync.js:18, d20RollComputation.js arg-injection) imports the
// automationPassives copies, covered by automationPassives.test.js:457-520.
// Those duplicate tests were trimmed here; recommend deleting the exports.

// ── Mocks BEFORE imports ───────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn().mockReturnValue(13),
  createSaveListener: vi.fn(() => ({
    promptId: 'test-prompt-id',
    promise: Promise.resolve({ success: false }),
  })),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn().mockReturnValue(['TestWizard', 'AllyPlayer']),
}));

// ── Imports ──────────────────────────────────────────────────────────

import { handle } from './resilientSphereHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ──────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestWizard';
const targetName = 'EnemyGoblin';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 16, WIS: 10, CHA: 10 },
    ...overrides,
  };
}

// Mirrors the real automation blocks in spells.json / 2024 spells.json;
// overrides MERGE over the defaults.
function makeAction(automation = {}, metaCtx = {}) {
  return {
    name: 'Resilient Sphere',
    automation: {
      type: 'spell',
      saveDc: 'ability',
      saveType: 'DEX',
      ...automation,
    },
    metaCtx,
  };
}

function mockSaveResult(success) {
  savePrompt.createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve({ success, roll: 1, total: success ? 14 : 5 }),
  });
}

// Realistic state reads keyed by (characterKey, propertyName) — avoids the
// cross-contamination of mockReturnValue also feeding the targetEffects read.
function mockStore({ buffs = [], targetEffects = [] } = {}) {
  runtimeState.getRuntimeValue.mockImplementation((key, prop) => {
    if (prop === 'activeBuffs') return key === targetName ? buffs : [];
    if (prop === 'targetEffects') return targetEffects;
    return null;
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('resilientSphereHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: targetName } });
    mockSaveResult(false);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: targetName }],
    });
  });

  describe('handle', () => {
    it('returns popup and writes nothing when combat context has no creatures (null, missing prop, or empty array)', async () => {
      for (const cs of [null, {}, { creatures: [] }]) {
        damageUtils.getCombatContext.mockResolvedValue(cs);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Resilient Sphere');
        expect(result.payload.description).toContain('No creatures in combat');
      }
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('returns popup and writes nothing when target unresolved (null, undefined, or empty object)', async () => {
      for (const resolved of [null, undefined, {}]) {
        targetResolver.resolveTarget.mockResolvedValue(resolved);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
      }
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('stores spell last-attack rollback context and prompts DEX save with exact config', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'spell', saveDc: 'ability', saveType: 'DEX' }),
        expect.objectContaining({ name: casterName }),
      );
      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName,
        spellName: 'Resilient Sphere',
        saveType: 'DEX',
        saveDc: 13,
        attackScope: 'single',
      });
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'DEX',
        saveDc: 13,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('applies disadvantage on the save prompt when heightened', async () => {
      await handle(makeAction({}, { metamagicHeighten: true }), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ disadvantage: true }),
      );
    });

    describe('save success path', () => {
      it('returns popup, logs ability_use + save_result only, records zero-damage success, writes no buff', async () => {
        mockSaveResult(true);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
          `${targetName} succeeded on DEX save against Resilient Sphere.`
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Resilient Sphere',
          description: `${casterName} casts Resilient Sphere on ${targetName}! ${targetName} must make a DEX save (DC 13) or be enclosed in a Resilient Sphere.`,
          promptId: 'test-prompt-id',
        });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-resilient-sphere',
          targetName,
          saveDc: 13,
          saveType: 'DEX',
          success: true,
          description: `${targetName} succeeded on DEX save against Resilient Sphere.`,
        });
        expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
          targetName,
          saveResult: 'success',
          roll: 1,
          total: 14,
          conditions: [],
          appliedDamage: 0,
        });
        // Exactly two log entries (no condition entry), no buff, no expiration.
        expect(logService.addEntry).toHaveBeenCalledTimes(2);
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
      });
    });

    describe('save failure path', () => {
      it('returns popup with the exact enclosure toast text', async () => {
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
          `${targetName} failed DEX save and is enclosed in a Resilient Sphere. Nothing passes through the barrier. The sphere is immune to all damage. Inside can't be damaged from outside; inside can't damage outside. Creature can use action to roll sphere at half speed. Others can move it. Disintegrate destroys it.`
        );
      });

      it('writes buff and campaign targetEffect with full shapes', async () => {
        mockStore();

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(targetName, 'activeBuffs', [
          {
            name: 'Resilient Sphere',
            effect: 'resilient_sphere',
            duration: 'Concentration, up to 1 minute',
            sourceCharacter: casterName,
          },
        ], campaignName);
        // 5th `true` arg is repo-wide targetEffects-write convention
        // (sanctuary, compelledDuel, polymorph services do the same).
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
          {
            target: targetName,
            effect: 'resilient_sphere',
            source: casterName,
            duration: 'concentration',
          },
        ], campaignName, true);
      });

      it('queues concentration expiration with the exact removal pair', async () => {
        await handle(makeAction(), makePlayerStats(), campaignName, null);

        // Exact array (not arrayContaining): handler emits precisely these two removals.
        expect(expirations.addExpiration).toHaveBeenCalledWith({
          attackerName: casterName,
          targetName,
          effects: [
            { type: 'remove_active_buff', buffName: 'Resilient Sphere', effect: 'resilient_sphere' },
            { type: 'remove_target_effect', effectKey: 'resilient_sphere', target: targetName, source: casterName },
          ],
          campaignName,
        });
      });

      it('uses custom duration from automation config on the buff', async () => {
        const action = makeAction({ duration: 'Concentration, up to 2 minutes' });

        await handle(action, makePlayerStats(), campaignName, null);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          targetName,
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({ duration: 'Concentration, up to 2 minutes' }),
          ]),
          campaignName,
        );
      });

      it('logs ability_use, save_result failure, and condition-applied entries', async () => {
        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Resilient Sphere',
          description: `${casterName} casts Resilient Sphere on ${targetName}! ${targetName} must make a DEX save (DC 13) or be enclosed in a Resilient Sphere.`,
          promptId: 'test-prompt-id',
        });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-resilient-sphere',
          targetName,
          saveDc: 13,
          saveType: 'DEX',
          success: false,
          description: `${targetName} failed DEX save against Resilient Sphere and is enclosed in a Resilient Sphere.`,
        });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'condition',
          action: 'applied',
          characterName: targetName,
          condition: 'Resilient Sphere',
          reason: 'Resilient Sphere',
          note: expect.stringContaining('enclosed in Otiluke\'s Resilient Sphere'),
          timestamp: expect.any(Number),
        });
        expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
          targetName,
          saveResult: 'failure',
          roll: 1,
          total: 5,
          conditions: ['resilient_sphere'],
          appliedDamage: 0,
        });
      });
    });

    describe('ally auto-fail (2024 rules)', () => {
      it('auto-fails without prompt or target resolution and encloses ally with targetEffect', async () => {
        mockStore();
        const action = makeAction({}, { resilientSphereTargetName: 'AllyPlayer' });

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('failed DEX save');
        expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
        expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'campaign',
          'targetEffects',
          expect.arrayContaining([
            expect.objectContaining({
              target: 'AllyPlayer',
              effect: 'resilient_sphere',
              source: casterName,
            }),
          ]),
          campaignName,
          true,
        );
        expect(expirations.addExpiration).toHaveBeenCalledWith({
          attackerName: casterName,
          targetName: 'AllyPlayer',
          effects: expect.arrayContaining([
            expect.objectContaining({ type: 'remove_target_effect', effectKey: 'resilient_sphere' }),
          ]),
          campaignName,
        });
      });
    });

    describe('toggle behavior (re-cast)', () => {
      it('removes the buff and skips expiration — but currently re-adds targetEffect, keeping the barrier up (DEFECT: reported, pinned as-is)', async () => {
        mockStore({
          buffs: [{ name: 'Resilient Sphere', effect: 'resilient_sphere', sourceCharacter: casterName }],
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        // Buff removed.
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          targetName,
          'activeBuffs',
          [],
          campaignName,
        );
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        // DEFECT pin: the unfiltered targetEffects re-add (:34-41) means
        // automationPassives.isResilientSphereActive still reports the sphere
        // active, and the handler still logs an "applied" condition entry.
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'campaign',
          'targetEffects',
          expect.arrayContaining([
            expect.objectContaining({ target: targetName, effect: 'resilient_sphere' }),
          ]),
          campaignName,
          true,
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName,
          expect.objectContaining({ type: 'condition', action: 'applied', characterName: targetName }));
      });
    });
  });
});
