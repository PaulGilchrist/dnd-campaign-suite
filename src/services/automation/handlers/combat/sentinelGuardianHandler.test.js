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

  it('returns attack_roll when target exists', async () => {
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

  it('returns info popup when no combat context', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('No target selected');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('returns info popup when no target from attacker', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No target selected');
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

  it('returns info popup when no attacks at all', async () => {
    const action = makeAction();
    const ps = makePlayerStats({ attacks: [] });

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Sentinel - Guardian: No melee attack available.');
  });

  it('calls addEntry with ability_use type', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestFighter',
        abilityName: 'Sentinel - Guardian',
        description: 'Sentinel - Guardian used against Goblin',
      }),
    );
  });

  it('uses action.name from attack payload', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.sourceName).toBe('Sentinel - Guardian');
  });

  it('selects first melee attack when multiple available', async () => {
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

  it('propagates addEntry errors', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    logService.addEntry.mockRejectedValue(new Error('network'));

    await expect(handle(action, ps, campaignName, null)).rejects.toThrow('network');
  });

  it('uses action.name in popup when no target', async () => {
    const action = { name: 'Custom Sentinel', automation: { type: 'sentinel_guardian' } };
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('Custom Sentinel');
  });
});
