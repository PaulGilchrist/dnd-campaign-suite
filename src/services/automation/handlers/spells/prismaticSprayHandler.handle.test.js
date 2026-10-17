// @maintained-by-ai
// #1940 .handle lane — core handle() orchestration for prismaticSprayHandler.js.
// SEXTET seam map lives in prismaticSprayHandler.damage-regression.test.js header.
// Owns: combat-context refusal popups, target selection (fallback + metaCtx
// selectedTargets + empty-selection refusal), storeSpellLastAttack, and per-target
// ray-dispatch counts. Does NOT pin: damage formulas (damage-regression lane),
// ray-table internals / save-payload contents (#1942 rays), save-result application
// incl. immunity skip & disadvantage (#1943 save-results), summary prose (#1944).
//
// Mechanism verified at source (prismaticSprayHandler.js):
//   • pickRays() runs INSIDE the per-target loop — one 1d8 roll per creature,
//     not one global roll. Roll 8 re-rolls 2d7 for two separate rays.
//   • There is no auto-apply no-save split: every non-immune ray queues a
//     createSaveListener prompt (damage rays dcSuccess:'half', indigo/violet
//     dcSuccess:'none'), so dispatch counts cover all 7 ray outcomes.
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

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => Promise.resolve()),
  computeDamageAfterSave: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './prismaticSprayHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestWizard';

const originalRandom = Math.random;

// Rig pickRays' Math.random consumption: floor(Math.random()*sides)+1 === dieValue
function forceRoll(dieValue, sides) {
  Math.random = () => (dieValue - 0.5) / sides;
}

// Ray roll 7 (Violet, dcSuccess:'none') for every single-ray target —
// still queues a prompt, so dispatch counts are observable.
const forceViolet = () => forceRoll(7, 8);

function capturedSaveTargets() {
  return savePrompt.createSaveListener.mock.calls.map(c => c[1].targetName);
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

// ── Tests ──────────────────────────────────────────────────────

describe('prismaticSprayHandler.handle - core flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    savePrompt.buildSaveDc.mockReturnValue(15);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'prismatic-prompt',
      promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
    });
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  describe('combat context validation', () => {
    it('returns popup when no combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Prismatic Spray',
        description: 'No creatures in combat. Prismatic Spray has no effect.',
      });
      // Refusal must have no side effects: nothing queued, nothing rolled back later.
      expect(damageRollback.storeSpellLastAttack).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('returns popup when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No creatures in combat. Prismatic Spray has no effect.');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('returns popup when combat context creatures is undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue({});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No creatures in combat. Prismatic Spray has no effect.');
    });
  });

  describe('target selection', () => {
    it('excludes the caster from targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      forceViolet();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // 3 non-caster creatures in creatures[] order, one Violet prompt each.
      expect(capturedSaveTargets()).toEqual(['Goblin', 'Orc', 'Dragon']);
    });

    it('uses selected targets from metaCtx when provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      forceRoll(1, 8); // Red ray; neither selected target is fire-immune

      await handle(
        { ...makeAction(), metaCtx: { selectedTargets: ['Goblin', 'Orc'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      // Exactly the selected pair — Dragon and caster never prompted.
      expect(capturedSaveTargets()).toEqual(['Goblin', 'Orc']);
    });

    it('falls through to all combat creatures when selectedTargets is empty', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      forceViolet();

      await handle(
        { ...makeAction(), metaCtx: { selectedTargets: [] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      // Empty selectedTargets falls through to combat-context targets (non-caster creatures).
      expect(capturedSaveTargets()).toEqual(['Goblin', 'Orc', 'Dragon']);
    });

    it('returns popup when no non-caster creatures exist', async () => {
      const onlyPlayerContext = {
        creatures: [{ name: casterName, gridX: 5, gridY: 10 }],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(onlyPlayerContext);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Prismatic Spray',
        description: 'No creatures selected. Prismatic Spray has no effect.',
      });
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('storeSpellLastAttack', () => {
    it('calls storeSpellLastAttack with correct parameters', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      forceRoll(1, 8); // Red/Fire for all targets

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName,
        spellName: 'Prismatic Spray',
        saveType: 'DEX',
        saveDc: 15,
        attackScope: 'aoe',
      });
    });

    it('records the resolved DC from buildSaveDc, not the raw automation value', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(17);
      forceViolet();

      await handle(
        makeAction({ saveDc: 'spell_save_dc' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ saveDc: 17 }),
      );
    });
  });

  describe('ray dispatch counts (per-creature rolls)', () => {
    it('queues one save prompt per target on a single-ray roll', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      forceRoll(3, 8); // Yellow lightning for all targets

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // 3 targets, each gets its own 1d8 roll (pickRays inside the target loop)
      // and one prompt for its single ray.
      expect(capturedSaveTargets()).toEqual(['Goblin', 'Orc', 'Dragon']);
    });

    it('queues two prompts for the first target when it rolls an 8', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);

      // Deterministic consumption order (all synchronous): target 1's 1d8 → 8,
      // then its two 2d7 re-rolls; targets 2 and 3 each consume one 1d8.
      let callCount = 0;
      Math.random = () => {
        callCount++;
        if (callCount === 1) return 7 / 8; // firstRoll = 8 (two rays for Goblin)
        if (callCount === 2) return 4 / 7; // Goblin re-roll 1 → 5 (Blue)
        if (callCount === 3) return 2 / 7; // Goblin re-roll 2 → 3 (Yellow)
        return 0.3; // firstRoll = 3 (Yellow) for Orc and Dragon
      };

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Ray assignment is per target, not global: Goblin owns both 8-roll rays.
      expect(capturedSaveTargets()).toEqual(['Goblin', 'Goblin', 'Orc', 'Dragon']);
      expect(callCount).toBe(5);
    });
  });
});
