// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './sentinelGuardianHandler.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestFighter',
    level: 5,
    attacks: [
      { name: 'Longsword', type: 'Action', range: 'melee' },
      { name: 'Shortbow', type: 'Action', range: 'ranged' },
    ],
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Sentinel - Guardian',
    automation: { type: 'sentinel_guardian', ...overrides },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'TestFighter', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestFighter', gridX: 5, gridY: 10 }],
  placedItems: [],
};

// ── Tests ──────────────────────────────────────────────────────

describe('sentinelGuardianHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('attack_roll result', () => {
    it('returns attack_roll with correct payload when target and melee attack exist', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.attack).toBe(ps.attacks[0]);
      expect(result.payload.targetName).toBe('Goblin');
      expect(result.payload.sourceName).toBe('Sentinel - Guardian');
    });

    it('uses action.name from custom action in attack_roll payload', async () => {
      const action = { name: 'Custom Sentinel', automation: { type: 'sentinel_guardian' } };
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.sourceName).toBe('Custom Sentinel');
      expect(result.payload.targetName).toBe('Orc');
    });

    it('selects first melee attack when multiple melee attacks available', async () => {
      const action = makeAction();
      const ps = makePlayerStats({
        attacks: [
          { name: 'Mace', type: 'Action', range: 'melee' },
          { name: 'Dagger', type: 'Bonus Action', range: 'melee' },
          { name: 'Shortbow', type: 'Action', range: 'ranged' },
        ],
      });

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.attack.name).toBe('Mace');
    });

    it('falls back to first attack when no melee attack available', async () => {
      const action = makeAction();
      const ps = makePlayerStats({ attacks: [{ name: 'Shortbow', type: 'Action', range: 'ranged' }] });

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.attack.name).toBe('Shortbow');
    });

    it('returns popup when no attacks at all', async () => {
      const action = makeAction();
      const ps = makePlayerStats({ attacks: [] });

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Sentinel - Guardian: No melee attack available.');
      expect(result.payload.automation).toBe(action.automation);
    });

    it('returns popup when playerStats has no attacks property', async () => {
      const action = makeAction();
      const ps = makePlayerStats({ attacks: undefined });

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Sentinel - Guardian: No melee attack available.');
    });

    it('passes _mapName parameter through without affecting result', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

      const result = await handle(action, ps, campaignName, 'MapName');

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBe('Goblin');
    });
  });

  describe('popup result (no target)', () => {
    it('returns info popup when combat context is null', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.automation).toBe(action.automation);
    });

    it('returns info popup when combat context is undefined', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
    });

    it('returns info popup when getTargetFromAttacker returns null', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
    });

    it('uses action.name in popup description and name', async () => {
      const action = { name: 'Custom Sentinel', automation: { type: 'sentinel_guardian' } };
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Custom Sentinel');
      expect(result.payload.description).toContain('Custom Sentinel');
    });
  });

  describe('log entry', () => {
    it('calls addEntry with ability_use type and correct fields on success', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      logService.addEntry.mockResolvedValue({ id: 1 });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: ps.name,
          abilityName: action.name,
          description: 'Sentinel - Guardian used against Goblin',
        }),
      );
    });

    it('uses dynamic action.name in log entry description', async () => {
      const action = { name: 'Custom Guardian', automation: { type: 'sentinel_guardian' } };
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
      logService.addEntry.mockResolvedValue({ id: 1 });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          abilityName: 'Custom Guardian',
          description: 'Custom Guardian used against Orc',
        }),
      );
    });

    it('swallows addEntry errors without affecting the return value', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
      logService.addEntry.mockRejectedValue(new Error('network failure'));

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBe('Goblin');
    });
  });
});
