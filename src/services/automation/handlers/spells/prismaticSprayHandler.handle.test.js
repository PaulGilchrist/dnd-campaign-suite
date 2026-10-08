// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  });

  describe('combat context validation', () => {
    it('returns popup when no combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(result.payload.description).toContain('Prismatic Spray has no effect');
    });

    it('returns popup when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when combat context creatures is undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue({});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target selection', () => {
    it('excludes the caster from targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prismatic-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      // Control random to ensure Dragon is not skipped (roll 7 = Violet, not a damage ray)
      const originalRandom = Math.random;
      Math.random = () => 6 / 8; // firstRoll = 7 (Violet) for all targets
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      // Only 3 non-caster creatures
      const targetNames = savePrompt.createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).toContain('Goblin');
      expect(targetNames).toContain('Orc');
      expect(targetNames).toContain('Dragon');
      expect(targetNames).not.toContain(casterName);
    });

    it('uses selected targets from metaCtx when provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prismatic-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { selectedTargets: ['Goblin', 'Orc'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      const targetNames = savePrompt.createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).toContain('Goblin');
      expect(targetNames).toContain('Orc');
      expect(targetNames).not.toContain('Dragon');
    });

    it('returns popup when selected targets are empty', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      const result = await handle(
        { ...makeAction(), metaCtx: { selectedTargets: [] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      // Empty selectedTargets falls through to combat context targets (non-caster creatures)
      expect(result.payload.description).toContain('creature(s)');
    });

    it('returns popup when no non-caster creatures exist', async () => {
      const onlyPlayerContext = {
        creatures: [{ name: casterName, gridX: 5, gridY: 10 }],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(onlyPlayerContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures selected');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('storeSpellLastAttack', () => {
    it('calls storeSpellLastAttack with correct parameters', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prismatic-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName,
        spellName: 'Prismatic Spray',
        saveType: 'DEX',
        saveDc: 15,
        attackScope: 'aoe',
      });
    });
  });

  describe('ray rolling', () => {
    it('calls createSaveListener for each target with a single ray roll (1-7)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prismatic-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      const originalRandom = Math.random;
      Math.random = () => 0.3; // firstRoll = 3 for all targets (Yellow)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      // 3 targets, each gets 1 save listener call for a single ray
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(3);
    });

    it('handles the 8 roll which triggers two rays for a target', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prismatic-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      // Force firstRoll === 8 for first target by mocking Math.random
      const originalRandom = Math.random;
      let callCount = 0;
      Math.random = () => {
        callCount++;
        if (callCount === 1) return 7 / 8; // firstRoll = 8 (first target)
        if (callCount === 2) return 4 / 7; // secondRoll = 5 (Blue ray)
        return 0.3; // firstRoll = 3 for other targets
      };

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      Math.random = originalRandom;

      // First target gets 2 save listeners (two rays), others get 1 each = 4 total
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(4);
    });
  });
});
