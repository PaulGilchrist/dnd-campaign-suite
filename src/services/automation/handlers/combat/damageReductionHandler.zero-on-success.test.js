import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
  resolveDiceExpression: vi.fn((expr) => expr),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './damageReductionHandler.js';
import * as logService from '../../../ui/logService.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Defensive Reaction',
    automation: {
      type: 'damage_reduction',
      ...automation,
    },
  };
}

function setupMocks() {
  logService.addEntry.mockResolvedValue({});
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: { targetName: 'TestHero' },
    targetName: 'TestHero',
    totalDamage: 10,
    damageTypes: ['Slashing'],
  });
  damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
  applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 5 });
}

// ── Tests ──────────────────────────────────────────────────────

describe('damageReductionHandler - zero on success', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  describe('zero_on_success effect (Intervene Shield)', () => {
    it('returns popup when player has no shield equipped', async () => {
      const ps = makePlayerStats({ inventory: { equipped: [] }, equipment: [] });
      const action = makeAction({
        effect: 'zero_on_success',
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('holding a Shield');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when there is no lastAttack', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      damageRollback.findLastAttack.mockResolvedValue({ attackEvent: null });
      const action = makeAction({ effect: 'zero_on_success' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent attack or saving throw found');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when lastAttack is not a save', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { rollType: 'attack', targetName: 'TestHero' },
      });
      const action = makeAction({ effect: 'zero_on_success' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not a saving throw');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when player was not the target of the save', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: {
          rollType: 'save',
          targetName: 'Ally',
          saveType: 'DEX',
          saveResult: 'success',
          rawDamage: 10,
        },
      });
      const action = makeAction({ effect: 'zero_on_success' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not the target');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when save was not DEX', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: {
          rollType: 'save',
          targetName: 'TestHero',
          saveType: 'CON',
          saveResult: 'success',
          rawDamage: 10,
        },
      });
      const action = makeAction({ effect: 'zero_on_success' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not a Dexterity save');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when save did not succeed', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: {
          rollType: 'save',
          targetName: 'TestHero',
          saveType: 'DEX',
          saveResult: 'failure',
          rawDamage: 10,
        },
      });
      const action = makeAction({ effect: 'zero_on_success' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('did not succeed');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when no damage was dealt', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: {
          rollType: 'save',
          targetName: 'TestHero',
          saveType: 'DEX',
          saveResult: 'success',
          rawDamage: 0,
        },
      });
      const action = makeAction({ effect: 'zero_on_success' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No damage was dealt');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('heals for half rawDamage when all conditions are met', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
        computedStats: { currentHp: 20, maxHp: 50 },
      });
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: {
          rollType: 'save',
          targetName: 'TestHero',
          saveType: 'DEX',
          saveResult: 'success',
          rawDamage: 20,
          attackerName: 'Goblin',
        },
      });
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 10 });
      const action = makeAction({ effect: 'zero_on_success' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('heal for 10 HP');
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'TestHero',
        10,
        campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestHero',
          abilityName: 'Defensive Reaction',
        }),
      );
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'hp_change',
          targetName: 'TestHero',
          delta: 10,
          isHealing: true,
          abilityName: 'Defensive Reaction',
        }),
      );
    });

    it('uses primaryDamage as fallback when rawDamage is 0', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
        computedStats: { currentHp: 20, maxHp: 50 },
      });
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: {
          rollType: 'save',
          targetName: 'TestHero',
          saveType: 'DEX',
          saveResult: 'success',
          rawDamage: 0,
          primaryDamage: 16,
          attackerName: 'Orc',
        },
      });
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 8 });
      const action = makeAction({ effect: 'zero_on_success' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('heal for 8 HP');
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'TestHero',
        8,
        campaignName,
      );
    });

    it('does not heal when combat context is null', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: {
          rollType: 'save',
          targetName: 'TestHero',
          saveType: 'DEX',
          saveResult: 'success',
          rawDamage: 10,
          attackerName: 'Goblin',
        },
      });
      damageUtils.getCombatContext.mockResolvedValue(null);
      const action = makeAction({ effect: 'zero_on_success' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('heal for 0 HP');
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    });

    it('does not throw when addEntry rejects (fire-and-forget logging)', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: {
          rollType: 'save',
          targetName: 'TestHero',
          saveType: 'DEX',
          saveResult: 'success',
          rawDamage: 10,
          attackerName: 'Goblin',
        },
      });
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      const testError = new Error('log save failed');
      logService.addEntry.mockRejectedValue(testError);
      const action = makeAction({ effect: 'zero_on_success' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });
});
