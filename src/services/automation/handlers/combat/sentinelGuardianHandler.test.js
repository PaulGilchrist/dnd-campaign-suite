// @maintained-by-ai
// Pure handler contract: deterministic output from mocked damageUtils/logService deps.
// Pins FT-100 Sentinel(Guardian) lane registered in automation/index.js (sentinel_guardian).
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

function mockTarget(name) {
  damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  damageUtils.getTargetFromAttacker.mockReturnValue(name ? { name } : null);
}

// ── Tests ──────────────────────────────────────────────────────

describe('sentinelGuardianHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns attack_roll against the auto-target, queries context by campaignName, and logs ability_use', async () => {
    const action = makeAction();
    const ps = makePlayerStats();
    mockTarget('Goblin');
    logService.addEntry.mockResolvedValue({ id: 1 });

    // 4th arg (mapName) is unused by the handler — pass a value to pin it is ignored.
    const result = await handle(action, ps, campaignName, 'IgnoredMap');

    expect(result.type).toBe('attack_roll');
    expect(result.payload.attack).toBe(ps.attacks[0]);
    expect(result.payload.targetName).toBe('Goblin');
    expect(result.payload.sourceName).toBe('Sentinel - Guardian');
    expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
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

  it('propagates custom action.name through attack_roll payload and log description', async () => {
    const action = { name: 'Custom Guardian', automation: { type: 'sentinel_guardian' } };
    const ps = makePlayerStats();
    mockTarget('Orc');

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('attack_roll');
    expect(result.payload.sourceName).toBe('Custom Guardian');
    expect(result.payload.targetName).toBe('Orc');
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        abilityName: 'Custom Guardian',
        description: 'Custom Guardian used against Orc',
      }),
    );
  });

  it('selects the first Action-type melee attack, skipping non-melee and non-Action attacks', async () => {
    const action = makeAction();
    const ps = makePlayerStats({
      attacks: [
        { name: 'Rapier', type: 'Reaction', range: 'melee' },
        { name: 'Dagger', type: 'Bonus Action', range: 'melee' },
        { name: 'Battleaxe', type: 'Action', range: 'melee' },
        { name: 'Shortbow', type: 'Action', range: 'ranged' },
      ],
    });
    mockTarget('Goblin');

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.attack.name).toBe('Battleaxe');
  });

  it('falls back to first attack when no melee attack available', async () => {
    const action = makeAction();
    const ps = makePlayerStats({ attacks: [{ name: 'Shortbow', type: 'Action', range: 'ranged' }] });
    mockTarget('Goblin');

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('attack_roll');
    expect(result.payload.attack.name).toBe('Shortbow');
  });

  it('returns popup when playerStats.attacks is missing', async () => {
    const action = makeAction();
    const ps = makePlayerStats({ attacks: undefined });
    mockTarget('Goblin');

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('Sentinel - Guardian: No melee attack available.');
    // The handler logs the use before attack selection, so the log still fires.
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({ description: 'Sentinel - Guardian used against Goblin' }),
    );
  });

  it('returns info popup and never calls getTargetFromAttacker when combat context is null', async () => {
    const action = makeAction();
    const ps = makePlayerStats();
    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Sentinel - Guardian');
    expect(result.payload.description).toContain('No target selected');
    expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('returns info popup when target is null or has no name property', async () => {
    const action = makeAction();
    const ps = makePlayerStats();

    mockTarget(null);
    let result = await handle(action, ps, campaignName, null);
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('No target selected');

    // Target object without a name must not crash or produce a nameless OA.
    vi.clearAllMocks();
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    damageUtils.getTargetFromAttacker.mockReturnValue({});
    result = await handle(action, ps, campaignName, null);
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No target selected');
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('proceeds with attack_roll when addEntry rejects', async () => {
    const action = makeAction();
    const ps = makePlayerStats();
    mockTarget('Goblin');
    logService.addEntry.mockRejectedValueOnce(new Error('log error'));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('attack_roll');
    expect(result.payload.targetName).toBe('Goblin');
  });
});
